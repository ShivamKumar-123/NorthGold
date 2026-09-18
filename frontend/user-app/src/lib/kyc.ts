/**
 * The identity documents an account cannot be opened without.
 *
 * Signup, the profile page and the dashboard panel all read this list, so the
 * documents a member is asked for are named the same way everywhere. The
 * `value`s match `KYCDocument.DOC_TYPES` on the API and the field names the
 * register endpoint expects.
 */
export const KYC_DOC_TYPES = [
  { value: 'id_front', label: 'ID — front' },
  { value: 'id_back', label: 'ID — back' },
];

/** Which identity document these pages are. `doc_type` says it is the front
 *  of an ID; this says the ID is an Aadhaar. A reviewer needs both — the
 *  number format and what can be checked against it differ per document.
 *
 *  Every document collected is now an ID page, so this applies to all of
 *  them; there is no longer a document it does not describe. */
export type ProofType = 'aadhaar' | 'pan' | 'national_id';

export const PROOF_TYPES: Array<{ value: ProofType; label: string }> = [
  { value: 'aadhaar', label: 'Aadhaar card' },
  { value: 'pan', label: 'PAN card' },
  { value: 'national_id', label: 'National ID' },
];

export type KycDoc = {
  id: string;
  doc_type: string;
  proof_type: ProofType | '';
  proof_type_label: string;
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
