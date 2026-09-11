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
];

/** Which identity document the ID pages are. `doc_type` says it is the front
 *  of an ID; this says the ID is an Aadhaar. A reviewer needs both — the
 *  number format and what can be checked against it differ per document. */
export type ProofType = 'aadhaar' | 'pan' | 'national_id';

export const PROOF_TYPES: Array<{ value: ProofType; label: string }> = [
  { value: 'aadhaar', label: 'Aadhaar card' },
  { value: 'pan', label: 'PAN card' },
  { value: 'national_id', label: 'National ID' },
];

/** The two pages that carry a proof type. A selfie is not an Aadhaar. */
export const ID_DOC_TYPES = ['id_front', 'id_back'];

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
