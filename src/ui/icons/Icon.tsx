import { ICON_PATHS, type IconName } from './paths';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** Stroke width in the 24-unit icon grid. */
  strokeWidth?: number;
  /** Fill instead of stroke (the mockups' "solid" icons, like the injury cross). */
  solid?: boolean;
  /** Position when the icon sits inside another SVG. */
  x?: number;
  y?: number;
  className?: string;
}

/** A stroke icon from the mockups' set. Decorative: give its button or parent the label. */
export function Icon({
  name,
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
  solid = false,
  x,
  y,
  className,
}: IconProps) {
  return (
    <svg
      className={className}
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={solid ? color : 'none'}
      stroke={solid ? 'none' : color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flex: 'none' }}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
