import { useState, useEffect, useCallback, useMemo } from 'react';
import { Report, ReportFilter, TopReportedUser } from '@/types/admin/reports';
import { useToast } from '@/hooks/use-toast';
import { callAdminData } from './useAdminData';

export function useAdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [topReportedUsers, setTopReportedUsers] = useState<TopReportedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReportFilter>('all');
  const { toast } = useToast();

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdminData<{ reports: Report[]; topReportedUsers: TopReportedUser[] }>('listReports', { filter });
      setReports(data.reports || []);
      setTopReportedUsers(data.topReportedUsers || []);
    } catch (e) {
      console.error('reports fetch failed', e);
      toast({ title: 'Error', description: 'Failed to fetch reports', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [filter, toast]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const updateReportStatus = async (id: string, status: 'accepted' | 'rejected', adminNotes?: string) => {
    try {
      await callAdminData('updateReportStatus', { id, status, adminNotes });
      toast({ title: 'Updated', description: `Report ${status}` });
      fetchReports();
    } catch (e) {
      console.error('report update failed', e);
      toast({ title: 'Error', description: 'Failed to update report', variant: 'destructive' });
    }
  };

  const reportTallyByUser = useMemo(() => {
    const map: Record<string, number> = {};
    for (const u of topReportedUsers) map[u.user_id] = u.count;
    // also include any user not in top list, derived from current page
    for (const r of reports) {
      if (!map[r.reported_user_id]) {
        map[r.reported_user_id] = r.reported_user_total_reports ?? 1;
      }
    }
    return map;
  }, [topReportedUsers, reports]);

  const pendingCount = reports.filter((r) => r.status === 'pending').length;
  const acceptedCount = reports.filter((r) => r.status === 'accepted').length;
  const rejectedCount = reports.filter((r) => r.status === 'rejected').length;

  return {
    reports,
    topReportedUsers,
    loading,
    filter,
    setFilter,
    updateReportStatus,
    pendingCount,
    acceptedCount,
    rejectedCount,
    reportTallyByUser,
    refetch: fetchReports,
  };
}
