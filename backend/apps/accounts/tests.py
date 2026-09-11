"""Registration now opens an account and its KYC file in one move.

The rule under test is that the two cannot come apart: a signup missing any of
the documents creates nothing at all, and a successful one leaves the
review queue already holding everything an administrator needs.
"""
import shutil
import tempfile

from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import KYCDocument, User
from apps.accounts.serializers import KYC_SIGNUP_DOCS

MEDIA_ROOT = tempfile.mkdtemp()

DETAILS = {
    "email": "newjoiner@t.local",
    "password": "Testpass!2026",
    "first_name": "New",
    "last_name": "Joiner",
}


def a_file(name="doc.png"):
    from django.core.files.uploadedfile import SimpleUploadedFile
    return SimpleUploadedFile(name, b"not-really-a-png", content_type="image/png")


def full_signup(**overrides):
    payload = {
        **DETAILS,
        # Which identity document the two ID pages are. Asked once, stored on
        # both, and required — a reviewer cannot check a number format without
        # knowing which document they are holding.
        "proof_type": "aadhaar",
        **{doc: a_file(f"{doc}.png") for doc in KYC_SIGNUP_DOCS},
    }
    payload.update(overrides)
    return payload


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class RegistrationKYCTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.client = APIClient()
        self.url = reverse("register")

    def test_signup_without_documents_is_refused(self):
        res = self.client.post(self.url, DETAILS, format="multipart")
        self.assertEqual(res.status_code, 400)
        for doc in KYC_SIGNUP_DOCS:
            self.assertIn(doc, res.data)

    def test_a_missing_document_creates_no_account_at_all(self):
        payload = full_signup()
        payload.pop("selfie")

        res = self.client.post(self.url, payload, format="multipart")

        self.assertEqual(res.status_code, 400)
        # The whole point: a partial signup leaves nothing behind, so nobody
        # can exist here without documents to verify them by.
        self.assertFalse(User.objects.filter(email=DETAILS["email"]).exists())
        self.assertEqual(KYCDocument.objects.count(), 0)

    def test_a_complete_signup_files_every_document(self):
        res = self.client.post(self.url, full_signup(), format="multipart")

        self.assertEqual(res.status_code, 201)
        user = User.objects.get(email=DETAILS["email"])
        self.assertEqual(user.kyc_status, "submitted")

        docs = KYCDocument.objects.filter(user=user)
        self.assertEqual(docs.count(), len(KYC_SIGNUP_DOCS))
        self.assertEqual(
            sorted(docs.values_list("doc_type", flat=True)), sorted(KYC_SIGNUP_DOCS),
        )
        self.assertTrue(all(d.status == "submitted" for d in docs))

        # The choice rides on the two ID pages and nothing else.
        self.assertEqual(
            sorted(docs.filter(proof_type="aadhaar").values_list("doc_type", flat=True)),
            ["id_back", "id_front"],
        )
        self.assertTrue(all(d.proof_type == "" for d in docs.exclude(
            doc_type__in=["id_front", "id_back"])))

    def test_signup_without_a_proof_type_is_refused(self):
        payload = full_signup()
        payload.pop("proof_type")

        res = self.client.post(self.url, payload, format="multipart")

        self.assertEqual(res.status_code, 400)
        self.assertIn("proof_type", res.data)
        self.assertFalse(User.objects.filter(email=DETAILS["email"]).exists())

    def test_an_unknown_proof_type_is_refused(self):
        res = self.client.post(
            self.url, full_signup(proof_type="driving_licence"), format="multipart",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("proof_type", res.data)

    def test_an_oversized_document_is_refused(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        payload = full_signup(
            id_front=SimpleUploadedFile(
                "huge.png", b"x" * (5 * 1024 * 1024 + 1), content_type="image/png",
            ),
        )
        res = self.client.post(self.url, payload, format="multipart")

        self.assertEqual(res.status_code, 400)
        self.assertIn("id_front", res.data)
        self.assertFalse(User.objects.filter(email=DETAILS["email"]).exists())


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class AdminKYCReviewTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.client = APIClient()
        self.client.post(reverse("register"), full_signup(), format="multipart")
        self.member = User.objects.get(email=DETAILS["email"])

        self.admin = User.objects.create_superuser(
            email="desk@t.local", password="Testpass!2026",
        )
        self.client.force_authenticate(self.admin)

    def review(self, doc, action, reason=""):
        return self.client.post(
            reverse("admin-kyc-review", args=[doc.id]),
            {"action": action, "reason": reason},
            format="json",
        )

    def test_the_queue_lists_the_new_signup(self):
        res = self.client.get(reverse("admin-kyc"))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["items"]), len(KYC_SIGNUP_DOCS))
        self.assertEqual(res.data["items"][0]["user_email"], self.member.email)

    def test_member_is_approved_only_once_every_document_is(self):
        docs = list(KYCDocument.objects.filter(user=self.member))

        for doc in docs[:-1]:
            self.review(doc, "approve")
            self.member.refresh_from_db()
            # Still outstanding work, so the account must not read as verified.
            self.assertEqual(self.member.kyc_status, "pending")

        self.review(docs[-1], "approve")
        self.member.refresh_from_db()
        self.assertEqual(self.member.kyc_status, "approved")

    def test_one_rejection_marks_the_member_rejected_with_a_reason(self):
        doc = KYCDocument.objects.filter(user=self.member).first()

        res = self.review(doc, "reject", reason="The photo is cut off.")

        self.assertEqual(res.status_code, 200)
        doc.refresh_from_db()
        self.member.refresh_from_db()
        self.assertEqual(doc.status, "rejected")
        self.assertEqual(doc.rejection_reason, "The photo is cut off.")
        self.assertEqual(self.member.kyc_status, "rejected")
