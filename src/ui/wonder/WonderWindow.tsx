/**
 * The Wonder pop-up (docs/mockups/Wonder.dc.html, WonderRewards.dc.html).
 *
 * - 1400×956, purple, movable by its ribbon. It doesn't hold up the game:
 *   close it, move hikers, and reopen it from the map icon. Dragged aside, the
 *   map behind can be used while it stays open, and its goals tick live.
 * - The ribbon has the trinket card back's gradient, slowly shifting.
 * - The art runs full width, with the description over a fade at its foot.
 * - Goals on the left (only hikers on this tile count), rewards on the right.
 * - Accomplish lights up once every goal is met. Then each hiker here picks a
 *   reward; a Tier III item or a full reward taken by one is greyed for the
 *   others, with the taker's face on it. Claim rewards applies them all.
 * - Once accomplished it turns grey and read-only, showing who took what.
 */
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { ITEMS } from '../../content';
import { ASSETS, wonderArt } from '../../config/assets';
import { BALANCE } from '../../config/balance';
import {
  NODE_TYPES,
  pickProblem,
  validateAction,
  wonderProgress,
  type Action,
  type GameState,
  type GoalProgress,
  type Hiker,
  type HikerId,
  type NodeType,
  type TileId,
  type WonderPick,
  type WonderProgress,
  type WonderRewardDef,
} from '../../engine';
import { Drift, Face, ItemFace } from '../challenge/ChallengeWindow';
import { Icon } from '../icons/Icon';
import type { IconName } from '../icons/paths';
import { NODE_IMAGE, NODE_NAME } from '../map/looks';
import { useDraggable } from '../windows/useDraggable';
import styles from './WonderWindow.module.css';

type AccomplishAction = Extract<Action, { type: 'accomplishWonder' }>;

/** The debug panel asks the game screen to open the Wonder with this window event. */
export const OPEN_WONDER_EVENT = 'hike:open-wonder';

interface WonderWindowProps {
  state: GameState;
  tileId: TileId;
  onClose(): void;
  onAccomplish(action: AccomplishAction): boolean;
}

export function WonderWindow({ state, tileId, onClose, onAccomplish }: WonderWindowProps) {
  const p = wonderProgress(state, tileId);
  const { ref, windowProps, translate } = useDraggable<HTMLDivElement>('wonder', {
    keepOnStage: 120,
    remember: false,
  });
  const [picking, setPicking] = useState(false);
  const [picks, setPicks] = useState<Record<HikerId, WonderPick>>({});
  const [picker, setPicker] = useState<HikerId | null>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [ref]);

  if (!p) return null;
  const done = p.accomplished;
  // Picking stops if a goal stops being met (a hiker walked off, say).
  const inPicking = picking && p.allMet && !done;
  const here = p.here;
  // Picks only count for hikers still here.
  const livePicks = Object.fromEntries(
    Object.entries(picks).filter(([id]) => here.some((h) => h.id === id)),
  );
  const current = here.find((h) => h.id === picker) ?? here.find((h) => !livePicks[h.id]);
  const action: AccomplishAction = { type: 'accomplishWonder', tileId, picks: livePicks };
  const why = inPicking ? validateAction(state, action) : null;
  const unpicked = here.filter((h) => !livePicks[h.id]).length;

  const choose = (h: Hiker, choice: WonderPick) => {
    const next = { ...livePicks, [h.id]: choice };
    setPicks(next);
    // On to the next hiker who hasn't picked.
    setPicker(here.find((x) => !next[x.id])?.id ?? h.id);
  };

  const left = p.goals.length - p.met;
  const biome = state.sectionIndex + 1;

  return (
    <div className={styles.overlay} data-moved={!!translate}>
      <Drift />
      <div
        ref={ref}
        className={styles.window}
        data-done={done}
        role="dialog"
        aria-modal="false"
        aria-label={`Wonder: ${p.def.name}`}
        tabIndex={-1}
        style={{ translate }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
        {...windowProps}
      >
        <header className={styles.ribbon} data-drag-handle>
          <span className={styles.ribbonSide}>
            <Icon name="sparkles" size={22} color="#FFF6EC" strokeWidth={2.5} />
            WONDER · BIOME {biome}
            {done && <span className={styles.doneTag}>ACCOMPLISHED</span>}
          </span>
          <span className={styles.titleRow}>
            <Icon name="sparkles" size={30} color="#FFF6EC" strokeWidth={2.5} />
            <h2 className={styles.title}>{p.def.name.toUpperCase()}</h2>
            <Icon name="sparkles" size={30} color="#FFF6EC" strokeWidth={2.5} />
          </span>
          <span className={`${styles.ribbonSide} ${styles.ribbonRight}`}>
            <Icon name="users" size={18} color="#FFF6EC" strokeWidth={2} />
            {here.length} {here.length === 1 ? 'HIKER' : 'HIKERS'} HERE
            <button
              type="button"
              className={styles.close}
              aria-label="Close the Wonder"
              title="Close (reopen it from the map icon)"
              onClick={onClose}
            >
              <Icon name="x" size={20} strokeWidth={2.5} />
            </button>
          </span>
        </header>

        <div className={styles.art}>
          <img src={wonderArt(p.def.id)} alt="" draggable={false} />
          <div className={styles.fade} />
          <div className={styles.artText}>
            <span className={styles.quote}>
              “{p.def.description ?? 'Description placeholder: Wyatt is writing this.'}”
            </span>
            <span className={styles.how}>
              {done
                ? 'Accomplished. Each hiker who was here took 1 reward.'
                : 'Meet all 3 goals with the hikers on this tile, then press Accomplish. Each hiker here picks 1 reward.'}
            </span>
          </div>
        </div>

        <div className={styles.body}>
          <section className={styles.goals} aria-label="Goals">
            <div className={styles.head}>
              <span className={styles.headTitle}>GOALS</span>
              <span className={styles.count}>
                {done ? p.goals.length : p.met}/{p.goals.length}
              </span>
              <span className={styles.headNote}>Only hikers on this tile count</span>
            </div>
            {p.goals.map((g) => (
              <GoalRow key={g.index} goal={g} done={done} />
            ))}
          </section>

          <section className={styles.rewards} aria-label="Rewards">
            <div className={styles.head}>
              <span className={styles.headTitle}>REWARDS</span>
              {inPicking ? (
                <span className={styles.pickers}>
                  <span className={styles.headNote}>Picking for</span>
                  {here.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      className={styles.picker}
                      data-current={current?.id === h.id}
                      data-picked={!!livePicks[h.id]}
                      onClick={() => setPicker(h.id)}
                    >
                      <Face hikerId={h.id} size={22} />
                      {h.name.toUpperCase()}
                      {livePicks[h.id] && <Icon name="check" size={13} strokeWidth={3} />}
                    </button>
                  ))}
                </span>
              ) : (
                <span className={styles.headNote}>
                  {done ? 'Who took what' : 'Each hiker here picks 1'}
                </span>
              )}
            </div>
            <div className={styles.cards}>
              {p.def.rewards.map((r, i) => (
                <RewardCard
                  key={i}
                  state={state}
                  p={p}
                  index={i}
                  reward={r}
                  picks={done ? (p.wonder.claimed ?? {}) : livePicks}
                  picker={inPicking ? current : undefined}
                  onPick={(choice) => current && choose(current, choice)}
                />
              ))}
            </div>
          </section>
        </div>

        <footer className={styles.footer}>
          {done ? (
            <button type="button" className={styles.button} disabled>
              <span className={styles.buttonLabel}>ACCOMPLISHED</span>
              <span className={styles.buttonSub}>THE REWARDS ARE CLAIMED</span>
            </button>
          ) : inPicking ? (
            <>
              <button
                type="button"
                className={styles.back}
                onClick={() => {
                  setPicking(false);
                  setPicks({});
                  setPicker(null);
                }}
              >
                BACK
              </button>
              <button
                type="button"
                className={styles.button}
                data-ready={!why}
                disabled={!!why}
                onClick={() => {
                  if (onAccomplish(action)) setPicking(false);
                }}
              >
                <span className={styles.buttonLabel}>CLAIM REWARDS</span>
                <span className={styles.buttonSub}>
                  {!why
                    ? 'EVERY HIKER HAS PICKED'
                    : unpicked
                      ? `${unpicked} STILL TO PICK`
                      : why.toUpperCase()}
                </span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.button}
              data-ready={p.allMet}
              disabled={!p.allMet}
              onClick={() => {
                setPicking(true);
                setPicks({});
                setPicker(here[0]?.id ?? null);
              }}
            >
              <span className={styles.buttonLabel}>ACCOMPLISH</span>
              <span className={styles.buttonSub}>
                {p.allMet
                  ? 'EACH HIKER HERE PICKS 1'
                  : !here.length
                    ? 'NOBODY IS HERE'
                    : `${left} GOAL${left === 1 ? '' : 'S'} LEFT`}
              </span>
            </button>
          )}
          <span className={styles.footNote}>
            {done
              ? 'This Wonder is done for good'
              : inPicking
                ? 'Afterwards the Wonder turns grey'
                : 'Close and reopen it from the map icon'}
          </span>
        </footer>
      </div>
    </div>
  );
}

// ── Goals ──────────────────────────────────────────────────────────────────

/** The number in a goal's text: "6+", "no more than 5", "2 or more". */
function numberWords(goal: GoalProgress): string {
  const x = goal.x ?? 0;
  const n = goal.def.x;
  switch (n?.compare) {
    case 'atMost':
      return `no more than ${x}`;
    case 'moreThan':
      return `more than ${x}`;
    case 'lessThan':
      return `less than ${x}`;
    default:
      return n?.scales === false ? `${x} or more` : `${x}+`;
  }
}

function GoalText({ goal }: { goal: GoalProgress }) {
  const parts = goal.def.text.split('{x}');
  return (
    <span className={styles.goalText}>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <b>{numberWords(goal)}</b>}
          {part}
        </Fragment>
      ))}
    </span>
  );
}

function GoalRow({ goal, done }: { goal: GoalProgress; done: boolean }) {
  const met = done || goal.met;
  return (
    <div className={styles.goal} data-met={met}>
      <div className={styles.tick} data-met={met} aria-label={met ? 'Met' : 'Not met yet'}>
        {met && <Icon name="check" size={24} color="#1D2220" strokeWidth={3} />}
      </div>
      <GoalText goal={goal} />
      {!done && (
        <div className={styles.goalSide}>
          {goal.hikers?.map((h) => (
            <span key={h.hikerId} className={styles.goalHiker} data-ok={h.ok}>
              <Face hikerId={h.hikerId} size={26} />
              {h.ok && <Icon name="check" size={14} color="#A6DDBC" strokeWidth={3} />}
            </span>
          ))}
          {goal.readout && (
            <span className={styles.readout} data-met={goal.met}>
              {goal.readout}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Rewards ────────────────────────────────────────────────────────────────

const REWARD_ICON: Partial<Record<WonderRewardDef['reward']['kind'], IconName>> = {
  cureInjuries: 'medical',
  revealBiome: 'eye',
  energized: 'zap',
  maxStat: 'battery',
  flipConditions: 'sparkles',
  waiting: 'shirt',
};

function RewardCard({
  state,
  p,
  index,
  reward: r,
  picks,
  picker,
  onPick,
}: {
  state: GameState;
  p: WonderProgress;
  index: number;
  reward: WonderRewardDef;
  picks: Record<HikerId, WonderPick>;
  /** The hiker picking now (only while picking). */
  picker: Hiker | undefined;
  onPick(choice: WonderPick): void;
}) {
  const takers = Object.entries(picks).filter(([, c]) => c.reward === index);
  const byOthers = takers.filter(([id]) => id !== picker?.id);
  const waiting = !!r.waitingOn || r.reward.kind === 'waiting';
  const full = r.maxTakers !== undefined && byOthers.length >= r.maxTakers;
  // Why the hiker picking now can't take it (apart from which item or node).
  const blocked = picker
    ? waiting
      ? `Comes in ${r.waitingOn ?? 'a later phase'}`
      : full
        ? `At most ${r.maxTakers} hikers can pick this`
        : bagProblem(state, p, picker, index)
    : undefined;
  const mine = picker && picks[picker.id]?.reward === index;
  const wholeCard =
    !!picker && !blocked && r.reward.kind !== 'tier3' && r.reward.kind !== 'abundance';
  const kind = r.reward.kind;

  let picture: ReactNode;
  if (kind === 'tier3') {
    picture = (
      <div className={styles.items}>
        {(p.wonder.tier3 ?? []).map((itemId) => {
          const owner = Object.entries(picks).find(
            ([, c]) => c.reward === index && c.itemId === itemId,
          )?.[0];
          const takenByOther = !!owner && owner !== picker?.id;
          const can = !!picker && !blocked && !takenByOther;
          return (
            <button
              key={itemId}
              type="button"
              className={styles.item}
              data-taken={takenByOther}
              data-mine={!!owner && owner === picker?.id}
              disabled={!can}
              title={ITEMS[itemId] ? `${ITEMS[itemId].name}: ${ITEMS[itemId].text}` : itemId}
              aria-label={`Pick ${ITEMS[itemId]?.name ?? itemId}`}
              onClick={() => onPick({ reward: index, itemId })}
            >
              <ItemFace itemId={itemId} width={66} />
              {owner && (
                <span className={styles.itemOwner}>
                  <Face hikerId={owner} size={26} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  } else if (kind === 'abundance') {
    picture = (
      <div className={styles.nodes}>
        {NODE_TYPES.map((node: NodeType) => {
          const chosenBy = takers.filter(([, c]) => c.node === node).map(([id]) => id);
          return (
            <button
              key={node}
              type="button"
              className={styles.nodeButton}
              data-mine={!!picker && picks[picker.id]?.node === node && mine}
              disabled={!picker || !!blocked}
              title={`${NODE_NAME[node]}: Abundance ${state.abundance[node]}/${BALANCE.abundance.max}`}
              aria-label={`Raise ${NODE_NAME[node]} Abundance`}
              onClick={() => onPick({ reward: index, node })}
            >
              <img src={NODE_IMAGE[node]} alt="" />
              <span className={styles.nodeValue}>{state.abundance[node]}</span>
              {chosenBy.length > 0 && <span className={styles.nodeMark}>+</span>}
            </button>
          );
        })}
      </div>
    );
  } else if (kind === 'xp') {
    picture = <span className={styles.bigText}>+XP</span>;
  } else if (kind === 'caps') {
    picture = (
      <span className={styles.caps}>
        <img src={ASSETS.icons.acornCaps} alt="" />+{BALANCE.wonders.lotOfCaps}
      </span>
    );
  } else if (kind === 'shelters') {
    picture = (
      <div className={styles.items}>
        <ItemFace itemId="hammock" width={56} />
        <ItemFace itemId="tent" width={56} />
      </div>
    );
  } else {
    picture = (
      <span className={styles.rewardIcon}>
        <Icon name={REWARD_ICON[kind] ?? 'star'} size={52} strokeWidth={2} />
      </span>
    );
  }

  const Card = wholeCard ? 'button' : 'div';
  return (
    <Card
      {...(wholeCard
        ? {
            type: 'button' as const,
            onClick: () => onPick({ reward: index }),
            'aria-label': `Pick ${r.title}`,
          }
        : {})}
      className={styles.reward}
      data-waiting={waiting}
      data-mine={!!mine}
      data-blocked={!!picker && !!blocked}
      data-taken={takers.length > 0}
    >
      <div className={styles.picture}>{picture}</div>
      <span className={styles.rewardTitle}>{r.title.toUpperCase()}</span>
      <span className={styles.rewardText}>{r.text}</span>
      {waiting && (
        <span className={styles.later}>COMES IN {(r.waitingOn ?? '').toUpperCase()}</span>
      )}
      {picker && blocked && !waiting && <span className={styles.blockedWhy}>{blocked}</span>}
      <span className={styles.spacer} />
      <div className={styles.takers}>
        {takers.map(([id, c]) => (
          <span key={id} className={styles.taker}>
            <Face hikerId={id} size={24} />
            {(state.hikers.find((h) => h.id === id)?.name ?? id).toUpperCase()}
            {c.node && ` · ${NODE_NAME[c.node].toUpperCase()}`}
          </span>
        ))}
      </div>
    </Card>
  );
}

/** A bag that's too full for this reward, for the hiker picking. */
function bagProblem(
  state: GameState,
  p: WonderProgress,
  h: Hiker,
  index: number,
): string | undefined {
  const r = p.def.rewards[index];
  if (!r) return undefined;
  // Check with a stand-in choice, so "which item" or "which node" isn't the problem.
  const probe: WonderPick =
    r.reward.kind === 'tier3'
      ? { reward: index, itemId: p.wonder.tier3?.[0] ?? '' }
      : r.reward.kind === 'abundance'
        ? { reward: index, node: 'forest' }
        : { reward: index };
  return pickProblem(state, p, h, probe);
}
