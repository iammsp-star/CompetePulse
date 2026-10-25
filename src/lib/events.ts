export const REFRESH_EVENT = 'competepulse:refresh';

export function emitRefresh() {
  window.dispatchEvent(new Event(REFRESH_EVENT));
}

export function useRefreshListener(handler: () => void) {
  const listener = () => handler();
  window.addEventListener(REFRESH_EVENT, listener);
  return () => window.removeEventListener(REFRESH_EVENT, listener);
}
