/** Debug panels open and close with the backtick key (not while typing in a field). */
import { useEffect, useState } from 'react';

export function useBacktickToggle(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Backquote' && e.key !== '`') return;
      const target = e.target as HTMLElement | null;
      if (target instanceof Element && target.closest('input, textarea, select')) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return [open, setOpen];
}
