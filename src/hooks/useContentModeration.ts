import { useState, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ModerationResult {
  isBlocked: boolean;
  reason: string | null;
  category: 'profanity' | 'contact' | 'social' | 'url' | null;
  field?: string;
  userBlocked?: boolean;
}

export const useContentModeration = () => {
  const [isChecking, setIsChecking] = useState(false);

  const checkContent = useCallback(async (
    content: Record<string, string | undefined>,
    contentType: 'listing' | 'comment' | 'profile'
  ): Promise<ModerationResult> => {
    setIsChecking(true);
    
    try {
      const { data, error } = await cloudSupabase.functions.invoke('moderate-content', {
        body: { content, contentType },
      });

      if (error) {
        console.error('Moderation check failed:', error);
        // If moderation fails, allow content (fail open for UX, but log for review)
        return { isBlocked: false, reason: null, category: null };
      }

      if (data.isBlocked) {
        toast.error(data.reason || "This content couldn't be posted because it violates Flea's community guidelines.");
      }

      return data as ModerationResult;
    } catch (err) {
      console.error('Moderation error:', err);
      return { isBlocked: false, reason: null, category: null };
    } finally {
      setIsChecking(false);
    }
  }, []);

  const checkListingContent = useCallback(async (listing: {
    title?: string;
    description?: string;
    brand?: string;
  }) => {
    return checkContent(listing, 'listing');
  }, [checkContent]);

  const checkCommentContent = useCallback(async (content: string) => {
    return checkContent({ content }, 'comment');
  }, [checkContent]);

  return {
    isChecking,
    checkContent,
    checkListingContent,
    checkCommentContent,
  };
};
