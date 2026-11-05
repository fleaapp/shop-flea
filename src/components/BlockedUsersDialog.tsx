import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export default function BlockedUsersDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Array<{ id: string; username: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const load = async () => {
    if (!user) return;
    setLoading(true); setError(false);
    try {
      const { data, error } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', user.id);
      if (error) throw error;
      const ids = (data ?? []).map(row => row.blocked_id);
      const profiles = ids.length ? await supabase.from('profiles_public').select('user_id,username').in('user_id', ids) : { data: [], error: null };
      if (profiles.error) throw profiles.error;
      setRows(ids.map(id => ({ id, username: profiles.data?.find(p => p.user_id === id)?.username ?? 'Unavailable account' })));
    } catch { setError(true); } finally { setLoading(false); }
  };
  useEffect(() => { if (open) void load(); }, [open, user?.id]);
  const unblock = async (id: string) => {
    if (!user) return;
    setPending(id);
    const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', user.id).eq('blocked_id', id);
    setPending(null);
    if (error) return toast.error('Could not unblock user. Please try again.');
    setRows(prev => prev.filter(row => row.id !== id));
    window.dispatchEvent(new Event('flea:blocks-changed'));
    toast.success('User unblocked.');
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-[340px] rounded-2xl">
      <DialogHeader><DialogTitle>Blocked users</DialogTitle></DialogHeader>
      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : error ? <Button variant="outline" onClick={load}>Try again</Button> : rows.length === 0 ? <p className="text-sm text-muted-foreground">No blocked users.</p> :
        <div className="max-h-[50svh] overflow-y-auto space-y-3">{rows.map(row => <div key={row.id} className="flex items-center gap-3">
          <span className="min-w-0 flex-1 break-words text-sm">{row.username}</span>
          <Button size="sm" variant="outline" disabled={pending !== null} onClick={() => unblock(row.id)}>Unblock</Button>
        </div>)}</div>}
    </DialogContent>
  </Dialog>;
}