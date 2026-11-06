/**
 * #debug-challenges (dev, or the live site with ?debug): every challenge,
 * Trial and opportunity, read out as its card would say it, to check side by
 * side with docs/design/04-challenges.md.
 * - Pick a seed, a Luck and "one tier up" to see sample X and Y rolls and
 *   which "(25%)" parts come up.
 * - Each entry shows its gates and anything still waiting on a later phase.
 */
import { useMemo, useState, type CSSProperties } from 'react';
import { cardArt } from '../../config/assets';
import { BALANCE } from '../../config/balance';
import { CARDS, CONDITIONS, RESOURCES } from '../../content';
import { STARTING_PARTY } from '../../content/characters';
import {
  createGame,
  notBuiltYet,
  notPlayableYet,
  rollCard,
  scaledRange,
  seedRng,
  type CardDef,
  type CardRolls,
  type Effect,
  type Gate,
  type Hiker,
  type Who,
} from '../../engine';
import { cardText, rangeText } from '../challenge/cardText';
import { NODE_NAME } from '../map/looks';
import map from './DebugMap.module.css';
import styles from './DebugChallenges.module.css';

const KIND_LOOK = {
  challenge: { name: 'Challenge', color: '#C8403A' },
  opportunity: { name: 'Opportunity', color: '#2F6FAE' },
  trial: { name: 'Trial', color: '#E0812F' },
} as const;

const TIER_NAME = { 1: 'I', 2: 'II', 3: 'III' } as const;

const GATE_NAME: Record<Gate, string> = {
  snow: 'Snowy section only',
  stormy: 'Stormy weather only',
  sunny: 'Sunny weather only',
  afternoon: 'Afternoon only',
  dogOnTile: 'Only with a Dog on the tile',
};

const WHO_NAME: Record<Who, string> = {
  all: 'Each hiker',
  noClothing: 'Each hiker with no clothing',
  wearingClothes: 'Each hiker wearing clothes',
  carryingFood: 'Each hiker carrying food',
};

/** Effects the engine records now, for a later phase to use. */
const LATER: Partial<Record<Effect['op'], string>> = {
  foodAppetite: 'Phase 9: food giving less Appetite is recorded on the food cards.',
  toolUses: 'Phase 9: lost tool uses are recorded on the tools.',
  loseClothes: 'Phase 9: losing clothing by durability does nothing yet.',
};

const RESOURCE_NAME = Object.fromEntries(RESOURCES.map((r) => [r.id, r.name]));
const ALL_CARDS = Object.values(CARDS);

/** A small stable number from a card id, so each card gets its own rolls. */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function effectsOf(card: CardDef): Effect[] {
  const out = [...card.penalty, ...(card.reward ?? [])];
  if (card.kind === 'trial') for (const r of card.stagedRewards ?? []) out.push(...r.effects);
  else if (card.risk) out.push(...card.risk.outcome);
  return out;
}

/** What's switched off, or recorded for later, on this card. */
function waiting(card: CardDef): string[] {
  const out: string[] = [];
  const off = notPlayableYet(card);
  if (off) out.push(`Never picked until ${off}.`);
  if (card.kind !== 'trial' && !off) {
    card.cost.forEach((option, i) => {
      if (option.some(notBuiltYet)) {
        out.push(`Cost option ${i + 1} needs clothing durability or tool uses (phase 9).`);
      }
    });
    if (card.risk?.spend.some((s) => 'durability' in s)) {
      out.push('Spending clothing durability waits on phase 9.');
    }
  }
  for (const e of effectsOf(card)) {
    const later = LATER[e.op];
    if (later && !out.includes(later)) out.push(later);
  }
  return out;
}

function conditionsGiven(card: CardDef): string[] {
  const ids = new Set<string>();
  for (const e of effectsOf(card)) {
    if (e.op !== 'condition') continue;
    ids.add(e.id);
    if (e.then) ids.add(e.then.id);
  }
  return [...ids].map((id) => CONDITIONS[id]?.name ?? id);
}

function scopeText(card: CardDef): string {
  if (card.kind === 'trial') return 'The hikers on the tile';
  if (card.scope === 'party') return 'Whole party';
  return WHO_NAME[card.who ?? 'all'];
}

function nodesText(card: CardDef): string {
  if (card.nodes === 'any') return 'Any node';
  return card.nodes.map((n) => NODE_NAME[n]).join(', ');
}

type KindFilter = 'all' | CardDef['kind'];

export function DebugChallenges() {
  const [seed, setSeed] = useState(1);
  const [luck, setLuck] = useState(0);
  const [up, setUp] = useState(false);
  const [kind, setKind] = useState<KindFilter>('all');
  const [tier, setTier] = useState<0 | 1 | 2 | 3>(0);
  const [search, setSearch] = useState('');
  const [onlyWaiting, setOnlyWaiting] = useState(false);

  const hikers = useMemo(() => createGame({ seed: 1, hikers: STARTING_PARTY }).hikers, []);
  const scale = up ? BALANCE.challenges.tierScale : 1;

  const shown = ALL_CARDS.filter(
    (c) =>
      (kind === 'all' || c.kind === kind) &&
      (tier === 0 || c.tier === tier) &&
      c.name.toLowerCase().includes(search.trim().toLowerCase()) &&
      (!onlyWaiting || waiting(c).length > 0),
  );

  const count = (k: CardDef['kind'], t?: number) =>
    ALL_CARDS.filter((c) => c.kind === k && (t === undefined || c.tier === t)).length;
  const off = ALL_CARDS.filter((c) => notPlayableYet(c)).length;

  return (
    <div className={map.page}>
      <header className={map.header}>
        <h1 className={map.title}>Challenges</h1>
        <label className={map.field}>
          Seed
          <input
            className={map.seed}
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
          />
        </label>
        <button className={map.button} onClick={() => setSeed((s) => s + 1)}>
          Reroll
        </button>
        <label className={map.field}>
          Luck
          <select
            className={map.select}
            value={luck}
            onChange={(e) => setLuck(Number(e.target.value))}
          >
            {[-2, -1, 0, 1, 2].map((l) => (
              <option key={l} value={l}>
                {l > 0 ? `+${l}` : l}
              </option>
            ))}
          </select>
        </label>
        <label className={map.check}>
          <input type="checkbox" checked={up} onChange={(e) => setUp(e.target.checked)} />
          One tier up (×{BALANCE.challenges.tierScale})
        </label>
        <label className={map.field}>
          Show
          <select
            className={map.select}
            value={kind}
            onChange={(e) => setKind(e.target.value as KindFilter)}
          >
            <option value="all">Everything</option>
            <option value="challenge">Challenges</option>
            <option value="trial">Trials</option>
            <option value="opportunity">Opportunities</option>
          </select>
        </label>
        <label className={map.field}>
          Tier
          <select
            className={map.select}
            value={tier}
            onChange={(e) => setTier(Number(e.target.value) as 0 | 1 | 2 | 3)}
          >
            <option value={0}>All</option>
            <option value={1}>I</option>
            <option value={2}>II</option>
            <option value={3}>III</option>
          </select>
        </label>
        <input
          className={`${map.select} ${styles.search}`}
          type="search"
          placeholder="Find by name"
          aria-label="Find by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className={map.check}>
          <input
            type="checkbox"
            checked={onlyWaiting}
            onChange={(e) => setOnlyWaiting(e.target.checked)}
          />
          Only ones waiting on a later phase
        </label>
        <a className={map.back} href="#">
          ← Back to the game
        </a>
      </header>

      <main className={styles.main}>
        <p className={styles.summary}>
          {count('challenge')} challenges ({count('challenge', 1)} Tier I · {count('challenge', 2)}{' '}
          Tier II · {count('challenge', 3)} Tier III) · {count('trial')} Trials ·{' '}
          {count('opportunity')} placeholder opportunities · {off} never picked until their systems
          exist · showing {shown.length}
        </p>
        <p className={styles.note}>
          Conditions are tracked with their time left. Frozen already stops moving; what the others
          do arrives in Phase 6. Sample rolls use Luck {luck > 0 ? `+${luck}` : luck} for X and for
          every hiker’s Y.
        </p>

        <div className={styles.grid}>
          {shown.map((card) => (
            <Entry
              key={card.id}
              card={card}
              seed={seed}
              luck={luck}
              scale={scale}
              hikers={hikers}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

interface EntryProps {
  card: CardDef;
  seed: number;
  luck: number;
  scale: number;
  hikers: readonly Hiker[];
}

function Entry({ card, seed, luck, scale, hikers }: EntryProps) {
  const look = KIND_LOOK[card.kind];
  const ask = card.kind === 'trial' ? card.goalText : card.costText;
  const rolls: CardRolls = rollCard(
    seedRng((seed ^ hashId(card.id)) >>> 0),
    card,
    hikers,
    scale,
    luck,
  );
  const defs = Object.entries(card.rolls ?? {});
  const yNames = defs.filter(([, d]) => d.roll === 'y').map(([n]) => n);
  const later = waiting(card);
  const conditions = conditionsGiven(card);
  const includes = Object.entries(card.includes ?? {});
  const rewardText = card.rewardText ?? [];

  return (
    <article
      className={styles.entry}
      style={{ '--kind': look.color } as CSSProperties}
      data-off={notPlayableYet(card) ? '' : undefined}
    >
      <div className={styles.art}>
        {card.art ? (
          <img src={cardArt(card)} alt="" loading="lazy" width={960} height={540} />
        ) : (
          <span>No art yet</span>
        )}
      </div>

      <div className={styles.body}>
        <p className={styles.badge}>
          {look.name} · Tier {TIER_NAME[card.tier]}
          {card.placeholder && <span className={styles.placeholder}>placeholder</span>}
        </p>
        <h2 className={styles.name}>{card.name}</h2>
        <p className={styles.meta}>
          {scopeText(card)} · {nodesText(card)}
          {card.gates?.map((g) => (
            <span key={g} className={styles.gate}>
              {GATE_NAME[g]}
            </span>
          ))}
        </p>
        {card.quote && <p className={styles.quote}>“{card.quote}”</p>}
        <p className={styles.description}>
          {card.description}
          {card.descriptionPlaceholder && (
            <span className={styles.muted}> (description to come from Wyatt)</span>
          )}
        </p>

        <dl className={styles.text}>
          <dt>{card.kind === 'trial' ? 'Goal' : 'Cost'}</dt>
          <dd>{cardText(card, ask, { scale })}</dd>
          <dt>Penalty</dt>
          <dd>{cardText(card, card.penaltyText, { scale }) || '—'}</dd>
          {rewardText.length > 0 && (
            <>
              <dt>Reward</dt>
              <dd>{cardText(card, rewardText, { scale })}</dd>
            </>
          )}
        </dl>

        {(defs.length > 0 || includes.length > 0) && (
          <div className={styles.sample}>
            <h3 className={styles.sampleHeading}>Sample rolls</h3>
            <p>{cardText(card, ask, { rolls, scale })}</p>
            <p>{cardText(card, card.penaltyText, { rolls, scale })}</p>
            <ul className={styles.rolls}>
              {defs.map(([name, def]) => (
                <li key={name}>
                  <b>{name}</b> {def.roll.toUpperCase()} {rangeText(scaledRange(def, scale))}
                  {def.reverse && <span className={styles.muted}> (higher is better)</span>}
                  {': '}
                  {def.roll === 'x'
                    ? rolls.x[name]
                    : hikers.map((h) => `${h.name} ${rolls.y[h.id]?.[name] ?? '?'}`).join(', ')}
                </li>
              ))}
              {includes.map(([name, chance]) => (
                <li key={name}>
                  <b>({Math.round(chance * 100)}%)</b> {name}:{' '}
                  {rolls.includes[name] ? 'came up' : 'didn’t come up'}
                </li>
              ))}
              {rolls.options && (
                <li>
                  <b>Wants</b> {rolls.options.map((r) => RESOURCE_NAME[r] ?? r).join(', ')}
                </li>
              )}
            </ul>
            {yNames.length > 0 && (
              <p className={styles.muted}>
                Y is rolled for each hiker; their own number shows in their section.
              </p>
            )}
          </div>
        )}

        {conditions.length > 0 && (
          <p className={styles.conditions}>Conditions: {conditions.join(', ')}</p>
        )}
        {later.length > 0 && (
          <ul className={styles.waiting}>
            {later.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
