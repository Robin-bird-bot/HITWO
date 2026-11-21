/**
 * #mockup-hiker-cards (dev, or the live site with ?debug): the real hiker
 * card laid out like docs/mockups/HikerCards.png, to compare the two, and
 * every hiker's card at once. Click a card to turn it over; hover a turned
 * card to lift it to the middle.
 */
import { useState } from 'react';
import { CLASS_COLORS, CLASS_NAMES } from '../../content/classes';
import { ROSTER } from '../../content/roster';
import { CLASS_IDS } from '../../engine/types';
import { HikerCard } from '../hikers/HikerCard';
import { FamilyMark } from '../hikers/HikerPortrait';
import { FAMILY_ICONS } from '../hikers/portraitArt';
import { PreviewLayer } from '../preview/PreviewLayer';
import { Stage } from '../stage/Stage';
import styles from './HikerCardsMockup.module.css';

const VIEWS = [
  ['mockup', 'Like the mockup'],
  ['all', 'Every hiker'],
] as const;
type View = (typeof VIEWS)[number][0];

export function HikerCardsMockup() {
  const [view, setView] = useState<View>('mockup');
  return (
    <Stage>
      <PreviewLayer>
        <div className={styles.page}>
          <header className={styles.bar}>
            <h1 className={styles.heading}>HIKER CARDS · FRONT, BACK AND ROLES</h1>
            <span className={styles.gap} />
            <nav className={styles.views} aria-label="Gallery views">
              {VIEWS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={styles.view}
                  aria-pressed={view === id}
                  onClick={() => setView(id)}
                >
                  {label}
                </button>
              ))}
            </nav>
          </header>
          {view === 'mockup' ? <LikeTheMockup /> : <EveryHiker />}
        </div>
      </PreviewLayer>
    </Stage>
  );
}

function LikeTheMockup() {
  return (
    <>
      <section className={styles.panel} style={{ left: 40, top: 100, width: 760, height: 600 }}>
        <span className={styles.label}>CLICK TO FLIP</span>
        <div className={styles.pair}>
          <HikerCard hikerId="finn" scale={1.1} />
          <HikerCard hikerId="finn" scale={1.1} defaultFlipped />
        </div>
        <p className={styles.note}>
          Front on the left, back on the right. Click either one to turn it over; hover a turned
          card to lift it to the middle.
        </p>
      </section>
      <section className={styles.panel} style={{ left: 830, top: 100, width: 730, height: 600 }}>
        <span className={styles.label}>MORE FRONTS</span>
        <div className={styles.more}>
          {['ellie', 'mom', 'bossGracie'].map((id) => (
            <HikerCard key={id} hikerId={id} scale={0.72} />
          ))}
        </div>
        <span className={styles.label} style={{ marginTop: 18 }}>
          FAMILY ICON · TOP LEFT
        </span>
        <div className={styles.families}>
          {FAMILY_ICONS.map((icon) => (
            <span key={icon} className={styles.family}>
              <FamilyMark icon={icon} style={{ width: 30, height: 30 }} />
              {icon.toUpperCase()}
            </span>
          ))}
        </div>
      </section>
      <section className={styles.panel} style={{ left: 40, top: 724, width: 760, height: 256 }}>
        <span className={styles.label}>ROLE COLORS</span>
        <div className={styles.roles}>
          {CLASS_IDS.map((id) => (
            <span key={id} className={styles.role} style={{ background: CLASS_COLORS[id] }}>
              {CLASS_NAMES[id].toUpperCase()}
            </span>
          ))}
        </div>
      </section>
      <section className={styles.panel} style={{ left: 830, top: 724, width: 730, height: 256 }}>
        <span className={styles.label}>OPEN SLOT · LONG NAMES · VARIANTS · NO PORTRAIT YET</span>
        <div className={styles.small}>
          {['brutus', 'grandpaSherman', 'followerFinn', 'ben', 'ellieDevourer'].map((id) => (
            <HikerCard key={id} hikerId={id} scale={0.4} />
          ))}
        </div>
      </section>
    </>
  );
}

function EveryHiker() {
  return (
    <div className={styles.grid}>
      {ROSTER.map((h) => (
        <HikerCard key={h.id} hikerId={h.id} scale={0.46} />
      ))}
    </div>
  );
}
