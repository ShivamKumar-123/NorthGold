/** One message in a support thread. Mirrors SupportMessageSerializer. */
export type SupportMessage = {
  id: string;
  sender: 'user' | 'admin';
  author_name: string;
  body: string;
  read_at: string | null;
  created_at: string;
  /** The quoted message, already trimmed to what the strip draws. */
  reply_to: { id: string; sender: 'user' | 'admin'; body: string } | null;
  /** Whether the person asking has starred it — not whether anyone has. */
  starred: boolean;
  /** The emoji the person asking picked, or "". */
  my_reaction: string;
  reaction_counts: Record<string, number>;
  edited_at: string | null;
  forwarded: boolean;
  /** Own message, and only while the other side has not read it. */
  can_edit: boolean;
};

/** The quick row on the message menu. Must match ALLOWED_REACTIONS on the API,
 *  which refuses anything outside it. */
export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
