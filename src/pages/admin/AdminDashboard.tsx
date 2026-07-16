import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { useAdminChatThreads } from '@/hooks/admin/useAdminChatThreads';
import { useAdminChatMessages } from '@/hooks/admin/useAdminChatMessages';
import { useAdminReports } from '@/hooks/admin/useAdminReports';
import { useAdminBannedUsers } from '@/hooks/admin/useAdminBannedUsers';
import { useAdminSuggestions } from '@/hooks/admin/useAdminSuggestions';
import { useAdminWaitlist } from '@/hooks/admin/useAdminWaitlist';
import { useAdminContactSubmissions } from '@/hooks/admin/useAdminContactSubmissions';
import { useAdminBadges } from '@/hooks/admin/useAdminBadges';
import type { ChatThread } from '@/types/admin/chat';
import type { Report } from '@/types/admin/reports';
import { ThreadList } from '@/components/admin/dashboard/ThreadList';
import { ConversationView } from '@/components/admin/dashboard/ConversationView';
import { ReportList } from '@/components/admin/dashboard/ReportList';
import { ReportDetail } from '@/components/admin/dashboard/ReportDetail';
import { BannedUsersList } from '@/components/admin/dashboard/BannedUsersList';
import { SuggestionsList } from '@/components/admin/dashboard/SuggestionsList';
import { WaitlistList } from '@/components/admin/dashboard/WaitlistList';
import { ContactSubmissionsList } from '@/components/admin/dashboard/ContactSubmissionsList';
import { useIsMobile } from '@/hooks/use-mobile';

type Section =
  | 'support' | 'reports' | 'bans' | 'suggestions' | 'waitlist' | 'contact';

type MenuItem = {
  key: string;
  icon: string;
  label: string;
  route?: string;
  section?: Section;
  badge?: number;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const section = params.get('section') as Section | null;
  const { badges } = useAdminBadges();

  const groups: { title: string; items: MenuItem[] }[] = [
    {
      title: 'Moderation',
      items: [
        { key: 'support', icon: '💬', label: 'Support chats', section: 'support', badge: badges.support },
        { key: 'reports', icon: '🚩', label: 'Reports', section: 'reports', badge: badges.reports },
        { key: 'bans', icon: '⛔️', label: 'Banned users', section: 'bans', badge: badges.bans },
        { key: 'refunds', icon: '↩️', label: 'Refunds & disputes', route: '/admin/refunds', badge: badges.refunds },
      ],
    },
    {
      title: 'Marketplace',
      items: [
        { key: 'listings', icon: '📦', label: 'Listings management', route: '/admin/listings', badge: badges.listings },
        { key: 'brands', icon: '🏷️', label: 'Brand management', route: '/admin/brands', badge: badges.brands },
        { key: 'transactions', icon: '💳', label: 'Transaction dashboard', route: '/admin/transactions', badge: badges.transactions },
      ],
    },
    {
      title: 'Community',
      items: [
        { key: 'users', icon: '👥', label: 'User management', route: '/admin/users', badge: badges.users },
        { key: 'suggestions', icon: '📮', label: 'User suggestions', section: 'suggestions', badge: badges.suggestions },
        { key: 'waitlist', icon: '📬', label: 'Sign ups', section: 'waitlist', badge: badges.waitlist },
        { key: 'contact', icon: '📥', label: 'Contact submissions', section: 'contact', badge: badges.contact },
      ],
    },
    {
      title: 'System',
      items: [
        { key: 'errors', icon: '🛡️', label: 'System diagnostics', route: '/admin/errors' },
      ],
    },
  ];

  if (section) return <SectionView section={section} onBack={() => setParams({})} />;

  return (
    <div className="admin-scope min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 flex items-center gap-2 bg-background px-4 py-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="flex-1 text-center text-xl font-bold">🛡️ Admin</h1>
        <div className="w-8" />
      </header>

      <div className="px-4 space-y-6">
        {groups.map((group) => (
          <div key={group.title}>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">{group.title}</h2>
            <div className="space-y-2">
              {group.items.map((item) => (
                <button
                  key={item.key}
                  onClick={() => item.route ? navigate(item.route) : setParams({ section: item.section! })}
                  className="flex w-full items-center justify-between rounded-2xl bg-card p-4 pl-6 card-shadow"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">{item.icon}</span>
                    <span className="text-base font-medium text-foreground">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!!item.badge && item.badge > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionView({ section, onBack }: { section: Section; onBack: () => void }) {
  const isMobile = useIsMobile();
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const { threads, loading: tLoading, filter: tFilter, setFilter: setTFilter, updateThreadStatus } = useAdminChatThreads();
  const { messages, loading: mLoading, sending, sendMessage } = useAdminChatMessages(selectedThread?.id || null);
  const { reports, loading: rLoading, filter: rFilter, setFilter: setRFilter, updateReportStatus, pendingCount, reportTallyByUser } = useAdminReports();
  const { bannedUsers, loading: bLoading, filter: bFilter, setFilter: setBFilter, banUser, updateBanStatus, activeCount, liftedCount } = useAdminBannedUsers();
  const { suggestions, loading: sLoading, markAsRead } = useAdminSuggestions();
  const { entries: waitlistEntries, loading: wLoading, error: wError, refresh: refreshWaitlist } = useAdminWaitlist();
  const { submissions: contactSubs, loading: cLoading, error: cError, refresh: refreshContact } = useAdminContactSubmissions();

  const handleStatus = async (threadId: string, status: 'active' | 'resolved') => {
    await updateThreadStatus(threadId, status);
    if (selectedThread?.id === threadId) setSelectedThread((p) => (p ? { ...p, status } : null));
  };

  const titles: Record<Section, string> = {
    support: '💬 Support chats',
    reports: '🚩 Reports',
    bans: '⛔️ Banned users',
    suggestions: '📮 Suggestions',
    waitlist: '📬 Sign ups',
    contact: '📥 Contact submissions',
  };

  const showThreadList = !isMobile || !selectedThread;
  const showConversation = !isMobile || !!selectedThread;
  const showReportList = !isMobile || !selectedReport;
  const showReportDetail = !isMobile || !!selectedReport;

  return (
    <div className="admin-scope flex h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-background px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => { setSelectedThread(null); setSelectedReport(null); onBack(); }}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="flex-1 text-center text-lg font-bold">{titles[section]}</h1>
        <div className="w-8" />
      </header>

      <div className="flex flex-1 overflow-hidden">
        {section === 'support' && (
          <>
            {showThreadList && (
              <div className={isMobile ? 'w-full' : 'w-96 shrink-0'}>
                <ThreadList threads={threads} loading={tLoading} selectedThreadId={selectedThread?.id || null} onSelectThread={setSelectedThread} filter={tFilter} onFilterChange={setTFilter} />
              </div>
            )}
            {showConversation && (
              <div className="flex-1">
                <ConversationView thread={selectedThread} messages={messages} loading={mLoading} sending={sending} onSendMessage={sendMessage} onUpdateStatus={handleStatus} onBack={isMobile ? () => setSelectedThread(null) : undefined} />
              </div>
            )}
          </>
        )}
        {section === 'reports' && (
          <>
            {showReportList && (
              <div className={isMobile ? 'w-full' : 'w-96 shrink-0'}>
                <ReportList reports={reports} loading={rLoading} filter={rFilter} onFilterChange={setRFilter} selectedReportId={selectedReport?.id || null} onSelectReport={setSelectedReport} pendingCount={pendingCount} reportTallyByUser={reportTallyByUser} />
              </div>
            )}
            {showReportDetail && (
              <div className="flex-1">
                <ReportDetail report={selectedReport} onUpdateStatus={updateReportStatus} onBanUser={banUser} onBack={isMobile ? () => setSelectedReport(null) : undefined} reportTallyByUser={reportTallyByUser} />
              </div>
            )}
          </>
        )}
        {section === 'bans' && (
          <div className="flex-1">
            <BannedUsersList bannedUsers={bannedUsers} loading={bLoading} filter={bFilter} onFilterChange={setBFilter} onUpdateBanStatus={updateBanStatus} activeCount={activeCount} liftedCount={liftedCount} />
          </div>
        )}
        {section === 'suggestions' && (
          <div className="flex-1">
            <SuggestionsList suggestions={suggestions} loading={sLoading} onMarkAsRead={markAsRead} />
          </div>
        )}
        {section === 'waitlist' && (
          <div className="flex-1">
            <WaitlistList entries={waitlistEntries} loading={wLoading} error={wError} onRefresh={refreshWaitlist} />
          </div>
        )}
        {section === 'contact' && (
          <div className="flex-1">
            <ContactSubmissionsList submissions={contactSubs} loading={cLoading} error={cError} onRefresh={refreshContact} />
          </div>
        )}
      </div>
    </div>
  );
}
