/**
 * The station's room (docs/mockups/Station.dc.html): the window wall onto a
 * darkened forest (layers 241, 271, 266 and 265), the stone fireplace with its
 * flickering fire and warm light (still under reduced motion), the hanging
 * sign with the theme's name, and the shopkeeper behind the counter.
 */
import { ASSETS, asset } from '../../config/assets';
import type { StationTheme } from '../../engine';
import stones from './fireplace-stones.svg';
import styles from './StationScreen.module.css';

/** Back to front, each a little brighter (BUILD_PLAN: "roughly brightness 0.42–0.6"). */
const FOREST = [
  { src: asset('backgrounds/241-mountains-blue.webp'), filter: 'brightness(0.42) saturate(0.75)' },
  { src: asset('backgrounds/271-pine-row-navy.webp'), filter: 'brightness(0.5) saturate(0.8)' },
  {
    src: asset('backgrounds/266-pine-forest-dense.webp'),
    filter: 'brightness(0.55) saturate(0.8)',
  },
  { src: asset('backgrounds/265-pine-row-bright.webp'), filter: 'brightness(0.6) saturate(0.85)' },
];

/** What sits on the mantel. */
const MANTEL = [
  { id: 'fish', left: 52, top: 152, size: 48 },
  { id: 'mushroom', left: 246, top: 154, size: 44 },
  { id: 'meat', left: 296, top: 160, size: 40 },
];

export function StationRoom({ theme, checkpoint }: { theme: StationTheme; checkpoint: number }) {
  const long = theme.name.length > 26;
  return (
    <>
      <div className={styles.window} aria-hidden="true">
        <div className={styles.forest}>
          {FOREST.map((l) => (
            <img key={l.src} src={l.src} alt="" style={{ filter: l.filter }} draggable={false} />
          ))}
        </div>
        <div className={styles.glass} />
        <div className={styles.beamTop} />
        <div className={styles.beamMid} />
        <div className={styles.mullions} />
      </div>

      <Fireplace />

      <div className={styles.rope} style={{ left: 600 }} aria-hidden="true" />
      <div className={styles.rope} style={{ left: 880 }} aria-hidden="true" />
      <div className={`${styles.sign} ${styles.wood}`}>
        <h1 className={styles.signName} data-long={long || undefined}>
          {theme.name.toUpperCase()}
        </h1>
        <span className={styles.signSub}>RANGER STATION · CHECKPOINT {checkpoint}</span>
      </div>

      <div className={styles.keeper}>
        <img
          src={ASSETS.shopkeeper(theme.shopkeeper.portrait)}
          alt={`${theme.shopkeeper.name}, the shopkeeper`}
          draggable={false}
        />
      </div>
    </>
  );
}

/** The Businessman's resting arm: in front of the counter, in the same frame. */
export function KeeperArm({ theme }: { theme: StationTheme }) {
  if (!theme.shopkeeper.arm) return null;
  return (
    <div className={`${styles.keeper} ${styles.arm}`} aria-hidden="true">
      <img src={ASSETS.shopkeeper(theme.shopkeeper.arm)} alt="" draggable={false} />
    </div>
  );
}

function Fireplace() {
  return (
    <>
      <div className={styles.chimney} aria-hidden="true">
        <img className={styles.stones} src={stones} alt="" draggable={false} />
        <div className={styles.hearth}>
          <div className={styles.embers} />
          <svg className={styles.flames} width="170" height="130" viewBox="0 0 170 130">
            <g className={styles.flameA}>
              <path
                d="M85 128C40 128 34 92 56 66c6 18 16 22 18 10 3-22-8-40 10-72 6 30 30 44 32 74 1 14 8 8 14-4 16 26 8 54-45 54z"
                fill="#FF7A2F"
              />
            </g>
            <g className={styles.flameB}>
              <path
                d="M86 128c-30 0-36-24-22-44 4 12 12 12 12 2 0-14 2-28 12-44 6 22 22 32 22 54 0 6 6 4 10-2 8 20-6 34-34 34z"
                fill="#FFB347"
              />
            </g>
            <g className={styles.flameC}>
              <path
                d="M86 128c-16 0-20-12-12-24 3 6 7 5 7-1 0-8 2-14 7-22 4 12 12 18 12 30 0 10-6 17-14 17z"
                fill="#FFE08A"
              />
            </g>
          </svg>
          <div
            className={styles.log}
            style={{
              left: 34,
              bottom: 18,
              width: 132,
              background: 'linear-gradient(#6B4426, #3E2414)',
              transform: 'rotate(-6deg)',
            }}
          />
          <div
            className={styles.log}
            style={{
              left: 40,
              bottom: 14,
              width: 124,
              background: 'linear-gradient(#7A4C2A, #4A2C18)',
              transform: 'rotate(7deg)',
            }}
          />
          <div className={styles.coals} />
        </div>
      </div>
      <div className={`${styles.mantel} ${styles.wood}`} aria-hidden="true" />
      {MANTEL.map((m) => (
        <img
          key={m.id}
          className={styles.mantelThing}
          src={ASSETS.resources[m.id]}
          alt=""
          style={{ left: m.left, top: m.top, width: m.size, height: m.size }}
          draggable={false}
          aria-hidden="true"
        />
      ))}
      <div className={styles.firelight} aria-hidden="true" />
    </>
  );
}
