import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type OrderStatus = 'awaiting' | 'shipped' | 'delivered';

interface OrderItem {
  id: string;
  title: string;
  image: string;
  price: number;
  shippingPrice: number;
}

interface OrderDetails {
  id: string;
  orderNumber: string;
  date: string;
  status: OrderStatus;
  seller: {
    username: string;
    avatar: string;
  };
  items: OrderItem[];
  shippingDetails: {
    name: string;
    address: string;
  };
  trackingDetails: {
    serviceProvider: string;
    trackingNumber: string;
  };
}

interface OrderDetailsSheetProps {
  order: OrderDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkDelivered?: () => void;
}

const getStatusBadge = (status: OrderStatus) => {
  switch (status) {
    case 'awaiting':
      return {
        label: 'Awaiting shipping',
        variant: 'success' as const,
      };
    case 'shipped':
      return {
        label: 'Shipped',
        variant: 'secondary' as const,
      };
    case 'delivered':
      return {
        label: 'Delivered',
        variant: 'success' as const,
      };
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

  const subtotal = order.items.reduce((acc, item) => acc + item.price + item.shippingPrice, 0);
  const buyerFee = subtotal * 0.04;
  const total = subtotal + buyerFee;
  const statusBadge = getStatusBadge(order.status);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <div className="overflow-y-auto">
          <DrawerHeader className="text-center pb-4">
            <DrawerTitle className="text-xl font-semibold">Order details</DrawerTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Order #{order.orderNumber} • {order.date}
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
                  <AvatarImage src={order.seller.avatar} alt={order.seller.username} />
                  <AvatarFallback>{order.seller.username.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-medium">@{order.seller.username}</span>
              </div>
            </div>

            {/* Order Summary Section */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Order Summary</SectionHeader>
              <div>
                <div className="px-4 py-4 space-y-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-20 w-20 rounded-xl object-cover bg-muted"
                      />
                      <div className="flex-1 flex flex-col justify-between">
                        <h3 className="font-semibold text-foreground">{item.title}</h3>
                        <div className="text-right">
                          <p className="text-lg font-semibold">${item.price}</p>
                          <p className="text-sm text-muted-foreground">+ ${item.shippingPrice} shipping</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Fee line - full width divider */}
                <div className="flex justify-between text-sm px-4 py-3 border-t border-border">
                  <span className="text-muted-foreground">4% buyer fee</span>
                  <span className="text-muted-foreground">+ ${buyerFee.toFixed(2)}</span>
                </div>

                {/* Total - full width bar */}
                <div className="flex items-center justify-center bg-charcoal text-white py-3 px-4">
                  <span className="font-medium">Total amount paid: ${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Shipping Details Section */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Shipping Details</SectionHeader>
              <div className="p-4 space-y-3">
                <div>
                  <p className="font-semibold text-foreground">Name:</p>
                  <p className="text-muted-foreground">{order.shippingDetails.name}</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Shipping address:</p>
                  <p className="text-muted-foreground">{order.shippingDetails.address}</p>
                </div>
              </div>
            </div>

            {/* Tracking Details Section */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Tracking Details</SectionHeader>
              <div className="p-4 space-y-3">
                <div>
                  <p className="font-semibold text-foreground">Service Provider:</p>
                  <p className="text-muted-foreground">{order.trackingDetails.serviceProvider}</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Tracking number:</p>
                  <p className="text-muted-foreground">{order.trackingDetails.trackingNumber}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            {order.status !== 'delivered' && (
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
export type { OrderDetails, OrderItem, OrderStatus };
