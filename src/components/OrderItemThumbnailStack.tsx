import { useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { getCardImageUrl } from '@/utils/optimizedImage';

const STACK_WIDTH = 148;
const PRIMARY_SIZE = 84;
const SECONDARY_SIZE = 76;
const SECONDARY_LEFT = 70;
const SECONDARY_TOP = 4;
const AVATAR_SIZE = 28;
const AVATAR_LEFT = 56;

const TILE_BASE_STYLE: CSSProperties = {
  position: 'absolute',
  display: 'block',
  overflow: 'hidden',
  borderRadius: 16,
  border: '2px solid hsl(var(--border))',
  background: 'hsl(var(--muted))',
  boxShadow: '0 12px 24px -18px hsl(var(--foreground) / 0.45), var(--shadow-card), 0 0 0 2px hsl(var(--card))',
};

type ThumbnailTileProps = {
  src?: string | null;
  alt: string;
  fallbackEmoji?: string;
  objectPosition?: CSSProperties['objectPosition'];
  style: CSSProperties;
};

const ThumbnailTile = ({ src, alt, fallbackEmoji = '📦', objectPosition = 'center', style }: ThumbnailTileProps) => {
  const [imageFailed, setImageFailed] = useState(false);

  if (!src || imageFailed) {
    return (
      <div
        style={{
          ...TILE_BASE_STYLE,
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 24, lineHeight: 1 }}>{fallbackEmoji}</span>
      </div>
    );
  }

  return (
    <img
      src={getCardImageUrl(src)}
      alt={alt}
      style={{
        ...TILE_BASE_STYLE,
        ...style,
        objectFit: 'cover',
        objectPosition,
      }}
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
      className={cn(className)}
      style={{
        position: 'relative',
        height: PRIMARY_SIZE,
        width: hasMultipleItems ? STACK_WIDTH : PRIMARY_SIZE,
        flexShrink: 0,
        overflow: 'visible',
      }}
    >
      {hasMultipleItems && (
        <ThumbnailTile
          src={secondaryImage}
          alt="Second item image"
          objectPosition="right center"
          style={{
            left: SECONDARY_LEFT,
            top: SECONDARY_TOP,
            width: SECONDARY_SIZE,
            height: SECONDARY_SIZE,
            transform: 'rotate(8deg)',
            zIndex: 1,
          }}
        />
      )}

      <ThumbnailTile
        src={primaryImage}
        alt="Item image"
        style={{
          left: 0,
          top: 0,
          width: PRIMARY_SIZE,
          height: PRIMARY_SIZE,
          zIndex: 2,
        }}
      />

      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={avatarAlt}
          style={{
            position: 'absolute',
            left: AVATAR_LEFT,
            bottom: -2,
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: 999,
            border: '2px solid hsl(var(--card))',
            background: 'hsl(var(--card))',
            objectFit: 'cover',
            boxShadow: '0 0 0 1px hsl(var(--border))',
            zIndex: 3,
          }}
          loading="lazy"
          decoding="async"
        />
      ) : null}
    </div>
  );
};

export default OrderItemThumbnailStack;