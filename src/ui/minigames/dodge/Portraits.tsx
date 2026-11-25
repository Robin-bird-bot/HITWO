/**
 * The animal above the box (docs/design/12-minigames-dodge.md, section 3,
 * "Portraits"; mockups 16-portraits.png, 17-in-game-*.png and
 * 20-portrait-motion.gif): one solid dark head with its details cut out,
 * like Sans in Undertale, with a few red details (Solid + red, the look
 * Wyatt picked).
 *
 * - **Placement:** 1 px per unit, centered at x 160, its bottom a gap above
 *   the box's top as the fight starts (the box moves down when a portrait
 *   would reach too high; see `boxFor`). In the Stampede, the portrait of
 *   whoever attacked last, over that animal's own box (the moose during a
 *   Herd rush). The Woods Monster has a cultist on each side, their bottoms
 *   lined up with his, and the candles the wisps come from.
 * - **Motion** (the Portrait motion setting turns it off): the bee and the
 *   Woods Monster float smoothly up and down, drawn at whole units; the
 *   others do the old pixel idle bob, swapping to their `-bob` frame and
 *   back (the two cultists out of step); and every head blinks now and then.
 * - **Glare's warning:** the Woods Monster's eyes flash red rings.
 */
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { nextFloat, seedRng } from '../../../engine/rng';
import { MONSTER_EYES, portraitAt, PORTRAITS } from '../../../minigames/dodge/animals';
import { CANDLES } from '../../../minigames/dodge/attacks/monster';
import type { AnimalId, Attacker } from '../../../minigames/dodge/logic';
import { RED } from '../../../minigames/greens';
import ui from '../gpsUi.module.css';
import styles from './Dodge.module.css';
import { art } from './parts/drawTypes';
import { floatOffset } from './portraitMotion';

const P = BALANCE.minigames.dodge.portraits;

/** The cultists' middles (x), as in mockup 17. */
const CULTIST_X = [60, 260] as const;

/**
 * Whether a portrait has its eyes shut now: every few seconds at random
 * (from the game's seed, so a replay blinks the same), for a moment.
 */
function blinking(time: number, seed: number, salt: number): boolean {
  const rng = seedRng((seed + salt * 7919) >>> 0);
  const gap = () => P.blinkEverySec[0] + nextFloat(rng) * (P.blinkEverySec[1] - P.blinkEverySec[0]);
  for (let at = gap(); at <= time; at += gap()) {
    if (time < at + P.blinkSec) return true;
  }
  return false;
}

/** The idle bob: whether the `-bob` frame shows now (`step` shifts it a beat). */
const bobbed = (time: number, step = 0): boolean => (Math.floor(time / P.bobSec) + step) % 2 === 1;

const file = (name: string, bob: boolean, shut: boolean) =>
  asset(
    `minigames/dodge/portraits/solid-red/${name}${bob ? '-bob' : ''}${shut ? '-blink' : ''}.png`,
  );

export function Portraits({
  animal,
  showing,
  motion,
  time,
  seed,
  glaring = false,
}: {
  animal: AnimalId;
  showing: readonly Attacker[];
  motion: boolean;
  time: number;
  seed: number;
  /** Glare is warning: the Woods Monster's eyes flash red. */
  glaring?: boolean;
}) {
  const who: Attacker =
    animal === 'stampede' ? (showing.at(-1) ?? 'herd') : (animal as Exclude<AnimalId, 'stampede'>);
  const p = PORTRAITS[who];
  const at = portraitAt(who);
  const flies = !!P.float[who];
  const dy = motion ? floatOffset(who, time) : 0;
  const bob = motion && !flies && bobbed(time);
  const shut = motion && blinking(time, seed, 0);

  const head = (
    <img
      key={who}
      className={`${ui.sprite} ${styles.animal}`}
      src={file(p.file, bob, shut)}
      alt=""
      draggable={false}
      style={{ left: at.x, top: at.y + dy, width: p.w, height: p.h }}
    />
  );
  if (who !== 'monster') return head;

  const c = PORTRAITS.cultist;
  const flash = glaring && Math.floor(time / 0.1) % 2 === 0;
  return (
    <>
      {head}
      {flash &&
        MONSTER_EYES.map((e, k) => (
          <span
            key={k}
            className={styles.eyeRing}
            style={{ left: at.x + e.x - 4, top: at.y + dy + e.y - 4, borderColor: RED }}
            aria-hidden="true"
          />
        ))}
      {CULTIST_X.map((x, k) => (
        <span key={k}>
          <img
            className={`${ui.sprite} ${styles.animal}`}
            src={file(c.file, motion && bobbed(time, k), motion && blinking(time, seed, k + 1))}
            alt=""
            draggable={false}
            style={{ left: x - c.w / 2, top: at.y + p.h - c.h, width: c.w, height: c.h }}
          />
          <img
            className={`${ui.sprite} ${styles.animal}`}
            src={art('candle.png')}
            alt=""
            draggable={false}
            style={{ left: CANDLES[k]!.x - 3, top: CANDLES[k]!.y - 2, width: 6, height: 11 }}
          />
        </span>
      ))}
    </>
  );
}
