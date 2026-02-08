import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { moderateContent, moderateFields, ModerationResult } from '@/utils/contentModeration';

export const useContentModeration = () => {
  const [isChecking, setIsChecking] = useState(false);

  const checkContent = useCallback(async (
    content: Record<string, string | undefined>,
    contentType: 'listing' | 'comment' | 'profile'
  ): Promise<ModerationResult> => {
    setIsChecking(true);
    
    try {
      // Use client-side moderation
      const result = moderateFields(content);

      if (import.meta.env.DEV && result.isBlocked) {
        // Helpful for debugging false positives without affecting production UX
        console.warn('[moderation] blocked', {
          contentType,
          category: result.category,
          field: result.field,
          reason: result.reason,
          content,
        });
      }

      if (result.isBlocked) {
        toast.error(result.reason || "This content couldn't be posted because it violates Flea's community guidelines.");
      }

      return result;
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
