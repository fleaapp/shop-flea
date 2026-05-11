export type ReportedEntity =
  | { kind: 'listing'; id: string; title: string; price: number; image: string | null; status: string }
  | { kind: 'comment'; id: string; content: string; listing_id: string }
  | { kind: 'user'; id: string; username: string };

export interface Report {
  id: string;
  report_type: 'listing' | 'comment' | 'user';
  reported_item_id: string;
  reported_user_id: string;
  reporter_user_id: string;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  reported_user_profile?: { username: string; avatar_url: string | null };
  reporter_user_profile?: { username: string; avatar_url: string | null };
  reported_entity?: ReportedEntity | null;
  reported_user_total_reports?: number;
}

export interface TopReportedUser {
  user_id: string;
  count: number;
  pending: number;
  accepted: number;
  rejected: number;
  profile: { username: string; avatar_url: string | null };
}

export interface BannedUser {
  id: string;
  user_id: string;
  reason: string;
  related_report_id: string | null;
  status: 'active' | 'lifted';
  banned_at: string;
  lifted_at: string | null;
  banned_by: string;
  created_at: string;
  updated_at: string;
  user_profile?: { username: string; avatar_url: string | null };
  related_report?: Report | null;
}

export type ReportFilter = 'all' | 'pending' | 'accepted' | 'rejected';
export type BanFilter = 'all' | 'active' | 'lifted';
