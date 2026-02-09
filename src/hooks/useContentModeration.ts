import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { moderateContent, moderateFields, ModerationResult, ModerationOptions } from '@/utils/contentModeration';

export const useContentModeration = () => {
  const [isChecking, setIsChecking] = useState(false);

  const checkContent = useCallback(async (
    content: Record<string, string | undefined>,
    contentType: 'listing' | 'comment' | 'profile',
    options?: ModerationOptions
  ): Promise<ModerationResult> => {
    setIsChecking(true);
    
    try {
      // Use client-side moderation with options
      const result = moderateFields(content, options);

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
    // Allow @mentions in comments
    return checkContent({ content }, 'comment', { allowMentions: true });
  }, [checkContent]);

  return {
    isChecking,
    checkContent,
    checkListingContent,
    checkCommentContent,
  };
};
