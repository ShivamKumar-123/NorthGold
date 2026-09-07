/** One message in a support thread. Mirrors SupportMessageSerializer. */
export type SupportMessage = {
  id: string;
  sender: 'user' | 'admin';
  author_name: string;
  body: string;
  read_at: string | null;
  created_at: string;
};
