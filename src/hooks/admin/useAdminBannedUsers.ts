import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BannedUser, BanFilter } from '@/types/admin/reports';
import { useToast } from '@/hooks/use-toast';

export function useAdminBannedUsers() {
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BanFilter>('all');
  const { toast } = useToast();

  const fetchBannedUsers = useCallback(async () => {
    try {
      let query = supabase.from('banned_users').select('*').order('banned_at', { ascending: false });
      if (filter !== 'all') query = query.eq('status', filter);
      const { data, error } = await query;
      if (error) throw error;

      const enriched = await Promise.all(
        (data || []).map(async (ban: any) => {
          const { data: profile } = await supabase.from('profiles')
            .select('username, avatar_url').eq('user_id', ban.user_id).maybeSingle();
          let related = null;
          if (ban.related_report_id) {
            const { data: r } = await supabase.from('reports').select('*').eq('id', ban.related_report_id).maybeSingle();
            related = r;
          }
          return {
            ...ban,
            user_profile: profile || { username: 'Unknown', avatar_url: null },
            related_report: related,
          } as BannedUser;
        })
      );
      setBannedUsers(enriched);
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to fetch banned users', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [filter, toast]);

  useEffect(() => { fetchBannedUsers(); }, [fetchBannedUsers]);

  useEffect(() => {
    const channel = supabase.channel('admin-banned-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'banned_users' }, () => fetchBannedUsers())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchBannedUsers]);

  const banUser = async (userId: string, reason: string, relatedReportId?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('banned_users').insert({
        user_id: userId, reason, related_report_id: relatedReportId || null,
        banned_by: user.id, status: 'active',
      });
      if (error) throw error;
      // Mirror to profiles.status for catalog/RLS effects
      await supabase.from('profiles').update({ status: 'blocked' }).eq('user_id', userId);
      toast({ title: 'Banned', description: 'User has been banned' });
      fetchBannedUsers();
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to ban user', variant: 'destructive' });
    }
  };

  const updateBanStatus = async (banId: string, status: 'active' | 'lifted') => {
    try {
      const update: Record<string, unknown> = { status };
      update.lifted_at = status === 'lifted' ? new Date().toISOString() : null;
      const { data: ban } = await supabase.from('banned_users').select('user_id').eq('id', banId).maybeSingle();
      const { error } = await supabase.from('banned_users').update(update).eq('id', banId);
      if (error) throw error;
      if (ban?.user_id) {
        await supabase.from('profiles').update({ status: status === 'lifted' ? 'active' : 'blocked' }).eq('user_id', ban.user_id);
      }
      toast({ title: 'Updated', description: status === 'lifted' ? 'Ban lifted' : 'Ban reinstated' });
      fetchBannedUsers();
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to update ban', variant: 'destructive' });
    }
  };

  const activeCount = bannedUsers.filter((b) => b.status === 'active').length;
  const liftedCount = bannedUsers.filter((b) => b.status === 'lifted').length;

  return { bannedUsers, loading, filter, setFilter, banUser, updateBanStatus, activeCount, liftedCount, refetch: fetchBannedUsers };
}
