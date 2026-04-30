import type { NavigateFunction } from 'react-router-dom';

/**
 * Navigate back when there's history in the SPA, otherwise replace with a
 * sensible fallback route. Prevents blank screens when users arrive via
 * deep links, push notifications, page refreshes, or shared URLs.
 */
export const safeNavigateBack = (navigate: NavigateFunction, fallback: string = '/') => {
  const canGoBack = typeof window !== 'undefined'
    && window.history.state
    && (window.history.state as { idx?: number }).idx > 0;

  if (canGoBack) {
    navigate(-1);
  } else {
    navigate(fallback, { replace: true });
  }
};
