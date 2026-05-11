import { useState, useEffect, useCallback } from 'react';
import { Report, ReportFilter } from '@/types/admin/reports';
import { useToast } from '@/hooks/use-toast';
import { callAdminData } from './useAdminData';

export function useAdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReportFilter>('all');
  const { toast } = useToast();

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdminData<{ reports: Report[] }>('listReports', { filter });
      setReports(data.reports || []);
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
  const reportTallyByUser = reports.reduce<Record<string, number>>((acc, r) => {
    acc[r.reported_user_id] = (acc[r.reported_user_id] || 0) + 1;
    return acc;
  }, {});

  return { reports, loading, filter, setFilter, updateReportStatus, pendingCount, reportTallyByUser, refetch: fetchReports };
}
