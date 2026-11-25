/**
 * The animal above the box (docs/design/12-minigames-dodge.md, section 3,
 * "Portraits", round 3; mockups 16-portraits.png and 17-in-game-*.png):
 * one solid dark head with its details cut out, like Sans in Undertale.
 *
 * - **Style:** Solid (only the dark green) or Solid + red (a few red details).
 * - **Placement:** 1 px per unit, centered at x 160, its bottom a gap above
 *   the box's top as the fight starts (the box moves down when a portrait
 *   would reach too high; see `boxFor`). In the Stampede, the portrait of
 *   whoever attacked last, over that animal's own box (the moose during a
 *   Herd rush). The Woods Monster has a cultist on each side, their bottoms
 *   lined up with his, and the candles the wisps come from.
 * - **Motion** (can be turned off): a blink every few seconds, and a small
 *   bob, the cultists half a beat out of step.
 */
import { BALANCE } from '../../../config/balance';
import { nextFloat, seedRng } from '../../../engine/rng';
import { boxFor, PORTRAITS } from '../../../minigames/dodge/animals';
import { CANDLES } from '../../../minigames/dodge/attacks/monster';
import type { AnimalId, Attacker } from '../../../minigames/dodge/logic';
import { asset } from '../../../config/assets';
import ui from '../gpsUi.module.css';
import styles from './Dodge.module.css';
import { art } from './parts/drawTypes';

const P = BALANCE.minigames.dodge.portraits;

export type PortraitStyle = 'solid' | 'solid-red';

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

/** How far up the bob is now: up for the first half of each beat. */
const bobAt = (time: number, offset = 0): number =>
  ((time + offset) % P.bobSec) / P.bobSec < 0.5 ? -P.bob : 0;

export function Portraits({
  animal,
  showing,
  style,
  motion,
  time,
  seed,
}: {
  animal: AnimalId;
  showing: readonly Attacker[];
  style: PortraitStyle;
  motion: boolean;
  time: number;
  seed: number;
}) {
  const who: Attacker =
    animal === 'stampede' ? (showing.at(-1) ?? 'herd') : (animal as Exclude<AnimalId, 'stampede'>);
  const p = PORTRAITS[who];
  const box = boxFor(who);
  const bottom = box.cy - box.h / 2 - P.gap;
  const file = (name: string, shut: boolean) =>
    asset(`minigames/dodge/portraits/${style}/${name}${shut ? '-blink' : ''}.png`);

  const head = (
    <img
      key={who}
      className={`${ui.sprite} ${styles.animal}`}
      src={file(p.file, motion && blinking(time, seed, 0))}
      alt=""
      draggable={false}
      style={{
        left: 160 - p.w / 2,
        top: bottom - p.h + (motion ? bobAt(time) : 0),
        width: p.w,
        height: p.h,
      }}
    />
  );
  if (who !== 'monster') return head;

  const c = PORTRAITS.cultist;
  return (
    <>
      {head}
      {CULTIST_X.map((x, k) => (
        <span key={k}>
          <img
            className={`${ui.sprite} ${styles.animal}`}
            src={file(c.file, motion && blinking(time, seed, k + 1))}
            alt=""
            draggable={false}
            style={{
              left: x - c.w / 2,
              top: bottom - c.h + (motion ? bobAt(time, P.bobSec / 2) : 0),
              width: c.w,
              height: c.h,
            }}
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
