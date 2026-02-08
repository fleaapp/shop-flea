import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

type ReportType = 'user' | 'listing' | 'comment';

interface ReportData {
  reportType: ReportType;
  reportedEntityId: string;
  reportedUserId: string;
  reason?: string;
}

export const useReporting = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const submitReport = useMutation({
    mutationFn: async (data: ReportData) => {
      if (!user) throw new Error('Must be logged in to report');

      const { error } = await supabase
        .from('reports')
        .insert({
          report_type: data.reportType,
          reported_entity_id: data.reportedEntityId,
          reported_user_id: data.reportedUserId,
          reporting_user_id: user.id,
          reason: data.reason,
        });

      if (error) {
        if (error.code === '23505') {
          // Unique constraint violation - already reported
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
      
      // Invalidate relevant queries
      if (variables.reportType === 'listing') {
        queryClient.invalidateQueries({ queryKey: ['listing', variables.reportedEntityId] });
      } else if (variables.reportType === 'comment') {
        queryClient.invalidateQueries({ queryKey: ['listing-comments'] });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit report');
    },
  });

  const reportUser = (userId: string, reason?: string) => {
    return submitReport.mutateAsync({
      reportType: 'user',
      reportedEntityId: userId,
      reportedUserId: userId,
      reason,
    });
  };

  const reportListing = (listingId: string, sellerId: string, reason?: string) => {
    return submitReport.mutateAsync({
      reportType: 'listing',
      reportedEntityId: listingId,
      reportedUserId: sellerId,
      reason,
    });
  };

  const reportComment = (commentId: string, authorId: string, reason?: string) => {
    return submitReport.mutateAsync({
      reportType: 'comment',
      reportedEntityId: commentId,
      reportedUserId: authorId,
      reason,
    });
  };

  return {
    reportUser,
    reportListing,
    reportComment,
    isReporting: submitReport.isPending,
  };
};
