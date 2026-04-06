import { useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { getCardImageUrl } from '@/utils/optimizedImage';

const STACK_WIDTH = 128;
const PRIMARY_SIZE = 80;
const SECONDARY_SIZE = 72;
const SECONDARY_LEFT = 56;
const SECONDARY_TOP = 4;
const AVATAR_LEFT = 57;

type ThumbnailTileProps = {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackEmoji?: string;
  style?: CSSProperties;
};

const ThumbnailTile = ({ src, alt, className, fallbackEmoji = '📦', style }: ThumbnailTileProps) => {
  const [imageFailed, setImageFailed] = useState(false);

  if (!src || imageFailed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center overflow-hidden rounded-xl border-2 border-border bg-muted shadow-md ring-2 ring-card',
          className,
        )}
        style={style}
      >
        <span className="text-2xl">{fallbackEmoji}</span>
      </div>
    );
  }

  return (
    <img
      src={getCardImageUrl(src)}
      alt={alt}
      className={cn('overflow-hidden rounded-xl border-2 border-border bg-muted object-cover shadow-md ring-2 ring-card', className)}
      style={style}
      loading="lazy"
      decoding="async"
      onError={() => setImageFailed(true)}
    />
  );
};

type OrderItemThumbnailStackProps = {
  imageUrls: Array<string | null | undefined>;
  itemCount: number;
  avatarUrl?: string | null;
  avatarAlt?: string;
  className?: string;
};

const OrderItemThumbnailStack = ({
  imageUrls,
  itemCount,
  avatarUrl,
  avatarAlt = 'User',
  className,
}: OrderItemThumbnailStackProps) => {
  const availableImages = imageUrls.filter((url): url is string => Boolean(url));
  const hasMultipleItems = itemCount > 1;
  const primaryImage = availableImages[0];
  const secondaryImage = availableImages[1];

  return (
    <div
      className={cn('relative h-20 flex-shrink-0 overflow-visible', className)}
      style={{ width: hasMultipleItems ? STACK_WIDTH : PRIMARY_SIZE }}
    >
      {hasMultipleItems && (
        <ThumbnailTile
          src={secondaryImage}
          alt="Second item image"
          className="absolute"
          style={{
            left: SECONDARY_LEFT,
            top: SECONDARY_TOP,
            width: SECONDARY_SIZE,
            height: SECONDARY_SIZE,
            transform: 'rotate(4deg)',
            zIndex: 1,
          }}
        />
      )}

      <ThumbnailTile
        src={primaryImage}
        alt="Item image"
        className="absolute left-0 top-0 h-20 w-20"
        style={{ zIndex: 2 }}
      />

      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={avatarAlt}
          className="absolute -bottom-1 h-7 w-7 rounded-full border-2 border-card bg-card object-cover"
          style={{ left: AVATAR_LEFT, zIndex: 3 }}
          loading="lazy"
          decoding="async"
        />
      ) : null}
    </div>
  );
};

export default OrderItemThumbnailStack;