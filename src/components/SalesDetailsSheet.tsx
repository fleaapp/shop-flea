import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useState } from 'react';

type SaleStatus = 'awaiting' | 'shipped' | 'delivered';

interface SaleItem {
  id: string;
  title: string;
  image: string;
  price: number;
  shippingPrice: number;
}

interface SaleDetails {
  id: string;
  orderNumber: string;
  date: string;
  status: SaleStatus;
  buyer: {
    username: string;
    avatar: string;
  };
  items: SaleItem[];
  shippingDetails: {
    name: string;
    address: string;
  };
  trackingDetails: {
    serviceProvider: string;
    trackingNumber: string;
  };
}

interface SalesDetailsSheetProps {
  sale: SaleDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkShipped?: (trackingDetails: { serviceProvider: string; trackingNumber: string }) => void;
}

const getStatusBadge = (status: SaleStatus) => {
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
        variant: 'secondary' as const,
      };
  }
};

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-muted-foreground/20 px-4 py-2 text-sm font-medium text-muted-foreground">
    {children}
  </div>
);

const SalesDetailsSheet = ({
  sale,
  open,
  onOpenChange,
  onMarkShipped,
}: SalesDetailsSheetProps) => {
  const [serviceProvider, setServiceProvider] = useState(sale?.trackingDetails.serviceProvider || '');
  const [trackingNumber, setTrackingNumber] = useState(sale?.trackingDetails.trackingNumber || '');

  if (!sale) return null;

  const subtotal = sale.items.reduce((acc, item) => acc + item.price + item.shippingPrice, 0);
  const sellerFee = subtotal * 0.04;
  const youReceived = subtotal - sellerFee;
  const statusBadge = getStatusBadge(sale.status);

  const handleMarkShipped = () => {
    onMarkShipped?.({ serviceProvider, trackingNumber });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <div className="overflow-y-auto">
          <DrawerHeader className="text-center pb-4">
            <DrawerTitle className="text-xl font-semibold">Sale details</DrawerTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Order #{sale.orderNumber} • {sale.date}
            </p>
            <div className="flex justify-center mt-1 mb-2">
              <Badge variant={statusBadge.variant}>
                {statusBadge.label}
              </Badge>
            </div>
          </DrawerHeader>

          <div className="px-4 pb-8 space-y-4">
            {/* Buyer Section */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Buyer</SectionHeader>
              <div className="flex items-center gap-3 p-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={sale.buyer.avatar} alt={sale.buyer.username} />
                  <AvatarFallback>{sale.buyer.username.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-medium">@{sale.buyer.username}</span>
              </div>
            </div>

            {/* Order Summary Section */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Order Summary</SectionHeader>
              <div>
                <div className="px-4 py-4 space-y-4">
                  {sale.items.map((item) => (
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
                  <span className="text-muted-foreground">4% seller fee</span>
                  <span className="text-muted-foreground">- ${sellerFee.toFixed(2)}</span>
                </div>

                {/* Total - full width bar */}
                <div className="flex items-center justify-center bg-charcoal text-white py-3 px-4">
                  <span className="font-medium">You received: ${youReceived.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Shipping Details Section */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Shipping Details</SectionHeader>
              <div className="p-4 space-y-3">
                <div>
                  <p className="font-semibold text-foreground">Name:</p>
                  <p className="text-muted-foreground">{sale.shippingDetails.name}</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Shipping address:</p>
                  <p className="text-muted-foreground">{sale.shippingDetails.address}</p>
                </div>
              </div>
            </div>

            {/* Tracking Details Section - Editable */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Tracking Details</SectionHeader>
              <div className="p-4 space-y-3">
                <div>
                  <p className="font-semibold text-foreground mb-1.5">Service Provider:</p>
                  <Input
                    value={serviceProvider}
                    onChange={(e) => setServiceProvider(e.target.value)}
                    placeholder="e.g. Royal Mail, DPD, Evri"
                    className="bg-background"
                  />
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1.5">Tracking number:</p>
                  <Input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Enter tracking number"
                    className="bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            {sale.status !== 'delivered' && (
              <div className="flex flex-col items-center space-y-3 pt-4">
                <Button
                  onClick={handleMarkShipped}
                  className="rounded-full bg-charcoal text-white hover:bg-charcoal-light h-12 px-8"
                >
                  Mark as shipped
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

export default SalesDetailsSheet;
export type { SaleDetails, SaleItem, SaleStatus };
