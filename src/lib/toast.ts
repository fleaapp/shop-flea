import { toast as sonnerToast } from 'sonner';
import { userMessage } from './userMessage';

const wrap = (fn: (...args: any[]) => any) => (...args: any[]) => {
  args[0] = userMessage(args[0]);
  if (args[1]?.description) args[1] = { ...args[1], description: userMessage(args[1].description) };
  return fn(...args);
};

export const toast = new Proxy(sonnerToast, {
  apply(target, _receiver, args) { return wrap(target)(...args); },
  get(target, property) {
    const value = Reflect.get(target, property);
    return ['success', 'error', 'warning', 'info', 'message', 'loading'].includes(String(property)) && typeof value === 'function' ? wrap(value) : value;
  },
});