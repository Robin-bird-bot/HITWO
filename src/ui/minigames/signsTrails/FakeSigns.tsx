/**
 * Fake Trail Signs on the GPS (docs/design/19-minigames-signs-trails.md,
 * section 1; mockups 12-fake-signs-rules.png to 15b-fake-signs-mixed-ends.png),
 * in scene units (320 × 240): the rules screen (THE RULES, the newest marked
 * "+" on a lighter band; at Tiers IV and V only the newest), then each sign
 * on a post in the middle of the trail with REAL and FAKE under it.
 *
 * Keys: Space or Enter for I UNDERSTAND; Left or R for REAL, Right or F for FAKE.
 */
import { useState } from 'react';
import { asset } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import {
  answer,
  newFakeSigns,
  result,
  shownRules,
  tick,
  understand,
} from '../../../minigames/fakeSigns/logic';
import { signText } from '../../../minigames/fakeSigns/rules';
import { g, RED } from '../../../minigames/greens';
import { TIER_LABELS } from '../../../minigames/types';
import { PixelScreen } from '../PixelScreen';
import { pickOf, tierOf, type PuzzleRunProps } from '../puzzleProps';
import { playSound } from '../sound';
import ui from '../gpsUi.module.css';
import hud from '../hud.module.css';
import q from '../quick/Quick.module.css';
import { TurnBar } from '../quick/TurnBar';
import { useFixedLoop, useKeys, useReportOnce } from '../quick/useQuick';
import styles from './FakeSigns.module.css';

const F = BALANCE.minigames.fakeSigns;
const art = (f: string) => asset(`minigames/fake-signs/${f}`);

export function FakeSigns({ settings, hikers, seed, onDone, still = false }: PuzzleRunProps) {
  const tier = tierOf(settings);
  const showOld = pickOf(settings, 'showOld');
  const [game, setGame] = useState(() =>
    newFakeSigns(
      {
        tier,
        signs: typeof settings.signs === 'number' ? settings.signs : 'auto',
        cap: typeof settings.cap === 'number' ? settings.cap : 'auto',
        showOld: showOld === 'always' || showOld === 'never' ? showOld : 'auto',
        timePerSign: typeof settings.time === 'number' ? settings.time : null,
      },
      hikers.map((h) => h.id),
      seed,
    ),
  );
  const byId = (id: string) => hikers.find((h) => h.id === id)!;
  const running = !still && !game.over;
  useFixedLoop(running, setGame, tick);
  useReportOnce(game, still, onDone, result);

  const say = (said: 'real' | 'fake') => {
    const out = answer(game, said);
    if (out === game) return;
    playSound(out.phase === 'wrong' ? 'miss' : 'pop');
    setGame(out);
  };
  const ok = () => setGame(understand);
  useKeys(running, (key) => {
    if (game.phase === 'rules' && (key === ' ' || key === 'Enter')) ok();
    else if (game.phase === 'signs' && (key === 'ArrowLeft' || key === 'r')) say('real');
    else if (game.phase === 'signs' && (key === 'ArrowRight' || key === 'f')) say('fake');
    else return false;
    return true;
  });

  const who = game.current;
  const shown = shownRules(game);
  const wrong = game.phase === 'wrong' ? game.wrong : undefined;
  const p = wrong ? wrong.sign : game.signs[game.index];
  const ticked = game.lastRight && game.time - game.lastRight.at < F.rightSec;
  const answers = pickOf(settings, 'answers') === 'on';
  const word = (id: string) =>
    game.status[id] === 'passed'
      ? 'PASSED'
      : game.status[id] === 'failed'
        ? 'FAILED'
        : id === who && !game.over
          ? 'NOW'
          : 'WAITING';

  return (
    <PixelScreen measure={!still}>
      <div className={q.play} onContextMenu={(e) => e.preventDefault()}>
        <img
          className={`${ui.sprite} ${q.bg}`}
          src={asset('minigames/trail-blocks/bg-trail.png')}
          alt=""
          draggable={false}
        />

        {/* A sign on its post, with REAL and FAKE under it. */}
        {(game.phase === 'signs' || game.phase === 'wrong') && p && (
          <>
            <span
              className={styles.post}
              style={{ backgroundImage: `url(${art('sign-post.png')})` }}
            />
            <span
              className={styles.sign}
              data-wrong={wrong ? '' : undefined}
              style={{ borderColor: RED }}
            >
              <img
                className={ui.sprite}
                src={art(`sign-end-${p.sign.left}.png`)}
                alt=""
                draggable={false}
              />
              <span
                className={`${ui.text} ${styles.board}`}
                style={{ background: g(1), color: g(9) }}
              >
                {signText(p.sign)}
              </span>
              <img
                className={`${ui.sprite} ${styles.right}`}
                src={art(`sign-end-${p.sign.right}.png`)}
                alt=""
                draggable={false}
              />
            </span>
            {ticked && !wrong && (
              <span className={q.word} style={{ left: 160, top: 60 }}>
                ✓
              </span>
            )}
            <p className={`${ui.text} ${styles.ask}`}>IS THIS SIGN REAL OR FAKE?</p>
            {(['real', 'fake'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`${ui.button} ${styles.choice}`}
                style={{
                  left: k === 'real' ? 62 : 168,
                  ...(wrong?.said === k ? { borderColor: RED, boxShadow: `0 0 0 1px ${RED}` } : {}),
                }}
                disabled={game.phase !== 'signs' || still}
                onClick={() => say(k)}
              >
                {k.toUpperCase()}
              </button>
            ))}
            {wrong && <div className={`${ui.box} ${styles.why}`}>{wrong.text}</div>}
            {answers && !wrong && (
              <span className={`${ui.box} ${styles.answer}`}>
                {p.fake ? `FAKE (RULE ${(p.breaks ?? 0) + 1})` : 'REAL'}
              </span>
            )}
          </>
        )}

        {/* The rules screen. */}
        {game.phase === 'rules' && (
          <>
            <span className={styles.dim} />
            <div className={`${ui.box} ${styles.rules}`}>
              <span className={styles.rulesTitle}>THE RULES</span>
              {shown.hidden > 0 && (
                <span className={styles.hidden}>
                  + {shown.hidden} EARLIER RULE{shown.hidden === 1 ? '' : 'S'} STILL APPL
                  {shown.hidden === 1 ? 'IES' : 'Y'} (NOT SHOWN)
                </span>
              )}
              {shown.rules.map((r) => (
                <span key={r.n} className={styles.rule} data-newest={r.newest || undefined}>
                  <span className={styles.ruleN}>
                    {r.newest ? '+ ' : ''}
                    {r.n}.
                  </span>
                  <span>{r.text}</span>
                </span>
              ))}
            </div>
            <button
              type="button"
              className={`${ui.button} ${styles.understand}`}
              disabled={still}
              onClick={ok}
            >
              I UNDERSTAND
            </button>
            {who && (
              <p className={`${ui.text} ${styles.whoNext}`}>
                {byId(who).name.toUpperCase()}, YOU’RE UP.
              </p>
            )}
          </>
        )}

        <p className={`${ui.muted} ${q.hint}`}>
          {game.phase === 'rules'
            ? 'LEARN THE RULES. EVERY SIGN MUST FOLLOW ALL OF THEM.'
            : 'REAL: LEFT OR R. FAKE: RIGHT OR F.'}
        </p>

        {/* The top HUD. */}
        <div className={`${ui.box} ${hud.name}`}>FAKE TRAIL SIGNS</div>
        <div className={`${ui.box} ${hud.meter}`}>
          <span>
            {game.phase === 'rules'
              ? `RULE ${game.rules.length}`
              : `SIGN ${Math.min(game.signs.length, game.index + 1)}/${game.signs.length}`}
          </span>
          <span className={hud.bar}>
            <span
              style={{
                width: `${
                  game.phase === 'rules'
                    ? (game.rules.length / game.cap) * 100
                    : game.timePerSign
                      ? Math.max(0, 1 - game.signTime / game.timePerSign) * 100
                      : ((game.index + 1) / Math.max(1, game.signs.length)) * 100
                }%`,
              }}
            />
          </span>
        </div>
        <div className={`${ui.box} ${hud.tier}`}>TIER {TIER_LABELS[tier]}</div>

        <TurnBar hikers={hikers} word={word} active={game.over ? undefined : (who ?? undefined)} />
      </div>
    </PixelScreen>
  );
}
