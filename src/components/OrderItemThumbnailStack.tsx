import { useState } from 'react';
import { cn } from '@/lib/utils';
import { getCardImageUrl } from '@/utils/optimizedImage';

type ThumbnailTileProps = {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackEmoji?: string;
};

const ThumbnailTile = ({ src, alt, className, fallbackEmoji = '📦' }: ThumbnailTileProps) => {
  const [imageFailed, setImageFailed] = useState(false);

  if (!src || imageFailed) {
    return (
      <div className={cn('flex items-center justify-center rounded-xl border-2 border-card bg-muted', className)}>
        <span className="text-2xl">{fallbackEmoji}</span>
      </div>
    );
  }

  return (
    <img
      src={getCardImageUrl(src)}
      alt={alt}
      className={cn('rounded-xl border-2 border-card bg-muted object-cover', className)}
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
    <div className={cn('relative h-20 flex-shrink-0 overflow-visible', hasMultipleItems ? 'w-[7rem]' : 'w-20', className)}>
      {hasMultipleItems && (
        <ThumbnailTile
          src={secondaryImage}
          alt="Additional item image"
          className="absolute right-0 top-2 h-[4.15rem] w-[4.15rem] rotate-6 shadow-sm"
        />
      )}

      <ThumbnailTile
        src={primaryImage}
        alt="Item image"
        className="absolute left-0 top-0 h-20 w-20 shadow-sm"
      />

      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={avatarAlt}
          className="absolute -bottom-1 left-[3.55rem] h-7 w-7 rounded-full border-2 border-card bg-card object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : null}
    </div>
  );
};

export default OrderItemThumbnailStack;