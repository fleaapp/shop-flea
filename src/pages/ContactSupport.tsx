import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import BottomNav from '@/components/BottomNav';
import NewChatForm from '@/components/NewChatForm';
import { useUnreadSupport } from '@/hooks/useUnreadSupport';
interface ChatThread {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
}
const ContactSupport = () => {
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const {
    getThreadUnread
  } = useUnreadSupport();
  useEffect(() => {
    if (!user) return;
    const fetchThreads = async () => {
      const {
        data
      } = await (supabase as any).from('chat_threads').select('*').eq('user_id', user.id).order('updated_at', {
        ascending: false
      });
      setThreads(data || []);
      setLoading(false);
    };
    fetchThreads();
  }, [user, newChatOpen]);
  return <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background px-4 py-4 flex items-center">
        <button onClick={() => navigate('/settings')} className="text-foreground absolute left-4">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-bold text-foreground text-center w-full">Contact Support</h1>
      </header>

      <div className="px-4 space-y-4">
        {/* New Chat Button */}
        <div className="flex justify-center">
          <button onClick={() => setNewChatOpen(true)} className="w-56 rounded-full text-white font-bold py-4 text-sm transition-colors flex items-center justify-center gap-2 bg-[#a6a6a6]">
            <span>💬</span> Start a New Chat
          </button>
        </div>

        {/* Thread List */}
        {loading ? <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-card animate-pulse" />)}
          </div> : threads.length === 0 ? <div className="text-center py-12">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-sm text-muted-foreground">
              You don't have any previous chats.
              <br />
              Tap "Start a New Chat" to get help.
            </p>
          </div> : <div className="space-y-2">
            {threads.map(thread => <div key={thread.id} onClick={() => navigate(`/contact-support/${thread.id}`)} className="flex items-center justify-between rounded-2xl bg-card p-4 card-shadow cursor-pointer">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm font-semibold text-foreground truncate">{thread.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(thread.updated_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getThreadUnread(thread.id) > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                      {getThreadUnread(thread.id)}
                    </span>}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${thread.status === 'active' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {thread.status === 'active' ? 'Active' : 'Resolved'}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>)}
          </div>}
      </div>

      <NewChatForm open={newChatOpen} onOpenChange={setNewChatOpen} />
      <BottomNav />
    </div>;
};
export default ContactSupport;