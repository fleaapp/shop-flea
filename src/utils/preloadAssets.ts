 // Preload images/assets for faster display
 const preloadedImages = new Set<string>();
 
 export const preloadImage = (src: string): Promise<void> => {
   if (preloadedImages.has(src)) {
     return Promise.resolve();
   }
   
   return new Promise((resolve, reject) => {
     const img = new Image();
     img.onload = () => {
       preloadedImages.add(src);
       resolve();
     };
     img.onerror = reject;
     img.src = src;
   });
 };
 
 export const preloadImages = async (sources: string[]): Promise<void> => {
   await Promise.all(sources.map(preloadImage));
 };