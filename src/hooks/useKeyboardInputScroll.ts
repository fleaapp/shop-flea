import { useEffect } from 'react';
import { installKeyboardAware } from '@/lib/keyboardAware';

/**
 * Mounts the single app-wide keyboard-awareness handler. All of the logic
 * lives in `@/lib/keyboardAware` so there is exactly one implementation and
 * no competing scroll/padding handlers.
 */
export const useKeyboardInputScroll = () => {
  useEffect(() => installKeyboardAware(), []);
};

export default useKeyboardInputScroll;
