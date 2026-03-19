import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Send, Image, Flag, Lock } from 'lucide-react';
import RefundSystemMessage from '@/components/RefundSystemMessage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDefaultAvatar } from '@/utils/defaultAvatars';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import ReportDialog from '@/components/ReportDialog';
import { useReporting } from '@/hooks/useReporting';
import { compressImage } from '@/utils/imageCompression';
import { useOrders } from '@/hooks/useOrders';
import { invokeCloudFunction } from '@/utils/cloudFunctions';

interface OrderMessage {
  id: string;
  order_id: string;
  sender_id: string;
  message: string;
  attachment_url: string | null;
  created_at: string;
  read: boolean;
  message_type?: string;
}

const OrderChat = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [refundActioning, setRefundActioning] = useState(false);
  const { openReport, submitPendingReport, closeReport, pendingReport, isReporting } = useReporting();

  const { buyerOrderGroups, sellerOrderGroups } = useOrders();

  // Find the specific order across all groups
  const orderInfo = useMemo(() => {
    if (!orderId || !user?.id) return null;

    for (const group of [...buyerOrderGroups, ...sellerOrderGroups]) {
      const order = group.orders.find(o => o.id === orderId);
      if (order) {
        return {
          buyer_id: group.buyer_id,
          seller_id: group.seller_id,
          delivered_at: order.delivered_at,
          order_number: order.order_number || null,
          buyer_username: group.buyer_profile?.username || 'Buyer',
          seller_username: group.seller_profile?.username || 'Seller',
          buyer_avatar: group.buyer_profile?.avatar_url || null,
          seller_avatar: group.seller_profile?.avatar_url || null,
        };
      }
    }
    return null;
  }, [orderId, user?.id, buyerOrderGroups, sellerOrderGroups]);

  const isReadOnly = useMemo(() => {
    if (!orderInfo?.delivered_at) return false;
    return differenceInDays(new Date(), new Date(orderInfo.delivered_at)) > 10;
  }, [orderInfo?.delivered_at]);

  const otherUserId = orderInfo
    ? user?.id === orderInfo.buyer_id ? orderInfo.seller_id : orderInfo.buyer_id
    : '';
  const otherUsername = orderInfo
    ? user?.id === orderInfo.buyer_id ? orderInfo.seller_username : orderInfo.buyer_username
    : '';
  const otherAvatar = orderInfo
    ? user?.id === orderInfo.buyer_id
      ? orderInfo.seller_avatar || getDefaultAvatar(orderInfo.seller_id)
      : orderInfo.buyer_avatar || getDefaultAvatar(orderInfo.buyer_id)
    : '';

  // Fetch messages
  const { data: messages = [], error: messagesError } = useQuery({
    queryKey: ['order-messages', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await invokeCloudFunction('order-messages', {
        method: 'GET',
        query: { orderId },
      });
      if (error) {
        console.error('[OrderChat] Failed to load messages:', error.message);
        throw error;
      }
      return (((data as { messages?: OrderMessage[] } | null)?.messages) || []) as OrderMessage[];
    },
    enabled: !!orderId,
    refetchInterval: 5000,
    retry: 1,
  });

  // Realtime subscription
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order-messages-${orderId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_messages',
        filter: `order_id=eq.${orderId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['order-messages', orderId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId, queryClient]);

  // Mark messages as read
  useEffect(() => {
    if (!messages.length || !user?.id || !orderId) return;
    const unread = messages.filter(m => !m.read && m.sender_id !== user.id);
    if (!unread.length) return;

    invokeCloudFunction('order-messages', {
      method: 'PATCH',
      query: { orderId },
    }).catch((error) => {
      console.warn('[OrderChat] Failed to mark messages read:', error);
    });
  }, [messages, user?.id, orderId]);

  // Scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const sendMessage = useMutation({
    mutationFn: async ({ message, attachmentUrl }: { message: string; attachmentUrl?: string }) => {
      if (!user?.id || !orderId) throw new Error('Not ready');
      const { data, error } = await invokeCloudFunction('order-messages', {
        method: 'POST',
        query: { orderId },
        body: {
          message: message || '',
          attachment_url: attachmentUrl || null,
        },
      });
      if (error) throw error;
      return (data as { message?: OrderMessage } | null)?.message ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-messages', orderId] });
      setNewMessage('');
    },
    onError: (err) => {
      console.error('Failed to send message:', err);
      toast.error('Failed to send message');
    },
  });

  const handleSend = () => {
    const trimmed = newMessage.trim();
    if (!trimmed || sending) return;
    setSending(true);
    sendMessage.mutate({ message: trimmed }, { onSettled: () => setSending(false) });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id || !orderId) return;
    setSending(true);
    try {
      const compressed = await compressImage(file);
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${orderId}/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('order-attachments').upload(path, compressed);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('order-attachments').getPublicUrl(path);
      sendMessage.mutate({ message: '', attachmentUrl: urlData.publicUrl });
    } catch (err) {
      console.error('Photo upload error:', err);
      toast.error('Failed to upload photo');
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const cleanUsername = (u: string) => u.startsWith('@') ? u.slice(1) : u;

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background px-4 py-3 flex items-center gap-3 border-b border-border">
        <button onClick={() => navigate(-1)}>
          <ChevronLeft className="h-6 w-6 text-foreground" />
        </button>
        <Avatar className="h-8 w-8">
          <AvatarImage src={otherAvatar} />
          <AvatarFallback>{cleanUsername(otherUsername).charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm truncate">@{cleanUsername(otherUsername)}</p>
          <p className="text-xs text-muted-foreground">
            Order #{orderInfo?.order_number || orderId?.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <button onClick={() => openReport('user', otherUserId, otherUserId)} className="p-2">
          <Flag className="h-4 w-4 text-muted-foreground" />
        </button>
      </header>

      {isReadOnly && (
        <div className="bg-muted px-4 py-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" />
          <span>This conversation is now read-only (10+ days since delivery).</span>
        </div>
      )}

      {messagesError && (
        <div className="bg-destructive/10 px-4 py-2 text-sm text-destructive text-center">
          Unable to load messages.
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !messagesError && (
          <p className="text-center text-muted-foreground text-sm mt-8">No messages yet. Start the conversation!</p>
        )}
        {messages.map((msg, msgIndex) => {
          const isMe = msg.sender_id === user?.id;
          const isSystem = msg.message_type && msg.message_type !== 'user';

          if (isSystem) {
            // Determine if seller has responded to this refund request
            const hasSellerResponded = msg.message_type === 'refund_request' && messages.slice(msgIndex + 1).some(
              m => m.message_type === 'refund_rejected' || m.message_type === 'refund_initiated'
            );
            // Show auto-reminder if 4+ days since request with no response
            const showAutoReminder = msg.message_type === 'refund_request' && !hasSellerResponded && (() => {
              const daysSince = (Date.now() - new Date(msg.created_at).getTime()) / (1000 * 60 * 60 * 24);
              return daysSince >= 4;
            })();

            const iAmSeller = user?.id === orderInfo?.seller_id;

            return (
              <RefundSystemMessage
                key={msg.id}
                messageType={msg.message_type!}
                messageContent={msg.message}
                isSeller={!!iAmSeller}
                hasSellerResponded={hasSellerResponded}
                showAutoReminder={showAutoReminder}
                isActioning={refundActioning}
                onReject={async () => {
                  setRefundActioning(true);
                  try {
                    await invokeCloudFunction('order-messages', {
                      method: 'POST',
                      query: { orderId: orderId!, action: 'refund_reject' },
                      body: {},
                    });
                    queryClient.invalidateQueries({ queryKey: ['order-messages', orderId] });
                    queryClient.invalidateQueries({ queryKey: ['refund-status', orderId] });
                    toast.success('Refund request rejected');
                  } catch {
                    toast.error('Failed to reject refund');
                  } finally {
                    setRefundActioning(false);
                  }
                }}
                onRefund={async () => {
                  setRefundActioning(true);
                  try {
                    const { data } = await invokeCloudFunction('order-messages', {
                      method: 'POST',
                      query: { orderId: orderId!, action: 'refund_initiate' },
                      body: {},
                    });
                    queryClient.invalidateQueries({ queryKey: ['order-messages', orderId] });
                    queryClient.invalidateQueries({ queryKey: ['refund-status', orderId] });
                    const pm = (data as { payment_method?: string })?.payment_method || 'stripe';
                    const refundUrl = pm === 'paypal'
                      ? 'https://www.paypal.com/disputes'
                      : 'https://dashboard.stripe.com/payments';
                    window.open(refundUrl, '_blank');
                    toast.success('Refund initiated');
                  } catch {
                    toast.error('Failed to initiate refund');
                  } finally {
                    setRefundActioning(false);
                  }
                }}
              />
            );
          }

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                isMe ? 'bg-charcoal text-white rounded-br-md' : 'bg-card text-foreground rounded-bl-md card-shadow'
              }`}>
                {msg.attachment_url && (
                  <img src={msg.attachment_url} alt="Attachment" className="rounded-xl max-w-full mb-1.5 cursor-pointer"
                    onClick={() => window.open(msg.attachment_url!, '_blank')} />
                )}
                {msg.message && <p className="text-sm leading-relaxed">{msg.message}</p>}
                <p className={`text-[10px] mt-1 ${isMe ? 'text-white/60' : 'text-muted-foreground'}`}>
                  {format(new Date(msg.created_at), 'HH:mm')}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {!isReadOnly && !messagesError && (
        <div className="sticky bottom-0 bg-background border-t border-border px-4 py-3 flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full hover:bg-muted transition-colors" disabled={sending}>
            <Image className="h-5 w-5 text-muted-foreground" />
          </button>
          <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..."
            className="flex-1 rounded-full bg-muted border-none" onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()} disabled={sending} />
          <button onClick={handleSend} disabled={!newMessage.trim() || sending}
            className="p-2 rounded-full bg-charcoal text-white disabled:opacity-40 transition-colors">
            <Send className="h-5 w-5" />
          </button>
        </div>
      )}

      <ReportDialog open={!!pendingReport} onOpenChange={(v) => { if (!v) closeReport(); }}
        onSubmit={submitPendingReport} isSubmitting={isReporting} reportType={pendingReport?.reportType || 'user'} />
    </div>
  );
};

export default OrderChat;
