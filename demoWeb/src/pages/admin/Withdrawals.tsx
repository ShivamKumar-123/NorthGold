import { ArrowUpFromLine } from 'lucide-react';

import { allWithdrawals, approveWithdrawal, rejectWithdrawal } from '@/lib/store';
import ReviewQueue from './ReviewQueue';

export default function AdminWithdrawals() {
  return (
    <ReviewQueue
      title="Withdrawals"
      description="Cash collections to arrange and confirm."
      rows={allWithdrawals()}
      amountLabel="Requested"
      messageLabel="When and where they want to collect"
      emptyTitle="No withdrawals to review"
      emptyIcon={<ArrowUpFromLine size={26} />}
      note="The amount was already held when the member requested it. Approving records the hand-over; rejecting returns the money to their wallet."
      onApprove={(id, note) => approveWithdrawal(id, note)}
      onReject={(id, note) => rejectWithdrawal(id, note)}
    />
  );
}
