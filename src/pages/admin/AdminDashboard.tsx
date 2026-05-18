import { useState } from 'react';
import { useAdminChatThreads } from '@/hooks/admin/useAdminChatThreads';
import { useAdminChatMessages } from '@/hooks/admin/useAdminChatMessages';
import { useAdminReports } from '@/hooks/admin/useAdminReports';
import { useAdminBannedUsers } from '@/hooks/admin/useAdminBannedUsers';
import { useAdminSuggestions } from '@/hooks/admin/useAdminSuggestions';
import type { ChatThread } from '@/types/admin/chat';
import type { Report } from '@/types/admin/reports';
import { DashboardHeader } from '@/components/admin/dashboard/DashboardHeader';
import { ThreadList } from '@/components/admin/dashboard/ThreadList';
import { ConversationView } from '@/components/admin/dashboard/ConversationView';
import { ReportList } from '@/components/admin/dashboard/ReportList';
import { ReportDetail } from '@/components/admin/dashboard/ReportDetail';
import { BannedUsersList } from '@/components/admin/dashboard/BannedUsersList';
import { SuggestionsList } from '@/components/admin/dashboard/SuggestionsList';
import { WaitlistList } from '@/components/admin/dashboard/WaitlistList';
import { ContactSubmissionsList } from '@/components/admin/dashboard/ContactSubmissionsList';
import { useAdminWaitlist } from '@/hooks/admin/useAdminWaitlist';
import { useAdminContactSubmissions } from '@/hooks/admin/useAdminContactSubmissions';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Flag, ShieldBan, Mailbox, Mail, Inbox } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type Tab = 'support' | 'reports' | 'bans' | 'suggestions' | 'waitlist' | 'contact';

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('support');
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const isMobile = useIsMobile();

  const { threads, loading: tLoading, filter: tFilter, setFilter: setTFilter, updateThreadStatus } = useAdminChatThreads();
  const { messages, loading: mLoading, sending, sendMessage } = useAdminChatMessages(selectedThread?.id || null);
  const { reports, loading: rLoading, filter: rFilter, setFilter: setRFilter, updateReportStatus, pendingCount, reportTallyByUser } = useAdminReports();
  const { bannedUsers, loading: bLoading, filter: bFilter, setFilter: setBFilter, banUser, updateBanStatus, activeCount, liftedCount } = useAdminBannedUsers();
  const { suggestions, loading: sLoading, unreadCount, markAsRead } = useAdminSuggestions();
  const { entries: waitlistEntries, loading: wLoading, error: wError, refresh: refreshWaitlist } = useAdminWaitlist();
  const { submissions: contactSubs, loading: cLoading, error: cError, refresh: refreshContact } = useAdminContactSubmissions();

  const activeThreads = threads.filter((t) => t.status === 'active').length;
  const totalUnread = threads.reduce((s, t) => s + (t.unread_count || 0), 0);
  const resolvedThreads = threads.filter((t) => t.status === 'resolved').length;

  const handleStatus = async (threadId: string, status: 'active' | 'resolved') => {
    await updateThreadStatus(threadId, status);
    if (selectedThread?.id === threadId) setSelectedThread((p) => (p ? { ...p, status } : null));
  };

  const showThreadList = !isMobile || !selectedThread;
  const showConversation = !isMobile || !!selectedThread;
  const showReportList = !isMobile || !selectedReport;
  const showReportDetail = !isMobile || !!selectedReport;

  return (
    <div className="admin-scope flex h-screen flex-col bg-background">
      <DashboardHeader totalThreads={threads.length} activeThreads={activeThreads} resolvedThreads={resolvedThreads} />

      <div className="border-b border-border bg-card px-4">
        <Tabs value={tab} onValueChange={(v) => { setTab(v as Tab); setSelectedThread(null); setSelectedReport(null); }}>
          <TabsList className="h-11 bg-transparent p-0">
            <TabsTrigger value="support" className="gap-2 data-[state=active]:bg-accent">
              <MessageCircle className="h-4 w-4" /><span className="hidden sm:inline">Support</span>
              {totalUnread > 0 && <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">{totalUnread}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2 data-[state=active]:bg-accent">
              <Flag className="h-4 w-4" /><span className="hidden sm:inline">Reports</span>
              {pendingCount > 0 && <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="bans" className="gap-2 data-[state=active]:bg-accent">
              <ShieldBan className="h-4 w-4" /><span className="hidden sm:inline">Bans</span>
              {activeCount > 0 && <Badge variant="secondary" className="h-5 min-w-5 px-1 text-xs">{activeCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="gap-2 data-[state=active]:bg-accent">
              <Mailbox className="h-4 w-4" /><span className="hidden sm:inline">Suggestions</span>
              {unreadCount > 0 && <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">{unreadCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="waitlist" className="gap-2 data-[state=active]:bg-accent">
              <Mail className="h-4 w-4" /><span className="hidden sm:inline">Waitlist</span>
              {waitlistEntries.length > 0 && <Badge variant="secondary" className="h-5 min-w-5 px-1 text-xs">{waitlistEntries.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="contact" className="gap-2 data-[state=active]:bg-accent">
              <Inbox className="h-4 w-4" /><span className="hidden sm:inline">Contact</span>
              {contactSubs.length > 0 && <Badge variant="secondary" className="h-5 min-w-5 px-1 text-xs">{contactSubs.length}</Badge>}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {tab === 'support' && (
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

        {tab === 'reports' && (
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

        {tab === 'bans' && (
          <div className="flex-1">
            <BannedUsersList bannedUsers={bannedUsers} loading={bLoading} filter={bFilter} onFilterChange={setBFilter} onUpdateBanStatus={updateBanStatus} activeCount={activeCount} liftedCount={liftedCount} />
          </div>
        )}

        {tab === 'suggestions' && (
          <div className="flex-1">
            <SuggestionsList suggestions={suggestions} loading={sLoading} onMarkAsRead={markAsRead} />
          </div>
        )}

        {tab === 'waitlist' && (
          <div className="flex-1">
            <WaitlistList entries={waitlistEntries} loading={wLoading} error={wError} onRefresh={refreshWaitlist} />
          </div>
        )}

        {tab === 'contact' && (
          <div className="flex-1">
            <ContactSubmissionsList submissions={contactSubs} loading={cLoading} error={cError} onRefresh={refreshContact} />
          </div>
        )}
      </div>
    </div>
  );
}
