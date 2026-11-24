/** The Skill Trails button on a hiker frame (Phase 10.7): a small trail-fork mark, or "SKILL TRAILS". */
import styles from './Trails.module.css';

export function TrailsButton({ onClick, wide = false }: { onClick(): void; wide?: boolean }) {
  return (
    <button
      type="button"
      className={wide ? styles.trailsWide : styles.trailsButton}
      title="Skill Trails"
      aria-label="Skill Trails"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
      >
        <path d="M12 22V14M12 14C12 10 6 10 6 4M12 14C12 10 18 10 18 4M12 14V4" />
      </svg>
      {wide && <span>SKILL TRAILS</span>}
    </button>
  );
}
