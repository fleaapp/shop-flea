import { useState, useEffect, useCallback } from 'react';
import { BannedUser, BanFilter } from '@/types/admin/reports';
import { useToast } from '@/hooks/use-toast';
import { callAdminData } from './useAdminData';

export function useAdminBannedUsers() {
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BanFilter>('all');
  const { toast } = useToast();

  const fetchBannedUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdminData<{ bannedUsers: BannedUser[] }>('listBannedUsers', { filter });
      setBannedUsers(data.bannedUsers || []);
    } catch (e) {
      console.error('banned users fetch failed', e);
      toast({ title: 'Error', description: 'Failed to fetch banned users', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [filter, toast]);

  useEffect(() => { fetchBannedUsers(); }, [fetchBannedUsers]);

  const banUser = async (userId: string, reason: string, relatedReportId?: string) => {
    try {
      await callAdminData('banUser', { userId, reason, relatedReportId: relatedReportId || null });
      toast({ title: 'Banned', description: 'User has been banned' });
      fetchBannedUsers();
    } catch (e) {
      console.error('ban user failed', e);
      toast({ title: 'Error', description: 'Failed to ban user', variant: 'destructive' });
    }
  };

  const updateBanStatus = async (banId: string, status: 'active' | 'lifted') => {
    try {
      await callAdminData('updateBanStatus', { banId, status });
      toast({ title: 'Updated', description: status === 'lifted' ? 'Ban lifted' : 'Ban reinstated' });
      fetchBannedUsers();
    } catch (e) {
      console.error('ban update failed', e);
      toast({ title: 'Error', description: 'Failed to update ban', variant: 'destructive' });
    }
  };

  const activeCount = bannedUsers.filter((b) => b.status === 'active').length;
  const liftedCount = bannedUsers.filter((b) => b.status === 'lifted').length;

  return { bannedUsers, loading, filter, setFilter, banUser, updateBanStatus, activeCount, liftedCount, refetch: fetchBannedUsers };
}
