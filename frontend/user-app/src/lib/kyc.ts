/**
 * The identity documents an account cannot be opened without.
 *
 * Signup, the profile page and the dashboard panel all read this list, so the
 * five things a member is asked for are named the same way everywhere. The
 * `value`s match `KYCDocument.DOC_TYPES` on the API and the field names the
 * register endpoint expects.
 */
export const KYC_DOC_TYPES = [
  { value: 'id_front', label: 'ID — front' },
  { value: 'id_back', label: 'ID — back' },
  { value: 'selfie', label: 'Selfie with ID' },
  { value: 'address_proof', label: 'Proof of address' },
  { value: 'bank_proof', label: 'Bank proof' },
];

export type KycDoc = {
  id: string;
  doc_type: string;
  file: string;
  status: string;
  rejection_reason: string;
  reviewed_at: string | null;
  created_at: string;
};

export type KycOverview = {
  kyc_status: string;
  documents: KycDoc[];
};
