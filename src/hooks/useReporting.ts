import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

type ReportType = 'user' | 'listing' | 'comment';

interface ReportTarget {
  reportType: ReportType;
  entityId: string;
  ownerId: string;
}

export const useReporting = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pendingReport, setPendingReport] = useState<ReportTarget | null>(null);

  const submitReport = useMutation({
    mutationFn: async ({ reportType, entityId, ownerId, reason }: ReportTarget & { reason: string }) => {
      if (!user) throw new Error('Must be logged in to report');

      const { error } = await supabase
        .from('reports')
        .insert({
          report_type: reportType,
          reported_entity_id: entityId,
          reported_user_id: ownerId,
          reporting_user_id: user.id,
          reason,
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error('You have already reported this content');
        }
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      const messages: Record<ReportType, string> = {
        user: 'User reported. Thank you for helping keep Flea safe.',
        listing: 'Listing reported. We\'ll review it shortly.',
        comment: 'Comment reported. Thank you for helping keep the community safe.',
      };
      toast.success(messages[variables.reportType]);
      setPendingReport(null);

      if (variables.reportType === 'listing') {
        queryClient.invalidateQueries({ queryKey: ['listing', variables.entityId] });
      } else if (variables.reportType === 'comment') {
        queryClient.invalidateQueries({ queryKey: ['listing-comments'] });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit report');
    },
  });

  const openReport = (reportType: ReportType, entityId: string, ownerId: string) => {
    if (!user) {
      toast.error('Please log in to report');
      return;
    }
    setPendingReport({ reportType, entityId, ownerId });
  };

  const submitPendingReport = (reason: string) => {
    if (!pendingReport) return;
    submitReport.mutate({ ...pendingReport, reason });
  };

  const closeReport = () => setPendingReport(null);

  return {
    openReport,
    submitPendingReport,
    closeReport,
    pendingReport,
    isReporting: submitReport.isPending,
  };
};
