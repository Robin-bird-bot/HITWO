/**
 * Items working right now for this hiker or on their tile: a Shovel this
 * phase, Bear Spray for 2 nights, a Wheelbarrow for everyone here, a Supply
 * Map waiting for the next scavenge, a Camping Lamp tonight, and shelters
 * standing here with their nights left.
 */
import { ASSETS } from '../../config/assets';
import { ITEMS } from '../../content';
import type { GameState, Hiker, ItemBoost } from '../../engine';
import styles from './BoostChips.module.css';

function howLong(b: ItemBoost): string {
  if (b.once) return 'next scavenge here';
  if (b.unit === 'nights') return b.remaining === 1 ? 'tonight' : `${b.remaining} nights`;
  return b.remaining === 1 ? 'this phase' : `${b.remaining} phases`;
}

export function BoostChips({ state, hiker }: { state: GameState; hiker: Hiker }) {
  const tile = state.section.tiles[hiker.tileId];
  const chips: { key: string; itemId: string; text: string }[] = [];
  for (const [i, b] of (hiker.boosts ?? []).entries()) {
    if (b.tileId && b.tileId !== hiker.tileId) continue;
    chips.push({ key: `h${i}`, itemId: b.itemId, text: howLong(b) });
  }
  for (const [i, b] of (tile?.boosts ?? []).entries()) {
    chips.push({ key: `t${i}`, itemId: b.itemId, text: `everyone here, ${howLong(b)}` });
  }
  if (tile?.lampTonight) {
    chips.push({ key: 'lamp', itemId: 'campingLamp', text: 'keeping watch tonight' });
  }
  // Shelters standing here, with their nights left.
  for (const sh of tile?.shelters ?? []) {
    const nights = `${sh.nightsLeft} night${sh.nightsLeft === 1 ? '' : 's'} left`;
    chips.push({ key: sh.uid, itemId: sh.itemId, text: `shelter here, ${nights}` });
  }
  if (!chips.length) return null;
  return (
    <ul className={styles.list} aria-label="Items working now">
      {chips.map((c) => {
        const def = ITEMS[c.itemId];
        return (
          <li key={c.key} className={styles.chip}>
            {def?.art && <img src={ASSETS.itemArt(def.art)} alt="" width={22} height={22} />}
            <span className={styles.name}>{def?.name ?? c.itemId}</span>
            <span className={styles.when}>{c.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
