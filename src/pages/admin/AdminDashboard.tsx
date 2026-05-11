import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Flag, ShieldBan, Mailbox, Loader2, RefreshCw, Send } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAdminChatThreads } from '@/hooks/admin/useAdminChatThreads';
import { useAdminChatMessages } from '@/hooks/admin/useAdminChatMessages';
import { useAdminReports } from '@/hooks/admin/useAdminReports';
import { useAdminBannedUsers } from '@/hooks/admin/useAdminBannedUsers';
import { useAdminSuggestions } from '@/hooks/admin/useAdminSuggestions';
import type { ThreadFilter } from '@/types/admin/chat';
import type { BanFilter, ReportFilter } from '@/types/admin/reports';
import { formatDistanceToNow } from 'date-fns';

const formatWhen = (value?: string | null) => {
  if (!value) return 'unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown time';
  return formatDistanceToNow(date, { addSuffix: true });
};

type AdminTab = 'support' | 'reports' | 'bans' | 'suggestions';

export default function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>('support');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  const {
    threads,
    loading: tLoading,
    filter: threadFilter,
    setFilter: setThreadFilter,
    updateThreadStatus,
    refetch: refetchThreads,
  } = useAdminChatThreads();
  const { messages, loading: mLoading, sending, sendMessage } = useAdminChatMessages(selectedThreadId);
  const {
    reports,
    topReportedUsers,
    loading: rLoading,
    filter: reportFilter,
    setFilter: setReportFilter,
    updateReportStatus,
    pendingCount,
    refetch: refetchReports,
  } = useAdminReports();
  const {
    bannedUsers,
    loading: bLoading,
    filter: banFilter,
    setFilter: setBanFilter,
    banUser,
    updateBanStatus,
    activeCount,
    refetch: refetchBans,
  } = useAdminBannedUsers();
  const { suggestions, loading: sLoading, unreadCount, markAsRead, refetch: refetchSuggestions } = useAdminSuggestions();

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [selectedThreadId, threads]
  );

  useEffect(() => {
    if (!selectedThreadId && threads.length > 0) setSelectedThreadId(threads[0].id);
  }, [selectedThreadId, threads]);

  const handleSendReply = async () => {
    const trimmed = reply.trim();
    if (!trimmed || !selectedThreadId) return;
    await sendMessage(trimmed);
    setReply('');
    refetchThreads();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-lg font-bold">Admin</h1>
        <Badge variant="secondary" className="ml-2">staff</Badge>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          onClick={() => {
            refetchThreads();
            refetchReports();
            refetchBans();
            refetchSuggestions();
          }}
          aria-label="Refresh admin data"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
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
          <section className="grid gap-3 lg:grid-cols-[minmax(280px,360px)_1fr]">
            <div>
              <FilterBar<ThreadFilter> value={threadFilter} options={['all', 'active', 'resolved']} onChange={setThreadFilter} />
              <List loading={tLoading} empty="No conversations">
                {threads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`w-full rounded-lg border p-3 text-left ${selectedThreadId === thread.id ? 'border-primary bg-accent' : 'border-border bg-card'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{thread.user_profile?.username || 'Unknown'}</p>
                        <p className="truncate text-sm text-muted-foreground">{thread.title}{thread.last_message ? ` — ${thread.last_message.message}` : ''}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{thread.status} · {formatWhen(thread.updated_at)}</p>
                      </div>
                      {(thread.unread_count || 0) > 0 && <Badge variant="destructive">{thread.unread_count}</Badge>}
                    </div>
                  </button>
                ))}
              </List>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              {!selectedThread ? (
                <EmptyState label="Select a conversation" />
              ) : (
                <div className="flex h-[min(62svh,560px)] flex-col gap-3">
                  <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{selectedThread.user_profile?.username || 'Unknown'}</p>
                      <p className="truncate text-sm text-muted-foreground">{selectedThread.title}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateThreadStatus(selectedThread.id, selectedThread.status === 'resolved' ? 'active' : 'resolved')}
                    >
                      {selectedThread.status === 'resolved' ? 'Reopen' : 'Resolve'}
                    </Button>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                    {mLoading ? <Loader /> : messages.map((message) => (
                      <div key={message.id} className={`max-w-[88%] rounded-lg px-3 py-2 text-sm ${message.sender_type === 'support' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                        <p className="whitespace-pre-wrap break-words">{message.message}</p>
                        <p className="mt-1 text-[11px] opacity-70">{formatWhen(message.created_at)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Textarea value={reply} onChange={(e) => setReply(e.target.value)} className="min-h-10 flex-1 resize-none" placeholder="Reply..." />
                    <Button size="icon" disabled={sending || !reply.trim()} onClick={handleSendReply} aria-label="Send reply">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {tab === 'reports' && (
          <section className="space-y-4">
            {topReportedUsers.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="mb-2 text-sm font-semibold">Top reported users</p>
                <div className="flex flex-wrap gap-2">
                  {topReportedUsers.slice(0, 12).map((u) => (
                    <div key={u.user_id} className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs">
                      <span className="font-medium">{u.profile.username}</span>
                      <Badge variant={u.pending > 0 ? 'destructive' : 'secondary'} className="h-5 px-1.5 text-[10px]">
                        {u.count}
                      </Badge>
                      {u.pending > 0 && <span className="text-[10px] text-muted-foreground">{u.pending} pending</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <FilterBar<ReportFilter> value={reportFilter} options={['all', 'pending', 'accepted', 'rejected']} onChange={setReportFilter} />
            <List loading={rLoading} empty="No reports">
              {reports.map((report) => {
                const entity = report.reported_entity;
                return (
                  <div key={report.id} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="capitalize">{report.report_type}</Badge>
                          <Badge variant={report.status === 'pending' ? 'destructive' : 'secondary'} className="capitalize">{report.status}</Badge>
                          <span className="text-xs text-muted-foreground">{formatWhen(report.created_at)}</span>
                        </div>
                        <p className="text-sm">
                          <span className="font-medium">{report.reported_user_profile?.username || '?'}</span>
                          <span className="text-muted-foreground"> reported by </span>
                          <span className="font-medium">{report.reporter_user_profile?.username || '?'}</span>
                          {report.reported_user_total_reports && report.reported_user_total_reports > 1 && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({report.reported_user_total_reports} total reports against this user)
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Reason:</span> {report.reason || 'No reason provided'}</p>

                        {entity?.kind === 'listing' && (
                          <Link
                            to={`/listing/${entity.id}`}
                            className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-2 hover:bg-muted/60"
                          >
                            {entity.image && (
                              <img src={entity.image} alt={entity.title} className="h-12 w-12 rounded object-cover" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{entity.title}</p>
                              <p className="text-xs text-muted-foreground">${entity.price} · {entity.status}</p>
                            </div>
                          </Link>
                        )}
                        {entity?.kind === 'comment' && (
                          <Link
                            to={`/listing/${entity.listing_id}`}
                            className="block rounded-md border border-border bg-muted/30 p-2 hover:bg-muted/60"
                          >
                            <p className="text-xs uppercase text-muted-foreground">Comment</p>
                            <p className="line-clamp-3 whitespace-pre-wrap text-sm">{entity.content}</p>
                          </Link>
                        )}
                        {entity?.kind === 'user' && (
                          <Link
                            to={`/seller/${entity.id}`}
                            className="inline-block rounded-md border border-border bg-muted/30 px-2 py-1 text-sm hover:bg-muted/60"
                          >
                            View profile: {entity.username}
                          </Link>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {report.status === 'pending' && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => updateReportStatus(report.id, 'accepted')}>Accept</Button>
                            <Button variant="outline" size="sm" onClick={() => updateReportStatus(report.id, 'rejected')}>Reject</Button>
                          </>
                        )}
                        <Button variant="destructive" size="sm" onClick={() => banUser(report.reported_user_id, report.reason || 'Report accepted', report.id)}>Ban user</Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </List>
          </section>
        )}

        {tab === 'bans' && (
          <section>
            <FilterBar<BanFilter> value={banFilter} options={['all', 'active', 'lifted']} onChange={setBanFilter} />
            <List loading={bLoading} empty="No bans">
              {bannedUsers.map((ban) => (
                <div key={ban.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{ban.user_profile?.username || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">{ban.reason}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{ban.status} · {formatWhen(ban.banned_at)}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => updateBanStatus(ban.id, ban.status === 'active' ? 'lifted' : 'active')}>
                      {ban.status === 'active' ? 'Lift ban' : 'Reinstate'}
                    </Button>
                  </div>
                </div>
              ))}
            </List>
          </section>
        )}

        {tab === 'suggestions' && (
          <List loading={sLoading} empty="No suggestions">
            {suggestions.map((suggestion) => (
              <div key={suggestion.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{suggestion.profile?.username || 'Unknown'}</p>
                    <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{suggestion.content}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{suggestion.read ? 'read' : 'new'} · {formatWhen(suggestion.created_at)}</p>
                  </div>
                  {!suggestion.read && <Button variant="outline" size="sm" onClick={() => markAsRead(suggestion.id)}>Mark read</Button>}
                </div>
              </div>
            ))}
          </List>
        )}
      </main>
    </div>
  );
}

function FilterBar<T extends string>({ value, options, onChange }: {
  value: T;
  options: T[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {options.map((option) => (
        <Button key={option} size="sm" variant={value === option ? 'default' : 'outline'} onClick={() => onChange(option)}>
          {option}
        </Button>
      ))}
    </div>
  );
}

function List({ loading, empty, children }: {
  loading: boolean;
  empty: string;
  children: ReactNode;
}) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  if (loading) return <Loader />;
  if (!hasItems) return <EmptyState label={empty} />;
  return <div className="space-y-2">{children}</div>;
}

function Loader() {
  return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
}

function EmptyState({ label }: { label: string }) {
  return <div className="py-12 text-center text-sm text-muted-foreground">{label}</div>;
}
