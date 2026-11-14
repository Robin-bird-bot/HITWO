/**
 * The ranger station, as a stand-in until its screen is built (Phase 9 step
 * 3): the theme's sign, the shopkeeper and their greeting, what's on the
 * counter as plain lists, this visit's market, who made it, and Rest & Go.
 * Buying and selling arrive with the real screen; the debug panel can reroll
 * the stock.
 */
import { useEffect, useRef } from 'react';
import { ASSETS } from '../../config/assets';
import { BALANCE } from '../../config/balance';
import { characterFor } from '../../content/characters';
import { ITEMS } from '../../content';
import { STATION_THEME_BY_ID } from '../../content/stations';
import { qualityOf, type Action, type GameState, type Hiker } from '../../engine';
import { resourceName } from '../scavenge/cardLook';
import styles from './StationPlaceholder.module.css';

const NUMERAL = ['', 'I', 'II', 'III', 'IV'];
const SPECIAL = { cementMixer: 'Cement Mixer', scoutReport: 'Scout Report' } as const;

export function StationPlaceholder({
  state,
  onDispatch,
  onTitle,
}: {
  state: GameState;
  onDispatch(action: Action): void;
  onTitle(): void;
}) {
  const go = useRef<HTMLButtonElement>(null);
  useEffect(() => go.current?.focus(), []);
  const station = state.station;
  if (!station) return null;
  const theme = STATION_THEME_BY_ID[station.themeId];
  const here = (state.arrivals ?? []).filter((a) => a.section === state.sectionIndex);
  const how = (h: Hiker) => {
    if (h.status === 'abandoned') return 'Left the hike';
    const arrival = here.find((a) => a.hikerId === h.id);
    if (arrival?.carried) return 'Carried in';
    return 'Checked in';
  };
  const nextBiome = BALANCE.run.biomes[state.sectionIndex + 1];

  return (
    <div className={styles.screen} role="dialog" aria-modal="true" aria-label={theme.name}>
      <div className={styles.blur} aria-hidden="true" />
      <div className={styles.content}>
        <span className={styles.kicker}>
          RANGER STATION · CHECKPOINT {station.checkpoint} · DAY {state.day}
        </span>
        <h2 className={styles.title}>{theme.name.toUpperCase()}</h2>
        <div className={styles.shop}>
          <div className={styles.keeper}>
            <img src={ASSETS.shopkeeper(theme.shopkeeper.portrait)} alt="" draggable={false} />
            {theme.shopkeeper.arm && (
              <img
                className={styles.arm}
                src={ASSETS.shopkeeper(theme.shopkeeper.arm)}
                alt=""
                draggable={false}
              />
            )}
          </div>
          <div className={styles.counter}>
            <p className={styles.line}>
              <span className={styles.who}>{theme.shopkeeper.name.toUpperCase()}</span>“
              {theme.lines.greet[0]}”
            </p>
            <div className={styles.lists}>
              <List title={`ITEMS · ${station.items.length}`}>
                {station.items.map((o) => (
                  <li key={o.id}>
                    {o.hidden
                      ? `Mystery item · Tier ${NUMERAL[ITEMS[o.item.itemId]?.tier ?? 1]}`
                      : `${ITEMS[o.item.itemId]?.name} · Tier ${NUMERAL[ITEMS[o.item.itemId]?.tier ?? 1]}${qualityOf(o.item) ? ` · Q${qualityOf(o.item)}` : ''}`}
                    <Price n={o.price} />
                  </li>
                ))}
              </List>
              <List title="BLUEPRINTS">
                {station.blueprints.map((o) => (
                  <li key={o.id}>
                    {o.hidden ? 'Mystery blueprint' : ITEMS[o.itemId]?.name}
                    <Price n={o.price} />
                  </li>
                ))}
              </List>
              <List title="BUNDLES AND SPECIALS">
                {station.bundles.map((o) => (
                  <li key={o.id}>
                    {o.item
                      ? (ITEMS[o.item.itemId]?.name ?? 'Pack')
                      : `${o.count} ${resourceName(o.resource ?? 'wood')}`}
                    <Price n={o.price} />
                  </li>
                ))}
                {station.special && (
                  <li>
                    {SPECIAL[station.special.special]}
                    <Price n={station.special.price} />
                  </li>
                )}
                <li>
                  Taxi Service (rejoin)
                  <Price n={BALANCE.station.rejoin.price} />
                </li>
              </List>
              <List title="WORKBENCH · FREE THIS VISIT">
                {station.tempBlueprints.map((id) => (
                  <li key={id}>{ITEMS[id]?.name}</li>
                ))}
              </List>
            </div>
            <p className={styles.market}>
              <b>×2:</b> {station.market.high.map(resourceName).join(', ')} · <b>×½:</b>{' '}
              {station.market.low.map(resourceName).join(', ')} · <b>Party caps:</b> {state.caps}
            </p>
            <p className={styles.soon}>
              Buying, selling and the Workbench arrive with the station screen.
            </p>
          </div>
        </div>
        <ul className={styles.party}>
          {state.hikers.map((h) => (
            <li key={h.id} className={styles.hiker}>
              <img
                src={ASSETS.portraits.placeholder}
                alt=""
                draggable={false}
                style={{ boxShadow: `0 0 0 3px ${characterFor(h.id).color}` }}
              />
              <span className={styles.name}>{h.name.toUpperCase()}</span>
              <span className={styles.ended}>{how(h)}</span>
            </li>
          ))}
        </ul>
        <div className={styles.buttons}>
          <button
            ref={go}
            type="button"
            className={styles.primary}
            onClick={() => onDispatch({ type: 'restAndGo' })}
          >
            REST & GO
            <small>Free night, then {BIOME_NAME[nextBiome ?? 'alpine']}</small>
          </button>
          <button type="button" className={styles.secondary} onClick={onTitle}>
            TITLE SCREEN
          </button>
        </div>
      </div>
    </div>
  );
}

const BIOME_NAME = {
  meadow: 'the Meadow',
  temperateRainforest: 'the Rainforest',
  alpine: 'the Alpine',
} as const;

function List({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.list}>
      <span className={styles.listTitle}>{title}</span>
      <ul>{children}</ul>
    </div>
  );
}

const Price = ({ n }: { n: number }) => <span className={styles.price}>{n} caps</span>;
