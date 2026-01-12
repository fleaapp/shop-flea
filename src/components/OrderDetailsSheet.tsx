import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Order, OrderStatus } from '@/hooks/useOrders';
import { format } from 'date-fns';

interface OrderDetailsSheetProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkDelivered?: () => void;
}

const getStatusBadge = (status: OrderStatus) => {
  switch (status) {
    case 'awaiting':
      return { label: 'Awaiting shipping', variant: 'success' as const };
    case 'shipped':
      return { label: 'Shipped', variant: 'secondary' as const };
    case 'delivered':
      return { label: 'Delivered', variant: 'secondary' as const };
  }
};

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-muted-foreground/20 px-4 py-2 text-sm font-medium text-muted-foreground">
    {children}
  </div>
);

const OrderDetailsSheet = ({
  order,
  open,
  onOpenChange,
  onMarkDelivered,
}: OrderDetailsSheetProps) => {
  if (!order) return null;

  const subtotal = order.price + order.shipping_price;
  const buyerFee = subtotal * 0.04;
  const total = subtotal + buyerFee;
  const statusBadge = getStatusBadge(order.status);
  const formattedDate = format(new Date(order.created_at), 'dd/MM/yyyy');

  const sellerUsername = order.seller_profile?.username || 'Unknown';
  const sellerAvatar = order.seller_profile?.avatar_url || '';
  const listingTitle = order.listing?.title || 'Item';
  const listingImage = order.listing?.images?.[0] || '';

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <div className="overflow-y-auto">
          <DrawerHeader className="text-center pb-4">
            <DrawerTitle className="text-xl font-semibold">Order details</DrawerTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Order #{order.id.slice(0, 8).toUpperCase()} • {formattedDate}
            </p>
            <div className="flex justify-center mt-1 mb-2">
              <Badge variant={statusBadge.variant}>
                {statusBadge.label}
              </Badge>
            </div>
          </DrawerHeader>

          <div className="px-4 pb-8 space-y-4">
            {/* Seller Section */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Seller</SectionHeader>
              <div className="flex items-center gap-3 p-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={sellerAvatar} alt={sellerUsername} />
                  <AvatarFallback>{sellerUsername.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-medium">@{sellerUsername}</span>
              </div>
            </div>

            {/* Order Summary Section */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Order Summary</SectionHeader>
              <div>
                <div className="px-4 py-4 space-y-4">
                  <div className="flex gap-4">
                    <img
                      src={listingImage}
                      alt={listingTitle}
                      className="h-20 w-20 rounded-xl object-cover bg-muted"
                    />
                    <div className="flex-1 flex flex-col justify-between">
                      <h3 className="font-semibold text-foreground">{listingTitle}</h3>
                      <div className="text-right">
                        <p className="text-lg font-semibold">${order.price}</p>
                        <p className="text-sm text-muted-foreground">+ ${order.shipping_price} shipping</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fee line */}
                <div className="flex justify-between text-sm px-4 py-3 border-t border-border">
                  <span className="text-muted-foreground">4% buyer fee</span>
                  <span className="text-muted-foreground">+ ${buyerFee.toFixed(2)}</span>
                </div>

                {/* Total */}
                <div className="flex items-center justify-center bg-charcoal text-white py-3 px-4">
                  <span className="font-medium">Total amount paid: ${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Tracking Details Section */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Tracking Details</SectionHeader>
              <div className="p-4 space-y-3">
                <div>
                  <p className="font-semibold text-foreground">Service Provider:</p>
                  <p className="text-muted-foreground">
                    {order.status === 'awaiting' ? 'Awaiting shipping' : (order.tracking_provider || 'N/A')}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Tracking number:</p>
                  <p className="text-muted-foreground">
                    {order.status === 'awaiting' ? 'Awaiting shipping' : (order.tracking_number || 'N/A')}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions - Only show Mark as delivered for shipped orders */}
            {order.status === 'shipped' && (
              <div className="flex flex-col items-center space-y-3 pt-4">
                <Button
                  onClick={onMarkDelivered}
                  className="rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12 px-8"
                >
                  Mark as delivered
                </Button>
                <button className="text-center text-sm text-foreground underline">
                  Need help?
                </button>
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default OrderDetailsSheet;
