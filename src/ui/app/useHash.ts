import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

/** The current URL hash (for example "#debug-map?seed=123"), kept up to date. */
export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash);
}

/** The query part of a hash route: "#debug-map?seed=1" → seed=1. */
export function hashParams(hash: string): URLSearchParams {
  const q = hash.indexOf('?');
  return new URLSearchParams(q >= 0 ? hash.slice(q + 1) : '');
}
