/**
 * #debug-cards (dev, or the live site with ?debug): every scavenge card face
 * and back, laid out like docs/mockups/ScavTypes.png, plus an odds check that
 * deals 1,000 seeded cards and compares the rarities with balance.ts.
 */
import { useMemo, useState } from 'react';
import { SCAVENGE_CARDS, SCAVENGE_CARD_ORDER } from '../../content';
import {
  RARITIES,
  dealCards,
  rarityOdds,
  seedRng,
  type NodeType,
  type ScavengeCard,
  type ScavengeCardType,
  type TileNode,
} from '../../engine';
import { RARITY_LOOK } from '../scavenge/cardLook';
import { ScavCard } from '../scavenge/ScavCard';
import map from './DebugMap.module.css';
import styles from './DebugCards.module.css';

const card = (type: ScavengeCardType, extra: Partial<ScavengeCard> = {}): ScavengeCard => ({
  type,
  rarity: SCAVENGE_CARDS[type].rarity,
  node: 'forest',
  flipped: true,
  ...extra,
});

const SECTIONS: { title: string; note: string; cards: { card: ScavengeCard; back?: string }[] }[] =
  [
    {
      title: 'Face down',
      note: 'Every card is dealt face down showing where it came from; click each to flip it',
      cards: [
        { card: card('resource', { node: 'forest' }), back: 'FOREST BACK' },
        { card: card('resource', { node: 'river' }), back: 'RIVER BACK' },
        { card: card('resource', { node: 'wildlife' }), back: 'WILDLIFE BACK' },
        { card: card('resource', { node: 'mountain' }), back: 'MOUNTAIN BACK' },
        { card: card('caps', { caps: 2 }), back: 'CAPS BACK' },
        { card: card('toolFind', { items: ['medkit'] }), back: 'ITEM BACK' },
      ],
    },
    {
      title: 'Resources and caps',
      note: 'What you see is what you get · ×2, ×3, pairs and trios drain 2 Abundance',
      cards: [
        { card: card('resource', { resources: ['wood'] }) },
        { card: card('x2', { node: 'river', resources: ['fish', 'fish'] }) },
        { card: card('x3', { node: 'mountain', resources: ['stone', 'stone', 'stone'] }) },
        { card: card('pair', { resources: ['wood', 'moss'] }) },
        { card: card('trio', { resources: ['wood', 'moss', 'mushroom'] }) },
        { card: card('mixed', { node2: 'river', resources: ['wood', 'fish'] }) },
        { card: card('caps', { caps: 3 }) },
      ],
    },
    {
      title: 'Wild ?',
      note: 'Random, revealed when taken',
      cards: [
        { card: card('wild', { resources: ['grass'] }) },
        { card: card('wildX2', { node: 'river', resources: ['clay', 'clay'] }) },
        { card: card('varietyWild', { node: 'river', resources: ['salt'] }) },
        { card: card('varietyPair', { node: 'mountain', resources: ['fur', 'moss'] }) },
        { card: card('varietyBundle', { node: 'mountain', resources: ['oil', 'wood', 'flint'] }) },
      ],
    },
    {
      title: 'Choice !',
      note: 'You pick the exact resource · the Wild picks can be the same resource or all different',
      cards: [
        { card: card('choice', { pick: { count: 1, from: 'forest', each: 1 } }) },
        {
          card: card('choiceX2', {
            node: 'mountain',
            pick: { count: 1, from: 'mountain', each: 2 },
          }),
        },
        { card: card('pickOfTheWild', { pick: { count: 1, from: 'all', each: 1 } }) },
        { card: card('pairOfTheWild', { pick: { count: 2, from: 'all', each: 1 } }) },
        { card: card('bundleOfTheWild', { pick: { count: 3, from: 'all', each: 1 } }) },
      ],
    },
    {
      title: 'Item finds',
      note: 'All rare · tools and food most often, then clothes, then shelters and trinkets',
      cards: (['toolFind', 'foodFind', 'clothesFind', 'shelterFind', 'trinketFind'] as const).map(
        (t) => ({ card: card(t, { items: [] }) }),
      ),
    },
    {
      title: 'Choice items',
      note: 'One step rarer than the find of the same type',
      cards: (
        ['choiceTool', 'choiceFood', 'choiceClothes', 'choiceShelter', 'choiceTrinket'] as const
      ).map((t) => ({ card: card(t, { items: [] }) })),
    },
  ];

const TILES: { label: string; nodes: TileNode[] }[] = [
  { label: 'Forest', nodes: [{ type: 'forest', revealed: true }] },
  {
    label: 'Forest + River',
    nodes: [
      { type: 'forest', revealed: true },
      { type: 'river', revealed: true },
    ],
  },
  {
    label: 'River ×2 + Mountain (Bounty)',
    nodes: [
      { type: 'river', revealed: true },
      { type: 'river', revealed: true },
      { type: 'mountain', revealed: true, bounty: true },
    ],
  },
  {
    label: 'Wildlife + Cap node',
    nodes: [
      { type: 'wildlife', revealed: true },
      { type: 'caps', revealed: true },
    ],
  },
];

const FULL: Record<NodeType, number> = { forest: 10, river: 10, wildlife: 10, mountain: 10 };
const DEALS = 1000;

export function DebugCards() {
  const [faceUp, setFaceUp] = useState(true);
  const [caption, setCaption] = useState<'full' | 'simple'>('full');

  return (
    <div className={map.page}>
      <header className={map.header}>
        <h1 className={map.title}>Scavenge cards</h1>
        <label className={map.check}>
          <input type="checkbox" checked={faceUp} onChange={(e) => setFaceUp(e.target.checked)} />
          Face up
        </label>
        <label className={map.field}>
          Captions
          <select
            className={map.select}
            value={caption}
            onChange={(e) => setCaption(e.target.value as 'full' | 'simple')}
          >
            <option value="full">Informative</option>
            <option value="simple">Simple</option>
          </select>
        </label>
        <a className={map.back} href="#">
          ← Back to the game
        </a>
      </header>

      <main className={styles.main}>
        <p className={styles.legend}>
          {RARITIES.map((r) => (
            <span key={r} style={{ color: RARITY_LOOK[r].color }}>
              <i style={{ background: RARITY_LOOK[r].color }} />
              {RARITY_LOOK[r].name}
            </span>
          ))}
        </p>

        {SECTIONS.map((s) => (
          <section key={s.title} className={styles.section}>
            <h2 className={styles.heading}>
              {s.title} <span>{s.note}</span>
            </h2>
            <div className={styles.row}>
              {s.cards.map(({ card: c, back }, i) => (
                <ScavCard
                  key={i}
                  card={c}
                  size={150}
                  faceUp={back ? false : faceUp}
                  caption={caption}
                  backCaption={back}
                />
              ))}
            </div>
          </section>
        ))}

        <OddsCheck />
        <SampleHand />
      </main>
    </div>
  );
}

/** Deals 1,000 seeded cards and compares the rarities with the table in balance.ts. */
function OddsCheck() {
  const [luck, setLuck] = useState(0);
  const [tile, setTile] = useState(1);
  const [seed, setSeed] = useState(1);

  const result = useMemo(() => {
    const nodes = TILES[tile]?.nodes ?? [];
    const cards = dealCards(seedRng(seed), { nodes, abundance: FULL, luck, count: DEALS });
    const byRarity = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<string, number>;
    const byType = new Map<ScavengeCardType, number>();
    for (const c of cards) {
      byRarity[c.rarity] = (byRarity[c.rarity] ?? 0) + 1;
      byType.set(c.type, (byType.get(c.type) ?? 0) + 1);
    }
    return { byRarity, byType };
  }, [tile, luck, seed]);
  const odds = rarityOdds(luck);

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>
        Odds check{' '}
        <span>{DEALS.toLocaleString()} seeded cards against the table in balance.ts</span>
      </h2>
      <div className={styles.controls}>
        <label className={map.field}>
          Luck
          <input
            type="range"
            min={-5}
            max={5}
            value={luck}
            onChange={(e) => setLuck(Number(e.target.value))}
          />
          <b className={styles.luck}>{luck > 0 ? `+${luck}` : luck}</b>
        </label>
        <label className={map.field}>
          Tile
          <select
            className={map.select}
            value={tile}
            onChange={(e) => setTile(Number(e.target.value))}
          >
            {TILES.map((t, i) => (
              <option key={t.label} value={i}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={map.button} onClick={() => setSeed((s) => s + 1)}>
          Deal again (seed {seed})
        </button>
      </div>
      <div className={styles.tables}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Rarity</th>
              <th>Table</th>
              <th>Dealt</th>
            </tr>
          </thead>
          <tbody>
            {RARITIES.map((r) => (
              <tr key={r}>
                <td style={{ color: RARITY_LOOK[r].color }}>{RARITY_LOOK[r].name}</td>
                <td>{(odds[r] * 100).toFixed(1)}%</td>
                <td>{(((result.byRarity[r] ?? 0) / DEALS) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className={styles.types}>
          {SCAVENGE_CARD_ORDER.filter((t) => result.byType.has(t)).map((t) => (
            <div key={t}>
              <dt style={{ color: RARITY_LOOK[SCAVENGE_CARDS[t].rarity].color }}>
                {SCAVENGE_CARDS[t].name}
              </dt>
              <dd>{result.byType.get(t)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className={styles.note}>
        A rarity with nothing that can happen on this tile steps down one, so Dealt can run a little
        under Table for the rarest cards (no Mixed on a one-node tile, for example).
      </p>
    </section>
  );
}

/** Three cards dealt face down from a seed: click to flip, like the real window will. */
function SampleHand() {
  const [seed, setSeed] = useState(42);
  const [flipped, setFlipped] = useState<boolean[]>([false, false, false]);
  const hand = useMemo(
    () =>
      dealCards(seedRng(seed), {
        nodes: TILES[2]?.nodes ?? [],
        abundance: FULL,
        luck: 1,
        count: 3,
      }),
    [seed],
  );
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>
        Sample hand <span>River ×2 + Mountain (Bounty), Luck +1 · click a card to flip it</span>
      </h2>
      <div className={styles.row}>
        {hand.map((c, i) => (
          <ScavCard
            key={`${seed}-${i}`}
            card={c}
            size={196}
            faceUp={!!flipped[i]}
            caption="full"
            onClick={() => setFlipped((f) => f.map((v, j) => (j === i ? !v : v)))}
          />
        ))}
      </div>
      <div className={styles.controls}>
        <button type="button" className={map.button} onClick={() => setFlipped([true, true, true])}>
          Flip all
        </button>
        <button
          type="button"
          className={map.button}
          onClick={() => {
            setSeed((s) => s + 1);
            setFlipped([false, false, false]);
          }}
        >
          Deal again
        </button>
      </div>
    </section>
  );
}
