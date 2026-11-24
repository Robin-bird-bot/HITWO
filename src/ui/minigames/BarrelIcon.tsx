/** The Barrels game's icon: a small barrel, in the current color. */
export function BarrelIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 3h12c1.5 3 1.5 15 0 18H6C4.5 18 4.5 6 6 3z" />
      <path d="M5.2 9h13.6M5.2 15h13.6" />
    </svg>
  );
}
