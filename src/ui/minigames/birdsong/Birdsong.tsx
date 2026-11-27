/**
 * Birdsong on the GPS (docs/design/23-minigames-final.md, section 5;
 * mockups 44a-birdsong-listen.png and 44b-birdsong-paper.png), in scene
 * units (320 × 240).
 *
 * - **Listening:** a bird sings on a branch; its notes cross the screen
 *   left to right, colorless until the middle line, where each flashes
 *   into its color and shape (and plays its tone), then fades out.
 * - **Answering:** the view tilts down to the notebook page: one big
 *   square per color, each with its shape. Tap them in order, or press 1
 *   to 8; the answer slots at the top fill as you go. A wrong note gets a
 *   red X under it, and the right color blinks.
 */
import { useEffect, useState } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { birdsongBot } from '../../../minigames/birdsong/bot';
import {
  newBirdsong,
  notesNow,
  pick,
  result,
  singer,
  tick,
} from '../../../minigames/birdsong/logic';
import { slowerShare } from '../../../minigames/popups/common';
import { perHikerCounts, prepNumber } from '../../../minigames/prepare';
import { TIER_LABELS } from '../../../minigames/types';
import { useDemoBot, useDemoMode } from '../demo';
import { Bar } from '../Bar';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { playSound } from '../sound';
import { tintKey, useTintedArt } from '../tintArt';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from '../quick/Quick.module.css';
import { TurnBar } from '../quick/TurnBar';
import { useFixedLoop, useKeys, useReportOnce } from '../quick/useQuick';
import styles from './Birdsong.module.css';

const BS = BALANCE.minigames.birdsong;
const file = (f: string) => `minigames/birdsong/${f}`;
const NOTE_FILES = BS.palette.map((p) => file(`note-${p.shape}.png`));
/** The notes' line while listening, and the colorless tint. */
const NOTE_Y = 120;
const PLAIN = '#e9eecb';

export function Birdsong({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const songsPick = pickOf(settings, 'songs');
  const [game, setGame] = useState(() =>
    newBirdsong(
      {
        tier,
        colors: typeof settings.colors === 'number' ? settings.colors : 'auto',
        songs: songsPick === 'grow' || songsPick === 'new' ? songsPick : 'auto',
        // Prepare (23-minigames-final.md, section 10).
        extraStrikes: perHikerCounts(settings, 'prep.strikes'),
        slower: slowerShare(prepNumber(settings, 'prep.slower')),
        twice: prepNumber(settings, 'prep.notebook') > 0,
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const demo = useDemoMode();
  const running = !still && !game.over;
  useFixedLoop(running, setGame, tick);
  useReportOnce(game, still, onDone, result);
  const ukulele = prepNumber(settings, 'prep.ukulele') > 0;
  const tints = useTintedArt(NOTE_FILES, [...BS.palette.map((p) => p.color), PLAIN]);
  const noteArt = (k: number, color: string) =>
    tints[tintKey(NOTE_FILES[k]!, color)] ?? asset(NOTE_FILES[k]!);
  const byId = (id: string) => hikers.find((h) => h.id === id);
  const who = singer(game);

  const choose = (c: number) => {
    if (!running) return;
    setGame((s) => {
      const out = pick(s, c);
      if (out !== s) playSound(out.wrong.length > s.wrong.length ? 'miss' : 'note');
      return out;
    });
  };
  useKeys(running, (key) => {
    const n = Number(key);
    if (!Number.isInteger(n) || n < 1 || n > game.colors) return false;
    choose(n - 1);
    return true;
  });
  useDemoBot(demo && running, game, birdsongBot, choose);

  // Each note plays its tone as it lights up at the middle line.
  const notes = notesNow(game);
  const lit = notes.filter((n) => n.lit && n.seen).length;
  useEffect(() => {
    if (lit > 0 && !still) playSound('note');
  }, [lit, still]);

  const listening = game.phase === 'listen' || game.phase === 'handoff';
  const answering = game.phase === 'answer' || game.phase === 'after';
  const lastWrong = game.wrong.at(-1);
  const blinkRight =
    lastWrong !== undefined && (game.phase === 'after' || lastWrong === game.answer.length - 1)
      ? game.song[lastWrong]
      : undefined;
  const perRow = game.colors <= 6 ? 3 : 4;
  const sq = game.colors <= 6 ? 34 : 30;
  const word = (id: string) => {
    if (game.out.includes(id)) return 'OUT';
    if (id === who && !game.over) return listening ? 'LISTENING' : 'ANSWERING';
    return game.over ? 'PASSED' : 'STRIKES';
  };

  return (
    <PixelScreen measure={!still}>
      <div className={q.play}>
        {listening ? (
          <>
            {/* The branch and the bird. */}
            <svg className={styles.branch} viewBox="0 0 320 240" aria-hidden="true">
              <path d="M0 72 L320 62" stroke="#3c4e2f" strokeWidth={3} />
              <path d="M220 64 L250 48" stroke="#3c4e2f" strokeWidth={2} />
              <line
                x1={160}
                y1={102}
                x2={160}
                y2={158}
                stroke="#f4f8dc"
                strokeWidth={0.5}
                opacity={0.8}
              />
              <line
                x1={0}
                y1={150}
                x2={320}
                y2={150}
                stroke="#3c4e2f"
                strokeWidth={0.3}
                opacity={0.6}
              />
            </svg>
            <img
              className={`${ui.sprite} ${styles.bird}`}
              src={asset(
                file(game.phase === 'listen' && lit % 2 === 1 ? 'bird-sing.png' : 'bird.png'),
              )}
              alt="A bird singing"
              draggable={false}
            />
            {notes.map((n, k) =>
              n.seen ? (
                <img
                  key={k}
                  className={`${ui.sprite} ${styles.note}`}
                  data-lit={(n.lit && n.x < 172) || undefined}
                  src={noteArt(n.color, n.lit ? BS.palette[n.color]!.color : PLAIN)}
                  alt=""
                  draggable={false}
                  style={{
                    left: n.x - 7,
                    top: NOTE_Y - 9,
                    opacity: n.lit
                      ? Math.max(0, 1 - (n.x - BS.screenW / 2) / (BS.screenW / 2 + BS.noteMargin))
                      : 1,
                  }}
                />
              ) : null,
            )}
            {game.phase === 'handoff' && who && (
              <span className={`${ui.box} ${q.handoff}`}>
                {(byId(who)?.name ?? '').toUpperCase()}, LISTEN!
              </span>
            )}
          </>
        ) : (
          /* The notebook page. */
          <div className={styles.page}>
            <span className={`${ui.text} ${styles.ask}`}>WHAT DID IT SING?</span>
            <span className={styles.slots}>
              {game.song.map((_, k) => {
                const c = game.answer[k];
                return (
                  <span key={k} className={styles.slot}>
                    {c !== undefined && (
                      <img
                        className={ui.sprite}
                        src={noteArt(c, BS.palette[c]!.color)}
                        alt=""
                        draggable={false}
                      />
                    )}
                    {game.wrong.includes(k) && <span className={styles.x}>×</span>}
                  </span>
                );
              })}
            </span>
            <span className={styles.squares} style={{ width: perRow * (sq + 8) }}>
              {Array.from({ length: game.colors }, (_, c) => (
                <button
                  key={c}
                  type="button"
                  className={styles.square}
                  data-blink={blinkRight === c || undefined}
                  style={{ width: sq, height: sq * 0.86, background: BS.palette[c]!.color }}
                  onClick={() => !demo && choose(c)}
                  onPointerEnter={() => ukulele && !demo && playSound('note')}
                  disabled={still || game.phase !== 'answer'}
                  aria-label={`${BS.palette[c]!.name} (${c + 1})`}
                >
                  <img className={ui.sprite} src={noteArt(c, PLAIN)} alt="" draggable={false} />
                </button>
              ))}
            </span>
          </div>
        )}

        <p className={`${ui.muted} ${q.hint}`}>
          {answering
            ? 'TAP THE COLORS IN ORDER. A WRONG ONE IS A STRIKE, BUT YOU FINISH THE SONG.'
            : 'LISTEN: EACH NOTE TAKES ITS COLOR (AND SHAPE) AS IT CROSSES THE MIDDLE.'}
        </p>

        {/* The top HUD. */}
        <div className={`${ui.box} ${hud.name}`}>BIRDSONG</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>
            {answering
              ? `NOTE ${Math.min(game.song.length, game.answer.length + 1)} OF ${game.song.length}`
              : `ROUND ${game.round} · ${game.song.length} NOTES`}
          </span>
          <Bar
            value={
              answering ? game.answer.length / game.song.length : game.song.length / game.longest
            }
          />
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>
        <TurnBar
          hikers={hikers}
          word={word}
          active={game.over ? undefined : who}
          extra={(id) => {
            const max = game.strikeMax[id] ?? BS.strikes;
            const left = max - (game.strikes[id] ?? 0);
            return (
              <span className={styles.pips} aria-label={`${left} strikes left`}>
                {Array.from({ length: max }, (_, k) => (
                  <span key={k} style={k < left ? { background: byId(id)?.color } : undefined} />
                ))}
              </span>
            );
          }}
        />
      </div>
    </PixelScreen>
  );
}
