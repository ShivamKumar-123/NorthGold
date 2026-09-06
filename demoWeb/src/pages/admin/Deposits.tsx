import { ArrowDownToLine } from 'lucide-react';

import { allDeposits, approveDeposit, rejectDeposit } from '@/lib/store';
import ReviewQueue from './ReviewQueue';

export default function AdminDeposits() {
  return (
    <ReviewQueue
      title="Deposits"
      description="Cash handed over at the counter, waiting to be verified."
      rows={allDeposits()}
      amountLabel="Deposited"
      messageLabel="Member's description of the handover"
      emptyTitle="No deposits to review"
      emptyIcon={<ArrowDownToLine size={26} />}
      note="Approving credits the member's wallet, opens an investment on the matching plan, and pays commission up their sponsor chain. It cannot be undone from here."
      onApprove={(id, note) => approveDeposit(id, note)}
      onReject={(id, note) => rejectDeposit(id, note)}
    />
  );
}
