/** Draws one of the placeholder glyphs (./glyphPaths.ts). */
export function Glyph({
  path,
  size,
  color = 'currentColor',
  strokeWidth = 2,
  className,
}: {
  path: string;
  size: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
