/**
 * A span around a card (or a name) that opens its preview on hover, a
 * long-press or, with `clickOpens`, a click. For cards inside buttons and
 * lists, where a hook per card is awkward. `content` null: no preview (a
 * face-down card, a mystery item).
 */
import type { CSSProperties, ReactNode } from 'react';
import { usePreview, type PreviewContent } from './preview';

export function Previewable({
  content,
  clickOpens = false,
  className,
  style,
  children,
}: {
  content: PreviewContent | null | undefined;
  clickOpens?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const preview = usePreview(content, { clickOpens });
  return (
    <span className={className} style={style} {...preview}>
      {children}
    </span>
  );
}
