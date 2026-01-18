import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Send, MoreHorizontal, Trash2, Flag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
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

interface Comment {
  id: string;
  listing_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: {
    username: string;
    avatar_url: string | null;
  };
}

interface ListingCommentsProps {
  listingId: string;
  sellerId: string;
}

const ListingComments = ({ listingId, sellerId }: ListingCommentsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['listing-comments', listingId],
    queryFn: async () => {
      const { data: commentsData, error } = await supabase
        .from('listing_comments')
        .select('*')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for all comment authors
      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return commentsData.map(comment => ({
        ...comment,
        profile: profileMap.get(comment.user_id) || { username: '@user', avatar_url: null }
      })) as Comment[];
    },
    enabled: isOpen,
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error('Must be logged in');
      
      const { error } = await supabase
        .from('listing_comments')
        .insert({
          listing_id: listingId,
          user_id: user.id,
          content: content.trim(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing-comments', listingId] });
      setNewComment('');
      toast.success('Comment added!');
    },
    onError: () => {
      toast.error('Failed to add comment');
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
      toast.success('Comment deleted');
    },
    onError: () => {
      toast.error('Failed to delete comment');
    },
  });

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    if (!user) {
      toast.error('Please log in to comment');
      return;
    }
    addComment.mutate(newComment);
  };

  const handleReport = (commentId: string) => {
    toast.success('Comment reported. Thank you for helping keep the community safe.');
  };

  const canDeleteComment = (comment: Comment) => {
    if (!user) return false;
    return user.id === comment.user_id || user.id === sellerId;
  };

  return (
    <div className="mt-6">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            className="w-full flex items-center justify-between rounded-2xl border-2 bg-card px-4 py-3 h-auto"
          >
            <span className="font-medium">
              💬 Comments {comments.length > 0 && `(${comments.length})`}
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
            <div className="flex gap-2">
              <Textarea
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[60px] resize-none rounded-xl border-muted-foreground/20 bg-card"
                maxLength={500}
              />
              <Button
                size="icon"
                onClick={handleSubmit}
                disabled={!newComment.trim() || addComment.isPending}
                className="h-[60px] w-12 rounded-xl bg-primary"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              Log in to leave a comment
            </p>
          )}

          {/* Comments List */}
          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No comments yet. Be the first!
            </p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="flex gap-3 rounded-xl bg-card p-3 border border-border"
                >
                  <img
                    src={comment.profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.user_id}`}
                    alt={comment.profile?.username || '@user'}
                    className="h-8 w-8 rounded-full bg-muted flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    {/* Username and timestamp inline */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">
                        {comment.profile?.username || '@user'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    
                    {/* Comment content */}
                    <p className="text-sm text-foreground mt-1 break-words">
                      {comment.content}
                    </p>
                    
                    {/* Reply button */}
                    <button
                      onClick={() => toast.info('Reply feature coming soon!')}
                      className="text-xs text-muted-foreground hover:text-foreground mt-1.5 font-medium"
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
                        className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <MoreHorizontal className="h-4 w-4" />
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
                      <DropdownMenuItem onClick={() => handleReport(comment.id)}>
                        <Flag className="h-4 w-4 mr-2" />
                        Report
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default ListingComments;
