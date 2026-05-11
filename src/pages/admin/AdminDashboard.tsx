import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Flag, ShieldBan, Mailbox, Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAdminChatThreads } from '@/hooks/admin/useAdminChatThreads';
import { useAdminReports } from '@/hooks/admin/useAdminReports';
import { useAdminBannedUsers } from '@/hooks/admin/useAdminBannedUsers';
import { useAdminSuggestions } from '@/hooks/admin/useAdminSuggestions';
import { formatDistanceToNow } from 'date-fns';

type AdminTab = 'support' | 'reports' | 'bans' | 'suggestions';

export default function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>('support');
  const { threads, loading: tLoading } = useAdminChatThreads();
  const { reports, loading: rLoading, pendingCount } = useAdminReports();
  const { bannedUsers, loading: bLoading, activeCount } = useAdminBannedUsers();
  const { suggestions, loading: sLoading, unreadCount } = useAdminSuggestions();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-lg font-bold">Admin</h1>
        <Badge variant="secondary" className="ml-2">staff</Badge>
        <div className="ml-auto text-xs text-muted-foreground">More tools coming</div>
      </header>

      <div className="border-b border-border bg-card px-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as AdminTab)}>
          <TabsList className="h-11 bg-transparent p-0">
            <TabsTrigger value="support" className="gap-2"><MessageCircle className="h-4 w-4" />Support</TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <Flag className="h-4 w-4" />Reports
              {pendingCount > 0 && <Badge variant="destructive" className="h-5 px-1 text-xs">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="bans" className="gap-2">
              <ShieldBan className="h-4 w-4" />Bans
              {activeCount > 0 && <Badge variant="secondary" className="h-5 px-1 text-xs">{activeCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="gap-2">
              <Mailbox className="h-4 w-4" />Suggestions
              {unreadCount > 0 && <Badge variant="destructive" className="h-5 px-1 text-xs">{unreadCount}</Badge>}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <main className="flex-1 overflow-y-auto p-4">
        {tab === 'support' && (
          <List loading={tLoading} empty="No conversations" items={threads.map((t) => ({
            id: t.id,
            title: t.user_profile?.username || 'Unknown',
            sub: t.title + (t.last_message ? ` — ${t.last_message.message}` : ''),
            meta: t.status,
            badge: (t.unread_count || 0) > 0 ? String(t.unread_count) : undefined,
          }))} />
        )}
        {tab === 'reports' && (
          <List loading={rLoading} empty="No reports" items={reports.map((r) => ({
            id: r.id,
            title: `${r.report_type} report — ${r.reported_user_profile?.username || '?'}`,
            sub: `by ${r.reporter_user_profile?.username || '?'}: ${r.reason}`,
            meta: `${r.status} · ${formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}`,
          }))} />
        )}
        {tab === 'bans' && (
          <List loading={bLoading} empty="No bans" items={bannedUsers.map((b) => ({
            id: b.id,
            title: b.user_profile?.username || 'Unknown',
            sub: b.reason,
            meta: b.status,
          }))} />
        )}
        {tab === 'suggestions' && (
          <List loading={sLoading} empty="No suggestions" items={suggestions.map((s) => ({
            id: s.id,
            title: s.profile?.username || 'Unknown',
            sub: s.content,
            meta: s.read ? 'read' : 'new',
          }))} />
        )}
      </main>
    </div>
  );
}

function List({ loading, empty, items }: {
  loading: boolean;
  empty: string;
  items: { id: string; title: string; sub: string; meta: string; badge?: string }[];
}) {
  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (items.length === 0) return <div className="py-12 text-center text-sm text-muted-foreground">{empty}</div>;
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.id} className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{it.title}</p>
              <p className="truncate text-sm text-muted-foreground">{it.sub}</p>
              <p className="mt-1 text-xs text-muted-foreground">{it.meta}</p>
            </div>
            {it.badge && <Badge variant="destructive">{it.badge}</Badge>}
          </div>
        </div>
      ))}
    </div>
  );
}
