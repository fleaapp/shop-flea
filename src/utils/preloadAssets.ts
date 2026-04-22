const preloadedImages = new Set<string>();

export const preloadImage = (src: string): Promise<void> => {
  if (!src || preloadedImages.has(src)) {
    return Promise.resolve();
  }

  preloadedImages.add(src);

  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
};

export const preloadImages = (sources: string[]): Promise<void> => {
  return Promise.all(sources.filter(Boolean).map(preloadImage)).then(() => {});
};

