/**
 * The debug panel's Sound tab (32-audio-system.md, section 7): every sound id
 * with a play button for each version, filtered by search or status; how
 * many sounds are playing; the ambience and music state; and a switch that
 * logs every sound to the console. Sounds that need a recording are listed
 * here too.
 */
import { useState, useSyncExternalStore } from 'react';
import { audio, sfx } from '../../audio/engine';
import type { SoundStatus } from '../../audio/manifest';
import styles from './DebugPanel.module.css';
import own from './DebugSound.module.css';

const STATUS_NAME: Record<SoundStatus | 'all', string> = {
  all: 'All',
  made: 'Made',
  placeholder: 'Placeholders',
  need: 'Need a recording',
  code: 'In code',
};

/** Re-renders when the engine changes (a sound starts or stops, a state line changes). */
function useEngine(): string {
  return useSyncExternalStore(
    (l) => audio.subscribe(l),
    () => {
      const { sounds, loops } = audio.playing;
      return [
        sounds,
        loops.join(','),
        audio.getInfo('ambience'),
        audio.getInfo('music'),
        !!audio.manifest,
        audio.context?.state,
      ].join('|');
    },
  );
}

export function DebugSound() {
  useEngine();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SoundStatus | 'all'>('all');
  const [log, setLog] = useState(audio.logCalls);
  const manifest = audio.manifest;
  const { sounds, loops } = audio.playing;
  const term = search.trim().toLowerCase();
  const ids = manifest
    ? Object.entries(manifest.sounds).filter(
        ([id, e]) => (status === 'all' || e.status === status) && id.toLowerCase().includes(term),
      )
    : [];

  return (
    <>
      <p className={styles.note}>
        {audio.context
          ? `Playing ${sounds} sound${sounds === 1 ? '' : 's'}` +
            (loops.length ? ` and ${loops.length} loop${loops.length === 1 ? '' : 's'}` : '') +
            (audio.context.state === 'running' ? '.' : ` (sound is ${audio.context.state}).`)
          : 'Sound starts after the first click or key.'}
      </p>
      <p className={styles.note}>Ambience: {audio.getInfo('ambience') ?? 'nothing yet'}</p>
      <p className={styles.note}>Music: {audio.getInfo('music') ?? 'nothing yet'}</p>
      <label className={own.switch}>
        <input
          type="checkbox"
          checked={log}
          onChange={(e) => {
            audio.logCalls = e.target.checked;
            setLog(e.target.checked);
          }}
        />
        Log every sound to the console
      </label>
      <div className={styles.row}>
        <input
          className={own.search}
          type="search"
          placeholder="Search sounds"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={own.status}
          value={status}
          onChange={(e) => setStatus(e.target.value as SoundStatus | 'all')}
          aria-label="Status"
        >
          {Object.entries(STATUS_NAME).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {!manifest ? (
        <p className={styles.note}>Loading the sound list…</p>
      ) : (
        <>
          <p className={styles.note}>
            {ids.length} of {Object.keys(manifest.sounds).length} sounds
          </p>
          <ul className={own.list}>
            {ids.map(([id, e]) => (
              <li key={id} className={own.item}>
                <span className={own.id}>{id}</span>
                <span className={own.meta} data-status={e.status}>
                  {e.bus} · {STATUS_NAME[e.status].toLowerCase()}
                  {e.loop ? ' · loop' : ''}
                </span>
                <span className={own.plays}>
                  {e.files.length === 0
                    ? '—'
                    : e.files.map((f, i) => (
                        <button
                          key={f}
                          type="button"
                          className={styles.button}
                          title={f}
                          onClick={() => {
                            if (e.loop) {
                              const l = audio.loop(id, { fadeIn: 0.2 });
                              window.setTimeout(() => l.fadeOut(0.5), 4000);
                            } else sfx(id, { version: i });
                          }}
                        >
                          ▶{e.files.length > 1 ? ` ${i + 1}` : ''}
                        </button>
                      ))}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
