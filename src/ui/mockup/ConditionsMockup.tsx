/**
 * #mockup-conditions (dev, or the live site with ?debug): how conditions
 * could look in Phase 6, for Wyatt to approve before they're built
 * (BUILD_PLAN Phase 6: "Make a mockup for Wyatt to approve before building it").
 *
 * Sample hikers with sample conditions, in the game's real styles, on the
 * 1600×1000 stage: Informative party cards, Simple party cards, the selected
 * hiker's full list, map tokens, and the new weather nodes.
 */
import type { CSSProperties } from 'react';
import { ASSETS } from '../../config/assets';
import { CONDITIONS } from '../../content/conditions';
import { characterFor } from '../../content/characters';
import type { StatName } from '../../engine';
import { ConditionDot, ConditionPill, ConditionRow } from '../conditions/ConditionBadges';
import {
  CONDITION_ICON,
  TONE_LOOK,
  timeWords,
  type ConditionLook,
} from '../conditions/conditionLook';
import { Icon } from '../icons/Icon';
import { StatBar } from '../panels/StatBar';
import { Stage } from '../stage/Stage';
import styles from './ConditionsMockup.module.css';

/** Shivering and Burning aren't in the content yet (Phase 6 step 2): their text from 02. */
const NEW_TEXT: Record<string, { name: string; text: string }> = {
  shivering: { name: 'Shivering', text: 'At 3 or more: Frozen. At 5: 1 injury, then back to 0.' },
  burning: { name: 'Burning', text: '−1 maximum Energy for each. At 5: 1 injury, then back to 0.' },
};

function look(
  id: string,
  time?: { remaining: number; unit: 'days' | 'phases' | 'nights' } | 'snow' | 'heat',
  stacks?: number,
): ConditionLook {
  const def = CONDITIONS[id] ?? NEW_TEXT[id];
  const tone = CONDITIONS[id]?.kind === 'positive' ? 'positive' : 'negative';
  const words =
    time === 'snow'
      ? { short: 'SNOW', long: 'Until the snow ends' }
      : time === 'heat'
        ? { short: 'HEAT', long: 'Until the heatwave ends' }
        : time
          ? timeWords(time.remaining, time.unit)
          : undefined;
  return {
    key: id,
    name: def?.name ?? id,
    text: def?.text ?? '',
    icon: CONDITION_ICON[id] ?? 'alert',
    tone,
    ...(words ? { short: words.short, long: words.long } : {}),
    ...(stacks !== undefined ? { stacks } : {}),
  };
}

const state = (
  key: string,
  name: string,
  text: string,
  icon: ConditionLook['icon'],
): ConditionLook => ({ key, name, text, icon, tone: 'state' });

const FATIGUED = state(
  'fatigued',
  'Fatigued',
  'At night, can only sleep (Energy 6 or less).',
  'battery',
);
const HUNGRY = state(
  'hungry',
  'Hungry',
  'Can’t scavenge or move the group (Appetite 5 or less).',
  'utensils',
);

interface Sample {
  id: string;
  name: string;
  stats: Record<StatName, number>;
  injuries: number;
  looks: ConditionLook[];
}

const SAMPLES: Sample[] = [
  {
    id: 'hiker-1',
    name: 'Hiker 1',
    stats: { energy: 4, appetite: 7, morale: 6 },
    injuries: 1,
    looks: [
      FATIGUED,
      look('shivering', 'snow', 3),
      look('frozen', 'snow'),
      look('sleepy', { remaining: 2, unit: 'days' }),
      look('lucky', { remaining: 1, unit: 'days' }),
    ],
  },
  {
    id: 'hiker-2',
    name: 'Hiker 2',
    stats: { energy: 8, appetite: 4, morale: 9 },
    injuries: 0,
    looks: [
      HUNGRY,
      look('burning', 'heat', 2),
      look('wet', { remaining: 2, unit: 'days' }),
      look('energized', { remaining: 1, unit: 'days' }),
    ],
  },
  {
    id: 'hiker-3',
    name: 'Hiker 3',
    stats: { energy: 7, appetite: 8, morale: 3 },
    injuries: 2,
    looks: [
      look('bleeding', { remaining: 3, unit: 'phases' }),
      look('nightmares', { remaining: 2, unit: 'days' }),
      look('motivated', { remaining: 1, unit: 'days' }),
    ],
  },
];

const INJURY: ConditionLook = {
  key: 'injury',
  name: 'Injury',
  text: 'A strike: the 3rd one makes this hiker pass out.',
  icon: 'medical',
  tone: 'injury',
};

const STATS: StatName[] = ['energy', 'appetite', 'morale'];

function Portrait({ id, size }: { id: string; size: number }) {
  return (
    <img
      className={styles.portrait}
      src={ASSETS.portraits.placeholder}
      alt=""
      style={{ width: size, height: size, boxShadow: `0 0 0 3px ${characterFor(id).color}` }}
    />
  );
}

/** The Informative party card, with the proposed condition pills under the bars. */
function InformativeCard({ s, open }: { s: Sample; open?: string }) {
  return (
    <div className={styles.card}>
      <Portrait id={s.id} size={56} />
      <div className={styles.info}>
        <div className={styles.nameRow}>
          <span className={styles.name}>{s.name.toUpperCase()}</span>
          <span className={styles.injuryPips}>
            {[0, 1, 2].map((i) => (
              <span key={i} data-filled={i < s.injuries} />
            ))}
          </span>
        </div>
        {STATS.map((stat) => (
          <StatBar key={stat} stat={stat} value={s.stats[stat]} ticks />
        ))}
        <div className={styles.pills}>
          {s.looks.map((l) => (
            <ConditionPill key={l.key} look={l} open={open === l.key} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** The Simple party card: bigger round badges, time left on the corner. */
function SimpleCard({ s, open }: { s: Sample; open?: string }) {
  return (
    <div className={styles.simpleCard}>
      <Portrait id={s.id} size={64} />
      <div className={styles.info}>
        <span className={styles.simpleName}>{s.name.toUpperCase()}</span>
        {STATS.map((stat) => (
          <StatBar key={stat} stat={stat} value={s.stats[stat]} showNumber size="regular" />
        ))}
        <div className={styles.dots}>
          {s.injuries > 0 &&
            Array.from({ length: s.injuries }, (_, i) => (
              <ConditionDot key={`inj-${i}`} look={INJURY} size={36} />
            ))}
          {s.looks.map((l) => (
            <ConditionDot key={l.key} look={l} size={36} open={open === l.key} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** A hiker token on the map, with a corner marker: red for bad, green for good, a snowflake if they can't move. */
function Token({ s, x, y }: { s: Sample; x: number; y: number }) {
  const bad = s.looks.filter((l) => l.tone === 'negative').length;
  const good = s.looks.filter((l) => l.tone === 'positive').length;
  const frozen = s.looks.some((l) => l.key === 'frozen');
  return (
    <div className={styles.token} style={{ left: x, top: y }}>
      <img
        src={ASSETS.portraits.placeholder}
        alt=""
        style={{ boxShadow: `0 0 0 3px ${characterFor(s.id).color}` }}
      />
      {frozen && (
        <span className={styles.tokenFrozen} title="Frozen: can't move">
          <Icon name="snowflake" size={30} strokeWidth={2.5} />
        </span>
      )}
      <span className={styles.tokenMarks}>
        {bad > 0 && (
          <span style={{ background: TONE_LOOK.negative.ring }} title={`${bad} bad conditions`}>
            {bad}
          </span>
        )}
        {good > 0 && (
          <span style={{ background: TONE_LOOK.positive.ring }} title={`${good} good conditions`}>
            {good}
          </span>
        )}
      </span>
    </div>
  );
}

const NODE_STATES = [
  {
    key: 'fire',
    name: 'Fire node',
    text: 'Gives nothing. +1 Luck to the other nodes on its tile. Spreads to connected Forest tiles.',
  },
  { key: 'frozen', name: 'Frozen node', text: 'Gives nothing until the snow ends.' },
  { key: 'flooded', name: 'Flooded node', text: 'Counts as a River node until the rain ends.' },
] as const;

function Hex({ x, y, nodes, label }: { x: number; y: number; nodes: string[]; label: string }) {
  return (
    <div className={styles.hex} style={{ left: x, top: y }}>
      <div className={styles.hexEdge} />
      <div className={styles.hexFill} />
      <span className={styles.hexLabel}>{label}</span>
      <div className={styles.hexNodes}>
        {nodes.map((n, i) => (
          <img
            key={i}
            src={
              n in ASSETS.nodeStates
                ? ASSETS.nodeStates[n as keyof typeof ASSETS.nodeStates]
                : ASSETS.nodes[n as keyof typeof ASSETS.nodes]
            }
            alt={n}
            className={styles.hexNode}
          />
        ))}
      </div>
    </div>
  );
}

const at = (left: number, top: number, width: number): CSSProperties => ({ left, top, width });

export function ConditionsMockup() {
  const [first, second, third] = SAMPLES as [Sample, Sample, Sample];
  return (
    <Stage>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>CONDITIONS · A MOCKUP TO APPROVE</h1>
          <p className={styles.lede}>
            Bigger badges with their own icons, colored by kind, with the time left on them. Hover
            or tap any badge for what it does. Nothing here is wired to the game yet.{' '}
            <a href="#">← Back to the game</a>
          </p>
        </header>

        <section className={styles.section} style={at(32, 112, 330)}>
          <h2 className={styles.sectionTitle}>INFORMATIVE · PARTY CARDS</h2>
          <p className={styles.note}>Each badge names itself, so nothing needs hovering.</p>
          <div className={styles.panel}>
            <InformativeCard s={first} />
            <InformativeCard s={second} />
            <InformativeCard s={third} open="motivated" />
          </div>
        </section>

        <section className={styles.section} style={at(396, 112, 372)}>
          <h2 className={styles.sectionTitle}>SIMPLE · PARTY CARDS</h2>
          <p className={styles.note}>Icons only, bigger. Tap one to read it.</p>
          <div className={styles.panel}>
            <SimpleCard s={first} open="sleepy" />
            <SimpleCard s={second} />
            <SimpleCard s={third} />
          </div>
        </section>

        <section className={styles.section} style={at(802, 112, 380)}>
          <h2 className={styles.sectionTitle}>SELECTED HIKER · THE FULL LIST</h2>
          <p className={styles.note}>
            Under the selected hiker: every condition, what it does, how long.
          </p>
          <div className={styles.panel}>
            <div className={styles.listHead}>
              <Portrait id={first.id} size={30} />
              <span className={styles.name}>{first.name.toUpperCase()}</span>
              <span className={styles.count}>{first.looks.length + 1}</span>
            </div>
            <ConditionRow look={{ ...INJURY, long: '1 of 3' }} />
            {first.looks.map((l) => (
              <ConditionRow key={l.key} look={l} />
            ))}
          </div>
        </section>

        <section className={styles.section} style={at(1214, 112, 356)}>
          <h2 className={styles.sectionTitle}>ON THE MAP</h2>
          <p className={styles.note}>
            Tokens get a corner count: red for bad, green for good. A snowflake means they can’t
            move.
          </p>
          <div className={styles.map}>
            <Hex x={14} y={8} nodes={['forest', 'fire']} label="WOODS" />
            <Hex x={186} y={8} nodes={['frozen', 'mountain']} label="CREEK" />
            <Hex x={100} y={164} nodes={['flooded']} label="MEADOW" />
            <Token s={first} x={60} y={60} />
            <Token s={second} x={232} y={60} />
            <Token s={third} x={146} y={216} />
          </div>
          <div className={styles.nodeList}>
            {NODE_STATES.map((n) => (
              <div key={n.key} className={styles.nodeRow}>
                <img src={ASSETS.nodeStates[n.key]} alt="" className={styles.hexNode} />
                <div>
                  <span className={styles.nodeName}>{n.name.toUpperCase()}</span>
                  <span className={styles.nodeText}>{n.text}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className={styles.legend}>
          {(
            [
              ['positive', 'Good for the hiker'],
              ['negative', 'Bad for the hiker'],
              ['state', 'A threshold (Hungry, Fatigued…)'],
              ['injury', 'An injury (solid)'],
            ] as const
          ).map(([tone, words]) => (
            <span key={tone} className={styles.legendItem}>
              <span
                className={styles.legendRing}
                style={{
                  borderColor: TONE_LOOK[tone].ring,
                  background: tone === 'injury' ? TONE_LOOK.injury.bg : 'transparent',
                }}
              />
              {words}
            </span>
          ))}
          <span className={styles.legendItem}>
            <b>2d</b> 2 days left · <b>3ph</b> 3 phases left · <b>SNOW</b> until that weather ends ·{' '}
            <b className={styles.legendStack}>×3</b> stacks
          </span>
        </footer>
      </div>
    </Stage>
  );
}
