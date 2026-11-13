/**
 * #debug-items (dev, or the live site with ?debug): every item in
 * docs/design/03-items.md as a card, at any Quality, to check the art, the
 * text at each Quality and the counters. Compact cards are the bag's sizes.
 */
import { useState } from 'react';
import { TABLE_ITEMS } from '../../content/items';
import { QUALITIES, recipeSize, type ItemType, type Quality } from '../../engine';
import { ItemCard } from '../items/ItemCard';
import { TYPE_LOOK } from '../items/itemLook';
import map from './DebugMap.module.css';
import styles from './DebugItems.module.css';

const TYPES: (ItemType | 'all')[] = ['all', 'tool', 'clothes', 'food', 'shelter', 'trinket'];

export function DebugItems() {
  const [quality, setQuality] = useState<Quality>(3);
  const [type, setType] = useState<ItemType | 'all'>('all');
  const [width, setWidth] = useState(210);
  const items = TABLE_ITEMS.filter((i) => type === 'all' || i.type === type);
  const noArt = TABLE_ITEMS.filter((i) => !i.art).map((i) => i.name);

  return (
    <div className={map.page}>
      <header className={map.header}>
        <h1 className={map.title}>Items</h1>
        <span className={styles.note}>
          {items.length} of {TABLE_ITEMS.length} · no art yet: {noArt.join(', ') || 'none'}
        </span>
        <label className={map.field}>
          Quality
          <span className={styles.buttons}>
            {QUALITIES.map((q) => (
              <button
                key={q}
                type="button"
                className={map.button}
                aria-pressed={quality === q}
                onClick={() => setQuality(q)}
              >
                {q}
              </button>
            ))}
          </span>
        </label>
        <label className={map.field}>
          Type
          <select
            className={map.select}
            value={type}
            onChange={(e) => setType(e.target.value as ItemType | 'all')}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t === 'all' ? 'All' : TYPE_LOOK[t].label}
              </option>
            ))}
          </select>
        </label>
        <label className={map.field}>
          Width
          <select
            className={map.select}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          >
            {[150, 210, 260, 320].map((w) => (
              <option key={w} value={w}>
                {w}px
              </option>
            ))}
          </select>
        </label>
        <a className={map.back} href="#">
          Back to the game
        </a>
      </header>
      <div className={styles.grid}>
        {items.map((def) => (
          <figure key={def.id} className={styles.cell}>
            <ItemCard itemId={def.id} quality={quality} width={width} />
            <figcaption className={styles.caption}>
              <span>
                {def.id} · Tier {def.tier}
              </span>
              <span className={styles.compact}>
                <ItemCard itemId={def.id} quality={quality} width={64} compact />
                <ItemCard itemId={def.id} quality={quality} width={46} compact />
              </span>
              <span className={styles.recipe}>
                {def.notCrafted
                  ? 'Not crafted'
                  : def.recipe
                    ? `Recipe: ${def.recipe
                        .map((p) => `${p.ids?.join('/') ?? p.nodes?.join('/') ?? 'any'} ${p.n}`)
                        .join(', ')} (${recipeSize(def.recipe)})`
                    : 'Generic recipe only'}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
