/**
 * Safari on the GPS (docs/design/18-minigames-quick.md, section 4; mockups
 * 5-safari-parade.png, 6-safari-question.png and 7-safari-night.png), in
 * scene units (320 × 240): a hillside meadow with a game trail, bushes, and
 * animals walking down toward the party (birds zigzag across). Then the
 * screen dims, the question shows, and the hiker at the front picks a sign.
 *
 * - **Night:** everything outside the flashlight's cone is dark; the cone
 *   comes up from the bottom middle and points straight at the mouse (or
 *   the finger; Left and Right or A and D swing it). Animals in the dark
 *   show only their eyes.
 * - **Fog:** patches drift across and hide most of what's behind them.
 */
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import {
  BEAM_FROM,
  beamAngle,
  bigfootAt,
  guess,
  guesser,
  inBeam,
  isQuestionType,
  newSafari,
  question,
  result,
  tick,
} from '../../../minigames/safari/logic';
import { BIGFOOT, kindInfo, positionAt, type Kind } from '../../../minigames/safari/run';
import { TIER_LABELS } from '../../../minigames/types';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { toScene } from '../sceneCoords';
import { playSound } from '../sound';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from './Quick.module.css';
import styles from './Safari.module.css';
import { TurnBar } from './TurnBar';
import { useFixedLoop, useKeys, useReportOnce } from './useQuick';

const S = BALANCE.minigames.safari;
const art = (f: string) => asset(`minigames/safari/${f}`);
const HILL_H = S.bottom - S.top;

export function Safari({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const version = pickOf(settings, 'version');
  const qs = pickOf(settings, 'questions');
  const bigfoot = pickOf(settings, 'bigfoot');
  const forced = pickOf(settings, 'question');
  const [game, setGame] = useState(() =>
    newSafari(
      {
        tier,
        version: version === 'day' || version === 'night' || version === 'fog' ? version : 'auto',
        questions: qs === '1' ? 1 : qs === '2' ? 2 : 'auto',
        bigfoot: bigfoot === 'always' || bigfoot === 'never' ? bigfoot : 'auto',
        question: isQuestionType(forced) ? forced : 'random',
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const sceneRef = useRef<HTMLDivElement>(null);
  // Each screen's own mask id (the testing tab's preview draws one too).
  const maskId = `safari-beam-${useId().replace(/:/g, '')}`;
  const [aim, setAim] = useState(-Math.PI / 2);
  const held = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const running = !still && !game.over;
  useFixedLoop(running, setGame, tick);
  useReportOnce(game, still, onDone, result);

  const run = game.run;
  const watching = game.phase === 'watch';
  const asking = game.phase !== 'watch';
  const now = Math.min(game.time, run.watchSec);
  const cur = question(game);
  const who = guesser(game);

  const pick = (k: number) => {
    const out = guess(game, k);
    if (out === game) return;
    playSound(out.lastGuess?.right ? 'pop' : 'miss');
    setGame(out);
  };
  useKeys(
    running,
    (key) => {
      if (asking && /^[1-9]$/.test(key)) {
        pick(Number(key) - 1);
        return true;
      }
      if (run.night && watching && ['ArrowLeft', 'a', 'ArrowRight', 'd'].includes(key)) {
        held.current[key === 'ArrowLeft' || key === 'a' ? 'left' : 'right'] = true;
        return true;
      }
      return false;
    },
    (key) => {
      if (key === 'ArrowLeft' || key === 'a') held.current.left = false;
      if (key === 'ArrowRight' || key === 'd') held.current.right = false;
    },
  );
  // Keys swing the beam while held.
  useEffect(() => {
    if (!run.night || !running) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function loop(t) {
      const dt = (t - last) / 1000;
      last = t;
      const dir = (held.current.right ? 1 : 0) - (held.current.left ? 1 : 0);
      if (dir) {
        setAim((a) =>
          Math.min(
            -0.05,
            Math.max(-Math.PI + 0.05, a + (dir * S.keyDegPerSec * Math.PI * dt) / 180),
          ),
        );
      }
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [run.night, running]);

  const aimAt = (e: ReactPointerEvent) => {
    if (!run.night) return;
    const p = toScene(sceneRef.current, e.clientX, e.clientY);
    if (p.y < BEAM_FROM.y) setAim(beamAngle(p));
  };

  // Everything on the hillside now, back to front by its feet (bushes hide what's behind them).
  type Drawn = { key: string; y: number; el: React.ReactNode };
  const items: Drawn[] = [];
  const eyes: { x: number; y: number }[] = [];
  run.bushes.forEach((b, k) =>
    items.push({
      key: `b${k}`,
      y: b.y,
      el: (
        <img
          key={`b${k}`}
          className={`${ui.sprite} ${q.thing}`}
          src={art('bush.png')}
          alt=""
          draggable={false}
          style={{ left: b.x - 22, top: b.y - 26 - S.top, width: 44, height: 26 }}
        />
      ),
    }),
  );
  for (const a of run.animals) {
    const p = positionAt(a, now);
    if (!p) continue;
    const k = kindInfo(a.kind);
    const frame = p.stopped ? 1 : Math.floor((now - a.enterAt) / S.frameSec) % 2 === 0 ? 1 : 2;
    const head = { x: p.x, y: p.y - k.h * 0.75 };
    if (run.night && !inBeam(head, aim)) eyes.push(head);
    items.push({
      key: `a${a.id}`,
      y: p.y,
      el: (
        <span key={`a${a.id}`}>
          <img
            className={`${ui.sprite} ${q.thing}`}
            src={art(`animal-${a.kind}-${frame}.png`)}
            alt=""
            draggable={false}
            style={{
              left: p.x - k.w / 2,
              top: p.y - k.h - S.top,
              width: k.w,
              height: k.h,
              transform: a.does === 'fly' && a.dir < 0 ? 'scaleX(-1)' : undefined,
            }}
          />
          {p.stopped && (
            <span
              className={`${ui.text} ${styles.huh}`}
              style={{ left: p.x, top: p.y - k.h - S.top - 8 }}
            >
              ?
            </span>
          )}
        </span>
      ),
    });
  }
  const bf = bigfootAt(run, now);
  if (bf) {
    const frame = Math.floor(now / 0.12) % 2 === 0 ? 1 : 2;
    if (run.night && !inBeam({ x: bf.x, y: bf.y - BIGFOOT.h * 0.8 }, aim))
      eyes.push({ x: bf.x, y: bf.y - BIGFOOT.h * 0.8 });
    items.push({
      key: 'bigfoot',
      y: bf.y - 2,
      el: (
        <img
          key="bigfoot"
          className={`${ui.sprite} ${q.thing}`}
          src={art(`animal-bigfoot-${frame}.png`)}
          alt=""
          draggable={false}
          style={{
            left: bf.x - BIGFOOT.w / 2,
            top: bf.y - 2 - BIGFOOT.h - S.top,
            width: BIGFOOT.w,
            height: BIGFOOT.h,
            transform: run.bigfoot!.dir < 0 ? 'scaleX(-1)' : undefined,
          }}
        />
      ),
    });
  }
  items.sort((a, b) => a.y - b.y);

  // The cone (from the bottom middle, half the beam's width each side), in hillside units.
  const half = ((S.beamDeg / 2) * Math.PI) / 180;
  const far = 420;
  const cone = [
    [BEAM_FROM.x, BEAM_FROM.y - S.top],
    [BEAM_FROM.x + Math.cos(aim - half) * far, BEAM_FROM.y - S.top + Math.sin(aim - half) * far],
    [BEAM_FROM.x + Math.cos(aim + half) * far, BEAM_FROM.y - S.top + Math.sin(aim + half) * far],
  ]
    .map((pt) => pt.join(','))
    .join(' ');

  // The status line under the signs.
  const name = (id: string) => byId(id).name.toUpperCase();
  const lg = game.lastGuess;
  const said = lg
    ? `${name(lg.by)} GUESSED ${signLabel(game, lg)}: ${lg.right ? 'RIGHT!' : 'WRONG.'}`
    : '';
  const status =
    game.phase === 'done'
      ? lg && !lg.right && Object.values(game.passed).every((v) => !v)
        ? `${said} NOBODY GOT IT.`
        : said
      : who
        ? `${said ? `${said} ` : ''}${lg && lg.right && game.q === 1 ? 'QUESTION 2: ' : ''}${name(who)}, YOUR GUESS.`
        : '';
  const n = cur?.signs.length ?? 0;
  const signW = n ? Math.min(70, (304 - (n - 1) * 4) / n) : 70;

  const word = (id: string) => {
    if (watching) return 'WATCHING';
    if (id in game.passed) return game.passed[id] ? 'PASSED' : 'FAILED';
    return id === who ? 'NOW' : 'WAITING';
  };

  return (
    <PixelScreen ref={sceneRef} measure={!still}>
      <div
        className={q.play}
        onPointerDown={aimAt}
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse' || e.buttons) aimAt(e);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* The hillside: the meadow, bushes and animals, then fog or the dark. */}
        <div className={styles.hill} style={{ top: S.top, height: HILL_H }}>
          <img
            className={`${ui.sprite} ${styles.bg}`}
            src={art('bg.png')}
            alt=""
            draggable={false}
          />
          {items.map((i) => i.el)}
          {run.fog?.map((f, k) => {
            const x = ((((f.x + f.speed * now) % 440) + 440) % 440) - 60;
            return (
              <span
                key={k}
                className={styles.fog}
                style={{
                  left: x - f.w / 2,
                  top: f.y - S.top - f.h / 2,
                  width: f.w,
                  height: f.h,
                  opacity: S.fogHide,
                }}
              />
            );
          })}
          {run.night && (
            <svg className={styles.dark} viewBox={`0 0 320 ${HILL_H}`} aria-hidden="true">
              <defs>
                <mask id={maskId}>
                  <rect width="320" height={HILL_H} fill="#fff" />
                  <polygon points={cone} fill="#000" />
                </mask>
              </defs>
              <rect
                width="320"
                height={HILL_H}
                fill="#0a1008"
                opacity={S.dark}
                mask={`url(#${maskId})`}
              />
            </svg>
          )}
          {eyes.map((e, k) => (
            <span key={k} className={styles.eyes} style={{ left: e.x - 3, top: e.y - S.top }}>
              <span />
              <span />
            </span>
          ))}
          {asking && <span className={styles.dim} />}
        </div>

        {/* The question, the signs, and who guesses. */}
        {asking && cur && (
          <>
            <div className={`${ui.box} ${styles.question}`}>
              <span>{cur.text}</span>
              {game.questions.length > 1 && (
                <span className={styles.qOf}>
                  QUESTION {game.q + 1} OF {game.questions.length}
                </span>
              )}
            </div>
            <div className={styles.signs}>
              {cur.signs.map((sgn, k) => (
                <button
                  key={`${game.q}-${k}`}
                  type="button"
                  className={styles.sign}
                  style={{ width: signW }}
                  disabled={game.crossed.includes(k) || game.phase !== 'question' || still}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => pick(k)}
                >
                  <img className={ui.sprite} src={art('sign.png')} alt="" draggable={false} />
                  <span className={`${ui.text} ${styles.signWords}`}>
                    {sgn.kind && sgn.kind !== 'bigfoot' && (
                      <img
                        className={ui.sprite}
                        src={art(`animal-${sgn.kind}-1.png`)}
                        alt=""
                        draggable={false}
                        style={{
                          height: 11,
                          width: (11 * kindInfo(sgn.kind as Kind).w) / kindInfo(sgn.kind as Kind).h,
                        }}
                      />
                    )}
                    {sgn.label}
                  </span>
                  {game.crossed.includes(k) && (
                    <svg
                      className={styles.cross}
                      viewBox="0 0 70 30"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <path d="M20 6 50 24 M50 6 20 24" stroke="#e5624a" strokeWidth="2.5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            {status && <div className={`${ui.text} ${styles.status}`}>{status}</div>}
          </>
        )}

        {pickOf(settings, 'answer') === 'on' && <AnswerCorner game={game} />}

        <p className={`${ui.muted} ${q.hint}`}>
          {watching
            ? `WATCH CLOSELY. ${game.questions.length > 1 ? 'TWO QUESTIONS' : 'ONE QUESTION'} AT THE END.${run.night ? ' AIM THE FLASHLIGHT.' : ''}`
            : 'TAP A SIGN.'}
        </p>

        {/* The top HUD. */}
        <div className={`${ui.box} ${hud.name}`}>SAFARI</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>{watching ? 'WATCH' : 'GUESS'}</span>
          <span className={hud.bar}>
            <span
              style={{
                width: `${watching ? Math.max(0, 1 - game.time / run.watchSec) * 100 : 100}%`,
              }}
            />
          </span>
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        <TurnBar hikers={hikers} word={word} active={who} />
      </div>
    </PixelScreen>
  );
}

/** The label of the sign a guess picked (the question it was on may have moved on). */
function signLabel(
  game: ReturnType<typeof newSafari>,
  lg: NonNullable<ReturnType<typeof newSafari>['lastGuess']>,
): string {
  // A right guess on question 1 of 2 moves on to question 2: the sign was on question 1.
  const qi = lg.right && game.q === 1 && game.phase !== 'done' ? 0 : game.q;
  return game.questions[qi]?.signs[lg.sign]?.label ?? '';
}

/** Show answer (tuning): the counts and this question's answer, in a corner. */
function AnswerCorner({ game }: { game: ReturnType<typeof newSafari> }) {
  const run = game.run;
  const counts = run.kinds
    .map(
      (k) => `${kindInfo(k).many.toUpperCase()} ${run.animals.filter((a) => a.kind === k).length}`,
    )
    .join(' · ');
  const back = run.animals.filter((a) => a.does === 'turnBack').length;
  const hid = run.animals.filter((a) => a.does === 'hide').length;
  return (
    <div className={`${ui.box} ${styles.answer}`}>
      <span>{counts}</span>
      <span>
        IN ALL {run.animals.length} · BACK {back} · HID {hid}
        {run.bigfoot ? ' · BIGFOOT' : ''}
      </span>
      {game.questions.map((x, k) => (
        <span key={k}>
          Q{k + 1}: {x.answer}
        </span>
      ))}
    </div>
  );
}
