import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { Order, OrderStatus } from '@/hooks/useOrders';
import { format } from 'date-fns';

interface SalesDetailsSheetProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkShipped?: (trackingDetails: { serviceProvider: string; trackingNumber: string }) => void;
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

const SalesDetailsSheet = ({
  order,
  open,
  onOpenChange,
  onMarkShipped,
}: SalesDetailsSheetProps) => {
  const [serviceProvider, setServiceProvider] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [validationError, setValidationError] = useState('');

  // Reset form when order changes
  useEffect(() => {
    if (order) {
      setServiceProvider(order.tracking_provider || '');
      setTrackingNumber(order.tracking_number || '');
      setValidationError('');
    }
  }, [order]);

  if (!order) return null;

  const subtotal = order.price + order.shipping_price;
  const sellerFee = subtotal * 0.04;
  const youReceived = subtotal - sellerFee;
  const statusBadge = getStatusBadge(order.status);
  const formattedDate = format(new Date(order.created_at), 'dd/MM/yyyy');

  const handleMarkShipped = () => {
    // Validate tracking details
    if (!serviceProvider.trim()) {
      setValidationError('Please enter a service provider');
      return;
    }
    if (!trackingNumber.trim()) {
      setValidationError('Please enter a tracking number');
      return;
    }
    setValidationError('');
    onMarkShipped?.({ serviceProvider: serviceProvider.trim(), trackingNumber: trackingNumber.trim() });
  };

  const buyerUsername = order.buyer_profile?.username || 'Unknown';
  const buyerAvatar = order.buyer_profile?.avatar_url || '';
  const listingTitle = order.listing?.title || 'Item';
  const listingImage = order.listing?.images?.[0] || '';

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <div className="overflow-y-auto">
          <DrawerHeader className="text-center pb-4">
            <DrawerTitle className="text-xl font-semibold">Sale details</DrawerTitle>
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
            {/* Buyer Section */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Buyer</SectionHeader>
              <div className="flex items-center gap-3 p-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={buyerAvatar} alt={buyerUsername} />
                  <AvatarFallback>{buyerUsername.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-medium">@{buyerUsername}</span>
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
                  <span className="text-muted-foreground">4% seller fee</span>
                  <span className="text-muted-foreground">- ${sellerFee.toFixed(2)}</span>
                </div>

                {/* Total */}
                <div className="flex items-center justify-center bg-charcoal text-white py-3 px-4">
                  <span className="font-medium">You received: ${youReceived.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Tracking Details Section - Editable for awaiting status */}
            <div className="rounded-xl bg-card overflow-hidden">
              <SectionHeader>Tracking Details</SectionHeader>
              <div className="p-4 space-y-3">
                {order.status === 'awaiting' ? (
                  <>
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
                    {validationError && (
                      <p className="text-sm text-destructive">{validationError}</p>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <p className="font-semibold text-foreground">Service Provider:</p>
                      <p className="text-muted-foreground">{order.tracking_provider || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Tracking number:</p>
                      <p className="text-muted-foreground">{order.tracking_number || 'N/A'}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Actions - Only show Mark as shipped for awaiting status */}
            {order.status === 'awaiting' && (
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
