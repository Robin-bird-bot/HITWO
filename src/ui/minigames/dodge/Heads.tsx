/**
 * The animal above the box (docs/design/12-minigames-dodge.md, sections 3
 * and 7 to 11; mockups 1, 4 and 7 to 9): one head, placed as in its
 * mockup, or the Stampede's row of heads with a frame on whoever is
 * attacking.
 */
import type { AnimalId, Attacker } from '../../../minigames/dodge/logic';
import ui from '../gpsUi.module.css';
import styles from './Dodge.module.css';
import { art } from './parts/drawTypes';

/** Each head's art, size and place (its top-left), as in the mockups. */
const HEADS: Readonly<
  Record<
    Exclude<Attacker, 'bees' | 'herd'>,
    { file: string; w: number; h: number; x: number; y: number }
  >
> = {
  bear: { file: 'bear-head.png', w: 39, h: 34, x: 140, y: 38 },
  swordBear: { file: 'bear-head.png', w: 39, h: 34, x: 140, y: 28 },
  bobcat: { file: 'bobcat-head.png', w: 30, h: 28, x: 145, y: 40 },
  squirrels: { file: 'squirrel-head.png', w: 30, h: 26, x: 145, y: 36 },
};

/** The Stampede's row: each animal at about 3/4 size (the bee at 2×), and the moose for Herd rush. */
const ROW: readonly { who: Attacker[]; file: string; w: number; h: number }[] = [
  { who: ['bees'], file: 'bee-1.png', w: 20, h: 14 },
  { who: ['bear', 'swordBear'], file: 'bear-head.png', w: 29, h: 26 },
  { who: ['bobcat'], file: 'bobcat-head.png', w: 24, h: 22 },
  { who: ['squirrels'], file: 'squirrel-head.png', w: 24, h: 21 },
  { who: ['herd'], file: 'moose.png', w: 26, h: 20 },
];

export function Heads({
  animal,
  showing,
  beeFrame,
  ideas,
}: {
  animal: AnimalId;
  showing: readonly Attacker[];
  beeFrame: string;
  ideas: boolean;
}) {
  if (animal === 'bees') {
    return (
      <>
        <img
          className={`${ui.sprite} ${styles.animal}`}
          src={art(beeFrame)}
          alt="A bee"
          draggable={false}
          style={{ left: 160 - 15, top: 36, width: 30, height: 21 }}
        />
        <span className={`${ui.muted} ${styles.bzz}`}>BZZ</span>
      </>
    );
  }
  if (animal !== 'stampede') {
    const h = HEADS[animal];
    return (
      <img
        className={`${ui.sprite} ${styles.animal}`}
        src={art(h.file)}
        alt=""
        draggable={false}
        style={{ left: h.x, top: h.y, width: h.w, height: h.h }}
      />
    );
  }
  const row = ROW.filter((r) => ideas || !r.who.includes('herd'));
  const gap = 10;
  const width = row.reduce((sum, r) => sum + r.w, 0) + gap * (row.length - 1);
  const lefts = row.map(
    (_, k) => 160 - width / 2 + row.slice(0, k).reduce((sum, r) => sum + r.w + gap, 0),
  );
  return (
    <>
      {row.map((r, k) => {
        const left = lefts[k]!;
        const on = r.who.some((w) => showing.includes(w));
        return (
          <span
            key={r.file}
            className={styles.headSlot}
            data-on={on || undefined}
            style={{ left: left - 3, top: 30, width: r.w + 6, height: 40 }}
          >
            <img
              className={ui.sprite}
              src={art(r.file === 'bee-1.png' ? beeFrame : r.file)}
              alt=""
              draggable={false}
              style={{ width: r.w, height: r.h }}
            />
          </span>
        );
      })}
    </>
  );
}
