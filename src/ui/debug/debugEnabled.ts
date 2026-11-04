/** The debug panel is always on with the dev server, and on the live site only with ?debug. */
export function debugEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return new URLSearchParams(window.location.search).has('debug');
  } catch {
    return false;
  }
}
