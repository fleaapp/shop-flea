const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes('id-preview--') ||
  window.location.hostname.includes('lovableproject.com');

if ('serviceWorker' in navigator && !isInIframe && !isPreviewHost) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  });
}