import { useState, useEffect, useCallback } from 'react';
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

  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  return { reports, topReportedUsers, loading, filter, setFilter, updateReportStatus, pendingCount, refetch: fetchReports };
}
