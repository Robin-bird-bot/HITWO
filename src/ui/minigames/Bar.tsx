/**
 * A bar on a minigame's screen (docs/design/26-fixes-and-wyatt-trees.md,
 * section 1): the top HUD's bar, or the panel's time bar.
 *
 * - **Live** bars show something that changes every frame (a timer, the
 *   bridge's integrity, the distance walked). They have no transition, so
 *   the bar is exactly the value on every frame: no lag and no lurches.
 *   (A CSS transition restarts on every frame's new width, so it trails
 *   behind and catches up in jumps.)
 * - **Eased** bars show something that changes all at once (a fly swatted,
 *   a hiker across): they slide to the new value over [0.25 s].
 */
import type { CSSProperties, ReactNode } from 'react';
import { BALANCE } from '../../config/balance';
import hud from './hud.module.css';

export function Bar({
  value,
  live = false,
  className = hud.bar,
  style,
  children,
}: {
  /** From 0 (empty) to 1 (full); anything outside is clamped. */
  value: number;
  /** Changes every frame: no transition. */
  live?: boolean;
  /** The bar's look: the HUD's (the default) or the panel's time bar. */
  className?: string;
  style?: CSSProperties;
  /** Marks drawn over the fill (Squirrel Theft's line). */
  children?: ReactNode;
}) {
  const v = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  return (
    <span
      className={className}
      style={{ ...style, ['--bar-ease' as string]: `${BALANCE.minigames.barEaseSec}s` }}
      data-live={live || undefined}
    >
      <span style={{ width: `${Math.round(v * 1e6) / 1e4}%` }} />
      {children}
    </span>
  );
}
