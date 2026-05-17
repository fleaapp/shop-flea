import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";
import { useOverlayChrome } from "@/lib/useOverlayChrome";
const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} {...props} />;
Drawer.displayName = "Drawer";
const DrawerTrigger = DrawerPrimitive.Trigger;
const DrawerPortal = DrawerPrimitive.Portal;
const DrawerClose = DrawerPrimitive.Close;
const DrawerOverlay = React.forwardRef<React.ElementRef<typeof DrawerPrimitive.Overlay>, React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>>(({
  className,
  ...props
}, ref) => {
  const innerRef = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => innerRef.current as HTMLDivElement);
  useOverlayChrome(innerRef);

  return <DrawerPrimitive.Overlay ref={innerRef} className={cn("fixed inset-x-0 bottom-0 top-[calc(-1*env(safe-area-inset-top,0px))] z-[60] bg-black/50 backdrop-blur-sm", className)} {...props} />;
});
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;
const DrawerContent = React.forwardRef<React.ElementRef<typeof DrawerPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>>(({
  className,
  children,
  ...props
}, ref) => <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content ref={ref} className={cn("fixed inset-x-0 bottom-0 top-10 z-[60] flex flex-col rounded-t-3xl bg-background", className)} {...props}>
      <div className="mx-auto my-3 h-2 w-[80px] shrink-0 rounded-full bg-muted-foreground/30" />
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>);
DrawerContent.displayName = "DrawerContent";
const DrawerBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("min-h-0 flex-1 overflow-y-auto", className)} {...props} />;
DrawerBody.displayName = "DrawerBody";
const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)} {...props} />;
DrawerHeader.displayName = "DrawerHeader";
const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("shrink-0 border-t bg-background px-4 pt-3 pb-4", className)} {...props} />;
DrawerFooter.displayName = "DrawerFooter";
const DrawerTitle = React.forwardRef<React.ElementRef<typeof DrawerPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>>(({
  className,
  ...props
}, ref) => <DrawerPrimitive.Title ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />);
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;
const DrawerDescription = React.forwardRef<React.ElementRef<typeof DrawerPrimitive.Description>, React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>>(({
  className,
  ...props
}, ref) => <DrawerPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />);
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;
export { Drawer, DrawerPortal, DrawerOverlay, DrawerTrigger, DrawerClose, DrawerContent, DrawerBody, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription };