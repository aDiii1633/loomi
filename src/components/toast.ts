/** Toast helper decoupled from React, for stores and services. */
import { useUIStore } from '../state/ui';

export function toast(message: string, tone: 'success' | 'error' | 'info' = 'info'): void {
  useUIStore.getState().toast(message, tone);
}
