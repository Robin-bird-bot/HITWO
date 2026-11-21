/**
 * Trait warnings, Informative: a red "! −N" tag on a hiker's portrait when
 * their traits are about to cost them Morale (now, or tomorrow morning).
 */
import { moraleAtRisk, useTraitView } from './forecastView';
import styles from './TraitBadge.module.css';

export function AtRiskTag({ hikerId, name }: { hikerId: string; name: string }) {
  const { warnings, view } = useTraitView();
  if (warnings !== 'informative' || !view) return null;
  const n = moraleAtRisk(view, hikerId);
  if (n <= 0) return null;
  return (
    <span
      className={styles.atRisk}
      title={`${name} is about to lose ${n} Morale from a trait`}
      aria-label={`${name} is about to lose ${n} Morale from a trait`}
    >
      ! −{n}
    </span>
  );
}
