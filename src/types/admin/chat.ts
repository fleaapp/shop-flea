export interface ChatThread {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: 'active' | 'resolved';
  created_at: string;
  updated_at: string;
  last_message?: ChatMessage;
  unread_count?: number;
  user_profile?: { username: string; avatar_url: string | null };
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_type: 'user' | 'support';
  message: string;
  attachment_url: string | null;
  read: boolean;
  created_at: string;
}

export type ThreadFilter = 'all' | 'active' | 'resolved';
