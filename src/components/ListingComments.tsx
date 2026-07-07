import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Send, MoreHorizontal, Trash2, Flag, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useGuestMode } from '@/context/GuestModeContext';
import { getDefaultAvatar } from '@/utils/defaultAvatars';
import { getAvatarUrl } from '@/utils/optimizedImage';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useReporting } from '@/hooks/useReporting';
import ReportDialog from '@/components/ReportDialog';
import { useContentModeration } from '@/hooks/useContentModeration';
import { useBlockedStatus } from '@/hooks/useBlockedStatus';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { sendPushNotification } from '@/utils/pushNotify';

interface Comment {
  id: string;
  listing_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  profile?: {
    username: string;
    avatar_url: string | null;
  };
  replies?: Comment[];
}

interface ListingCommentsProps {
  listingId: string;
  sellerId: string;
  onComposerFocusChange?: (isFocused: boolean) => void;
}

const ListingComments = ({ listingId, sellerId, onComposerFocusChange }: ListingCommentsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const { user, profile } = useAuth();
  const { requireAuth } = useGuestMode();
  const queryClient = useQueryClient();
  const { openReport, submitPendingReport, closeReport, pendingReport, isReporting } = useReporting();
  const { checkCommentContent, isChecking } = useContentModeration();
  const { isBlocked } = useBlockedStatus();

  useEffect(() => {
    return () => {
      onComposerFocusChange?.(false);
    };
  }, [onComposerFocusChange]);

  const handleComposerFocus = () => {
    onComposerFocusChange?.(true);
  };

  const handleComposerBlur = () => {
    requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      const isStillWithinComposer = !!(activeElement instanceof Node && composerRef.current?.contains(activeElement));
      onComposerFocusChange?.(isStillWithinComposer);
    });
  };

  // Always fetch comment count (for badge visibility when collapsed)
  const { data: commentCount = 0 } = useQuery({
    queryKey: ['listing-comments-count', listingId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('listing_comments')
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', listingId);

      if (error) throw error;
      return count || 0;
    },
  });

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['listing-comments', listingId],
    queryFn: async () => {
      const { data: commentsData, error } = await supabase
        .from('listing_comments')
        .select('*')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: true })
        .limit(500);

      if (error) throw error;

      // Fetch profiles for all comment authors
      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, username, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const commentsWithProfiles = commentsData.map(comment => ({
        ...comment,
        profile: profileMap.get(comment.user_id) || { username: '@user', avatar_url: null }
      })) as Comment[];

      // Organize into threads - collect all replies under their root parent
      const parentComments = commentsWithProfiles.filter(c => !c.parent_id);
      const allReplies = commentsWithProfiles.filter(c => c.parent_id);

      // Build a map to find root parent for any comment
      const commentMap = new Map(commentsWithProfiles.map(c => [c.id, c]));
      
      const findRootParent = (comment: Comment): string | null => {
        if (!comment.parent_id) return comment.id;
        const parent = commentMap.get(comment.parent_id);
        if (!parent) return comment.parent_id; // parent_id points to root
        if (!parent.parent_id) return parent.id; // parent is root
        return findRootParent(parent); // recurse up
      };

      return parentComments.map(parent => ({
        ...parent,
        replies: allReplies
          .filter(r => findRootParent(r) === parent.id)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      })).reverse(); // Newest first for parent comments
    },
    enabled: isOpen,
  });

  // Fetch users for @mention autocomplete
  const { data: mentionUsers = [] } = useQuery({
    queryKey: ['mention-users', mentionQuery],
    queryFn: async () => {
      if (!mentionQuery || mentionQuery.length < 1) return [];
      const { data, error } = await supabase
        .from('profiles_public')
        .select('user_id, username, avatar_url')
        .ilike('username', `%${mentionQuery}%`)
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: mentionQuery !== null && mentionQuery.length >= 1,
  });

  // Handle text input and detect @mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setNewComment(value);
    setCursorPosition(cursorPos);

    // Detect @mention
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  // Insert selected mention
  const insertMention = (username: string) => {
    const textBeforeCursor = newComment.slice(0, cursorPosition);
    const textAfterCursor = newComment.slice(cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const beforeMention = textBeforeCursor.slice(0, mentionMatch.index);
      // Username may already have @ prefix - strip it to avoid @@
      const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
      const newText = `${beforeMention}@${cleanUsername} ${textAfterCursor}`;
      setNewComment(newText);
      setMentionQuery(null);
      
      // Focus back on textarea
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = beforeMention.length + cleanUsername.length + 2;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  // Handle keyboard navigation in mention dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && mentionUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => Math.min(prev + 1, mentionUsers.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionUsers[mentionIndex].username);
      } else if (e.key === 'Escape') {
        setMentionQuery(null);
      }
    }
  };

  const addComment = useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId?: string }) => {
      if (!user) throw new Error('Must be logged in');

      // Check if user is blocked
      if (isBlocked) {
        throw new Error('Your account is restricted. You cannot post comments.');
      }
      
      // Check content moderation
      const moderationResult = await checkCommentContent(content);
      if (moderationResult.isBlocked) {
        throw new Error(moderationResult.reason || 'Content blocked');
      }

      const trimmedContent = content.trim();
      
      const { error } = await supabase
        .from('listing_comments')
        .insert({
          listing_id: listingId,
          user_id: user.id,
          content: trimmedContent,
          parent_id: parentId || null,
        });

      if (error) throw error;

      // Send push notifications for comment/reply (fire-and-forget)
      const pushPromises: Promise<void>[] = [];

      // Notify listing owner about new comment (if not the commenter)
      if (sellerId !== user.id) {
        pushPromises.push(
          sendPushNotification(sellerId, {
            type: parentId ? 'new_comment' : 'new_comment',
            title: 'New Comment',
            message: `${profile?.username || '@user'} commented on your listing.`,
            related_listing_id: listingId,
          })
        );
      }

      // Notify parent comment author about reply (if different from listing owner and commenter)
      if (parentId) {
        const allCachedComments = queryClient.getQueryData<Comment[]>(['listing-comments', listingId]);
        let parentAuthorId: string | undefined;
        if (allCachedComments) {
          for (const c of allCachedComments) {
            if (c.id === parentId) { parentAuthorId = c.user_id; break; }
            const reply = c.replies?.find(r => r.id === parentId);
            if (reply) { parentAuthorId = reply.user_id; break; }
          }
        }
        if (parentAuthorId && parentAuthorId !== user.id && parentAuthorId !== sellerId) {
          pushPromises.push(
            sendPushNotification(parentAuthorId, {
              type: 'comment_reply',
              title: 'Reply',
              message: `${profile?.username || '@user'} replied to your comment.`,
              related_listing_id: listingId,
            })
          );
        }
      }

      Promise.all(pushPromises).catch(() => {});

      // Handle @mentions
      const mentionHandles = Array.from(
        new Set(
          (trimmedContent.match(/@[\w]+/g) ?? [])
            .map((mention) => mention.replace(/^@/, '').trim().toLowerCase())
            .filter(Boolean)
        )
      ).slice(0, 10);

      if (mentionHandles.length > 0) {
        try {
          const { error: mentionError } = await invokeCloudFunction('comment-mentions', {
            listingId,
            content: trimmedContent,
          });

          if (mentionError) throw mentionError;
        } catch (notifError) {
          console.error('Failed to send mention notifications:', notifError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing-comments', listingId] });
      queryClient.invalidateQueries({ queryKey: ['listing-comments-count', listingId] });
      setNewComment('');
      setReplyingTo(null);
      toast.success(replyingTo ? 'Reply added!' : 'Comment added!');
    },
    onError: (error: Error) => {
      // Don't show duplicate toast if moderation already showed one
      if (!error.message.includes('Content blocked')) {
        toast.error(error.message || 'Failed to add comment');
      }
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from('listing_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing-comments', listingId] });
      queryClient.invalidateQueries({ queryKey: ['listing-comments-count', listingId] });
      toast.success('💬 Comment deleted');
    },
    onError: () => {
      toast.error('💬 Failed to delete comment');
    },
  });

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    if (!requireAuth()) return;
    if (!user) return;
    if (isBlocked) {
      toast.error('Your account is restricted. You cannot post comments.');
      return;
    }
    addComment.mutate({ content: newComment, parentId: replyingTo?.id });
  };

  const handleReport = (comment: Comment) => {
    openReport('comment', comment.id, comment.user_id);
  };

  const canDeleteComment = (comment: Comment) => {
    if (!user) return false;
    return user.id === comment.user_id || user.id === sellerId;
  };

  const handleReply = (comment: Comment) => {
    if (!requireAuth()) return;
    setReplyingTo({ id: comment.id, username: comment.profile?.username || '@user' });
  };

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => (
    <div className={`flex gap-3 ${isReply ? 'ml-8 mt-2' : ''}`}>
      <img
        src={getAvatarUrl(comment.profile?.avatar_url) || getDefaultAvatar(comment.user_id)}
        alt={comment.profile?.username || '@user'}
        className={`rounded-full bg-muted flex-shrink-0 ${isReply ? 'h-6 w-6' : 'h-8 w-8'}`}
      />
      <div className="flex-1 min-w-0">
        {/* Username and timestamp inline */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-bold text-foreground underline ${isReply ? 'text-xs' : 'text-sm'}`}>
            {comment.profile?.username || '@user'}
          </span>
          <span className={`text-muted-foreground ${isReply ? 'text-[10px]' : 'text-xs'}`}>
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
        </div>
        
        {/* Comment content with @mentions as clickable links */}
        <p className={`text-foreground mt-0.5 break-words ${isReply ? 'text-xs' : 'text-sm'}`}>
          {comment.content.split(/(@\w+)/g).map((part, i) => 
            part.startsWith('@') ? (
              <Link 
                key={i} 
                to={profile?.username && part.slice(1).toLowerCase() === profile.username.toLowerCase() ? '/profile' : `/seller/${encodeURIComponent(part)}`}
                className="text-foreground font-bold underline hover:opacity-80"
                onClick={(e) => e.stopPropagation()}
              >
                {part}
              </Link>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </p>
        
        {/* Reply button - for all comments */}
        <button
          onClick={() => handleReply(comment)}
          className="text-xs text-muted-foreground hover:text-foreground mt-1 font-medium"
        >
          Reply
        </button>
      </div>
      
      {/* 3-dot menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`flex-shrink-0 text-muted-foreground hover:text-foreground ${isReply ? 'h-6 w-6' : 'h-8 w-8'}`}
          >
            <MoreHorizontal className={isReply ? 'h-3 w-3' : 'h-4 w-4'} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {canDeleteComment(comment) && (
            <DropdownMenuItem
              onClick={() => deleteComment.mutate(comment.id)}
              disabled={deleteComment.isPending}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </DropdownMenuItem>
          )}
          <DropdownMenuItem 
            onClick={() => handleReport(comment)}
            disabled={isReporting}
          >
            <Flag className="h-4 w-4 mr-2" />
            Report
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="mt-6">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            className="w-full flex items-center justify-between rounded-2xl border-2 bg-card px-4 py-3 h-auto"
          >
            <span className="font-bold">
              💬 Comments {commentCount > 0 && `(${commentCount})`}
            </span>
            {isOpen ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3 space-y-3">
          {/* Comment Input */}
          {user ? (
            <div className="space-y-2">
              {replyingTo && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                  <span>Replying to <span className="font-medium text-foreground">{replyingTo.username}</span></span>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="ml-auto hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div ref={composerRef} className="relative flex gap-2">
                <div className="relative flex-1">
                  <Textarea
                    ref={textareaRef}
                    placeholder={replyingTo ? `Reply to ${replyingTo.username}...` : "Write a comment... (use @ to mention)"}
                    value={newComment}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={handleComposerFocus}
                    onBlur={handleComposerBlur}
                    className="min-h-[60px] resize-none rounded-xl border-muted-foreground/20 bg-card"
                    maxLength={500}
                  />

                  {/* @mention autocomplete dropdown */}
                  {mentionQuery !== null && mentionUsers.length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 z-50 mb-1 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                      {mentionUsers.map((mentionUser, idx) => (
                        <button
                          key={mentionUser.user_id}
                          onClick={() => insertMention(mentionUser.username)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 ${
                            idx === mentionIndex ? 'bg-muted/50' : ''
                          }`}
                        >
                          <img
                            src={getAvatarUrl(mentionUser.avatar_url) || getDefaultAvatar(mentionUser.user_id)}
                            alt={mentionUser.username}
                            className="h-6 w-6 rounded-full bg-muted"
                          />
                          <span className="font-medium">{mentionUser.username}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  size="icon"
                  onClick={handleSubmit}
                  disabled={!newComment.trim() || addComment.isPending || isChecking || isBlocked}
                  className="h-[60px] w-12 rounded-xl bg-primary"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
              {isBlocked && (
                <p className="text-center text-xs text-destructive">
                  Your account is restricted and cannot post comments.
                </p>
              )}
            </div>
          ) : (
            <p className="py-2 text-center text-sm text-muted-foreground">
              <button
                onClick={() => {
                  requireAuth();
                  navigate('/auth', { state: { initialTab: 'login' } });
                }}
                className="font-semibold underline underline-offset-4 decoration-1 text-foreground"
              >
                Log In
              </button>{' '}
              <span className="font-normal">or</span>{' '}
              <button
                onClick={() => {
                  requireAuth();
                  navigate('/auth', { state: { initialTab: 'signup' } });
                }}
                className="font-semibold underline underline-offset-4 decoration-1 text-foreground"
              >
                Sign Up
              </button>{' '}
              to comment.
            </p>
          )}

          {/* Comments List */}
          {isLoading ? (
            <div className="flex justify-center py-4">
              <span className="text-4xl">⏳</span>
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No comments yet. Be the first!
            </p>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-xl bg-card p-3 border border-border"
                >
                  <CommentItem comment={comment} />
                  
                  {/* Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-2 space-y-2 ml-[15px] border-l-2 border-muted pl-2">
                      {comment.replies.map((reply) => (
                        <CommentItem key={reply.id} comment={reply} isReply />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
      <ReportDialog
        open={!!pendingReport}
        onOpenChange={(v) => { if (!v) closeReport(); }}
        onSubmit={submitPendingReport}
        isSubmitting={isReporting}
        reportType={pendingReport?.reportType || 'comment'}
      />
    </div>
  );
};

export default ListingComments;
