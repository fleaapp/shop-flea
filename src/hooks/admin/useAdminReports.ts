import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Report, ReportFilter } from '@/types/admin/reports';
import { useToast } from '@/hooks/use-toast';

export function useAdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReportFilter>('all');
  const { toast } = useToast();

  const fetchReports = useCallback(async () => {
    try {
      let query = (supabase as any).from('reports').select('*').order('created_at', { ascending: false });
      if (filter !== 'all') query = query.eq('status', filter);
      const { data, error } = await query;
      if (error) throw error;

      const enriched = await Promise.all(
        (data || []).map(async (report: any) => {
          const [reportedProfile, reporterProfile] = await Promise.all([
            (supabase as any).from('profiles').select('username, avatar_url').eq('user_id', report.reported_user_id).maybeSingle(),
            (supabase as any).from('profiles').select('username, avatar_url').eq('user_id', report.reporter_user_id).maybeSingle(),
          ]);
          return {
            ...report,
            reported_user_profile: reportedProfile.data || { username: 'Unknown', avatar_url: null },
            reporter_user_profile: reporterProfile.data || { username: 'Unknown', avatar_url: null },
          } as Report;
        })
      );
      setReports(enriched);
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to fetch reports', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [filter, toast]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  useEffect(() => {
    const channel = supabase.channel('admin-reports-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => fetchReports())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchReports]);

  const updateReportStatus = async (id: string, status: 'accepted' | 'rejected', adminNotes?: string) => {
    try {
      const update: Record<string, unknown> = { status };
      if (adminNotes !== undefined) update.admin_notes = adminNotes;
      const { error } = await (supabase as any).from('reports').update(update).eq('id', id);
      if (error) throw error;
      toast({ title: 'Updated', description: `Report ${status}` });
      fetchReports();
    } catch (e) {
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
