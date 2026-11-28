/**
 * The Skill Trails window (Phase 10.7, docs/mockups/skill-trails/
 * skill-trails-window.jpg, look A; the badge and trail language is in
 * skill-trails-legend.jpg).
 *
 * - **Header:** SKILL TRAILS with the hiker's portrait and name, the party's
 *   portraits to switch hikers, the party level bar and points, and ×.
 * - **The map:** a dark topographic background with soft class-colored
 *   glows; three trails from one trailhead, one per tree, each named in
 *   italic serif. Each step is a badge with its name and "New trait" or
 *   "Upgrade" under it.
 * - **Side panel:** the selected step's badge, name, trail, text (On/Off for
 *   a toggle, what changed in yellow for an upgrade) and Learn.
 *
 * As a window over the map for planning; full screen after a level-up.
 * Reduced motion: no moving dashes or pulses.
 */
import { useOpenSound } from '../../audio/uiSounds';
import { useMemo, useState, type CSSProperties } from 'react';
import { stepText } from '../../content/trails/traits';
import { treesOf, type Action, type GameState, type Hiker } from '../../engine';
import { hikerColor } from '../../content/characters';
import { HikerPortrait } from '../hikers/HikerPortrait';
import { traitIconUrl } from '../traits/traitIcons';
import { Glyph } from './classGlyphs';
import { CLASS_GLYPHS } from './glyphPaths';
import { partyProgress } from './partyProgress';
import { shade, type StepLook } from './stepLook';
import { trailMap } from './trailMap';
import { firstStep, marked, trailsView, type StepView } from './trailsView';
import styles from './SkillTrails.module.css';

/** The window's size on the stage (1600 × 1000); full screen fills it. */
const WINDOW = { width: 1440, height: 900 };
const HEADER = 92;
const SIDE = 300;

export function SkillTrails({
  state,
  hikerId,
  full = false,
  onPickHiker,
  onAction,
  onClose,
}: {
  state: GameState;
  hikerId: string;
  /** After a level-up: the same layout, filling the screen. */
  full?: boolean;
  onPickHiker(id: string): void;
  onAction(action: Action): boolean;
  onClose(): void;
}) {
  useOpenSound('trails.open');
  const hikers = state.hikers.filter((h) => h.status !== 'abandoned' && !!treesOf(h));
  const hiker = hikers.find((h) => h.id === hikerId) ?? hikers[0];
  const view = hiker ? trailsView(state, hiker) : [];
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const width = full ? 1600 : WINDOW.width;
  const height = full ? 1000 : WINDOW.height;
  const mapW = width - SIDE;
  const mapH = height - HEADER;
  const shape = useMemo(() => trailMap(mapW, mapH), [mapW, mapH]);
  if (!hiker) return null;
  const all = view.flatMap((t) => t.steps);
  const selectedId = all.some((s) => s.step.id === picked) ? picked : firstStep(view);
  const selected = all.find((s) => s.step.id === selectedId);
  const { level, points, fill } = partyProgress(state);
  const color = hikerColor(hiker);

  return (
    <div className={full ? styles.full : styles.backdrop} onClick={full ? undefined : onClose}>
      <div
        className={styles.window}
        data-full={full || undefined}
        role="dialog"
        aria-label={`Skill Trails: ${hiker.name}`}
        style={{ width, height }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header} style={{ height: HEADER }}>
          <HikerPortrait
            hikerId={hiker.id}
            className={styles.portrait}
            style={{ boxShadow: `0 0 0 3px ${color}` }}
          />
          <div className={styles.titles}>
            <span className={styles.title}>SKILL TRAILS</span>
            <span className={styles.hikerName} style={{ color }}>
              {hiker.name}
            </span>
          </div>
          <div className={styles.party} role="tablist" aria-label="Hikers">
            {hikers.map((h) => (
              <button
                key={h.id}
                type="button"
                role="tab"
                aria-selected={h.id === hiker.id}
                aria-label={h.name}
                title={h.name}
                className={styles.partyFace}
                onClick={() => {
                  setPicked(undefined);
                  onPickHiker(h.id);
                }}
              >
                <HikerPortrait
                  hikerId={h.id}
                  className={styles.partyPortrait}
                  style={{ boxShadow: `0 0 0 ${h.id === hiker.id ? 3 : 2}px ${hikerColor(h)}` }}
                />
              </button>
            ))}
          </div>
          <div className={styles.level}>
            <span className={styles.levelWord}>PARTY LV {level}</span>
            <span className={styles.levelTrack}>
              <span style={{ width: `${fill * 100}%` }} />
            </span>
            <span className={styles.levelPoints}>
              {points > 0 ? (
                <>
                  <b>
                    {points} point{points === 1 ? '' : 's'}
                  </b>{' '}
                  to spend
                </>
              ) : (
                'No points to spend'
              )}
            </span>
          </div>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className={styles.body} style={{ height: mapH }}>
          <div
            className={styles.map}
            style={{ width: mapW, height: mapH }}
            data-edge-window="Skill Trails"
          >
            <svg className={styles.svg} width={mapW} height={mapH} aria-hidden="true">
              <defs>
                {view.map((t, i) => (
                  <radialGradient key={t.tree.id} id={`glow-${i}`}>
                    <stop offset="0%" stopColor={t.color} stopOpacity={0.34} />
                    <stop offset="100%" stopColor={t.color} stopOpacity={0} />
                  </radialGradient>
                ))}
              </defs>
              {shape.columns.map((c, i) => (
                <ellipse
                  key={i}
                  cx={c.x}
                  cy={mapH * 0.46}
                  rx={mapW * 0.24}
                  ry={mapH * 0.52}
                  fill={`url(#glow-${i})`}
                />
              ))}
              {shape.contours.map((d, i) => (
                <path key={i} d={d} className={styles.contour} />
              ))}
              <path d={shape.trunk} className={styles.trunk} />
              {view.map((t, c) =>
                t.steps.map((s, k) => (
                  <path
                    key={s.step.id}
                    d={shape.columns[c]!.paths[k]}
                    className={styles.trail}
                    data-state={s.state}
                    style={{ '--c': t.color } as CSSProperties}
                  />
                )),
              )}
              <circle
                cx={shape.trailhead.x}
                cy={shape.trailhead.y}
                r={13}
                className={styles.trailhead}
              />
            </svg>
            <span
              className={styles.trailheadWord}
              style={{ left: shape.trailhead.x, top: shape.trailhead.y + 18 }}
            >
              TRAILHEAD
            </span>
            {view.map((t, c) => (
              <span
                key={t.tree.id}
                className={styles.treeName}
                style={{ left: shape.columns[c]!.x, top: shape.columns[c]!.nameY, color: t.color }}
              >
                {t.tree.name}
              </span>
            ))}
            {view.map((t, c) =>
              t.steps.map((s, k) => (
                <StepBadge
                  key={s.step.id}
                  step={s}
                  at={shape.columns[c]!.nodes[k]!}
                  selected={s.step.id === selectedId}
                  onSelect={() => setPicked(s.step.id)}
                />
              )),
            )}
          </div>
          {selected && (
            <SidePanel
              hiker={hiker}
              step={selected}
              onLearn={() =>
                onAction({ type: 'learnStep', hikerId: hiker.id, stepId: selected.step.id })
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** A badge's shape, color and icon (or class glyph); an upgrade is smaller with its II/III tag. */
export function TrailBadgeIcon({
  look,
  size,
  dim = false,
}: {
  look: StepLook;
  size: number;
  dim?: boolean;
}) {
  const icon = traitIconUrl(look.step.id);
  const vars = {
    '--c': look.color,
    '--fill': dim ? '#1F2624' : shade(look.color, 0.38),
    '--s': `${size}px`,
  } as CSSProperties;
  return (
    <span className={styles.icon} data-shape={look.shape} data-dim={dim || undefined} style={vars}>
      <span className={styles.face}>
        {icon ? (
          <span
            className={styles.art}
            style={{ maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})` }}
          />
        ) : (
          <Glyph
            path={CLASS_GLYPHS[look.cls]}
            size={size * 0.48}
            color="var(--c)"
            strokeWidth={2.2}
          />
        )}
      </span>
      {look.tag && <span className={styles.tag}>{look.tag}</span>}
    </span>
  );
}

function StepBadge({
  step,
  at,
  selected,
  onSelect,
}: {
  step: StepView;
  at: { x: number; y: number };
  selected: boolean;
  onSelect(): void;
}) {
  const upgrade = step.step.step === 'upgrade';
  return (
    <button
      type="button"
      className={styles.step}
      data-edge-card={step.step.name}
      data-state={step.state}
      data-selected={selected || undefined}
      data-upgrade={upgrade || undefined}
      style={{ left: at.x, top: at.y, '--c': step.look.color } as CSSProperties}
      aria-pressed={selected}
      aria-label={`${step.step.name}, ${step.look.stepWord}. ${
        step.state === 'learned'
          ? step.levels > 1
            ? `Learned, level ${step.level} of ${step.levels}.`
            : 'Learned.'
          : step.needLevel
            ? `Party level ${step.needLevel}.`
            : `${step.cost} points.`
      }`}
      // The next level, on hover (26-fixes-and-wyatt-trees.md, section 5.1).
      title={step.next ? `Next level: ${stepText(step.next.step)}` : undefined}
      onClick={onSelect}
    >
      {upgrade && <span className={styles.arrow} aria-hidden="true" />}
      <TrailBadgeIcon look={step.look} size={upgrade ? 46 : 62} dim={step.state === 'notYet'} />
      <span className={styles.label}>
        <span className={styles.stepName}>{step.step.name}</span>
        <span className={styles.stepWord}>{step.look.stepWord}</span>
      </span>
      {step.state === 'open' && (
        <span className={styles.cost}>
          {step.cost} {step.cost === 1 ? 'PT' : 'PTS'}
        </span>
      )}
      {step.state === 'notYet' && step.needLevel !== undefined && (
        <span className={styles.need}>PARTY LV {step.needLevel}</span>
      )}
      {step.levels > 1 && (
        <span className={styles.pips} aria-hidden="true">
          {Array.from({ length: step.levels }, (_, i) => (
            <span key={i} data-on={i < step.level || undefined} />
          ))}
        </span>
      )}
    </button>
  );
}

/** "On: …" and "Off: …" for a toggle; otherwise the text, with what changed in yellow. */
function StepText({ step }: { step: StepView['step'] }) {
  const paras =
    step.kind === 'toggle'
      ? [
          { label: 'On:', text: step.on ?? '' },
          { label: 'Off:', text: step.off ?? '' },
        ]
      : [{ label: '', text: stepText(step) }];
  // A toggle's changes are written "off: …" in the data; only the text after the colon is matched.
  const changed = (step.changed ?? []).map((c) => c.replace(/^(on|off): /, ''));
  return (
    <>
      {paras.map((p) => (
        <p key={p.label} className={styles.text}>
          {p.label && <b>{p.label} </b>}
          {marked(p.text, changed).map((part, i) =>
            part.changed ? (
              <span key={i} className={styles.changed}>
                {part.text}
              </span>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
        </p>
      ))}
    </>
  );
}

function SidePanel({ hiker, step, onLearn }: { hiker: Hiker; step: StepView; onLearn(): void }) {
  const learned = step.state === 'learned';
  // Planning by day: everything else is fine, but Learn waits for night or a station.
  const why = step.reason;
  const canLearn = !learned && !why;
  const next = learned ? step.next : undefined;
  return (
    <aside className={styles.side} style={{ width: SIDE }} aria-label={step.step.name}>
      <TrailBadgeIcon look={step.look} size={78} />
      <h2 className={styles.sideName}>{step.step.name}</h2>
      <span className={styles.sideTree} style={{ color: step.look.color }}>
        {step.look.tree.name}
      </span>
      {step.levels > 1 && (
        <span className={styles.sideLevel}>
          {learned ? `LEVEL ${step.level} OF ${step.levels}` : `${step.levels} LEVELS`}
        </span>
      )}
      <div className={styles.sideText}>
        <StepText step={step.step} />
        {next && (
          <div className={styles.nextLevel}>
            <span className={styles.nextLabel}>NEXT LEVEL</span>
            <StepText step={next.step} />
          </div>
        )}
      </div>
      <div className={styles.learnBox}>
        {next ? (
          <>
            {why && <span className={styles.why}>{why}</span>}
            <button
              type="button"
              className={styles.learn}
              disabled={!!why}
              onClick={onLearn}
              aria-label={`Raise ${step.step.name} to level ${step.level + 1} for ${next.cost} points (${hiker.name})`}
            >
              LEVEL UP{' '}
              <span>
                {next.cost} point{next.cost === 1 ? '' : 's'}
              </span>
            </button>
          </>
        ) : learned ? (
          <span className={styles.learned}>LEARNED</span>
        ) : (
          <>
            {why && <span className={styles.why}>{why}</span>}
            <button
              type="button"
              className={styles.learn}
              disabled={!canLearn}
              onClick={onLearn}
              aria-label={`Learn ${step.step.name} for ${step.cost} points (${hiker.name})`}
            >
              LEARN{' '}
              <span>
                {step.cost} point{step.cost === 1 ? '' : 's'}
              </span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
