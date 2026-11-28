/**
 * Lucky Trail Outfitters as a look for the packing screen: its CSS for the
 * shared parts, how it draws chips, slots and resources, and its words.
 */
import type { CSSProperties } from 'react';
import { ASSETS } from '../../../config/assets';
import { BALANCE } from '../../../config/balance';
import { ITEMS } from '../../../content/items';
import { itemPool } from '../../../packing/logic';
import type { Paint, Skin, SkinText } from '../machine';
import { CabinetMachine, CabinetSymbol, ItemArt } from './Cabinet';
import { CAB_TYPE } from './colors';
import styles from './Cabinet.module.css';

const P = BALANCE.packing;

const itemArt = (itemId: string) => {
  const art = ITEMS[itemId]?.art;
  return art ? ASSETS.itemArt(art) : undefined;
};

const paint: Paint = {
  typeVars: (t) => ({ '--c1': CAB_TYPE[t][0], '--c2': CAB_TYPE[t][1] }) as CSSProperties,
  sizeVars: (n) =>
    ({ '--sz': n >= 5 ? 'linear-gradient(#fff2b0, #e8c55a)' : '#e4c9a0' }) as CSSProperties,
  typeChip: (t) => (
    <div className={styles.chip}>
      <img src={itemArt(itemPool(t, 1)[0] ?? '')} alt="" />
    </div>
  ),
  sizeChip: (n) => (
    <div
      className={styles.chip}
      style={{ background: n >= 5 ? 'linear-gradient(#fff2b0, #e8c55a)' : '#e4c9a0' }}
    >
      ×{n}
    </div>
  ),
  slotArt: (itemId) => <ItemArt itemId={itemId} />,
  resourceIcon: (id, name) => <img src={ASSETS.resources[id]} alt={name} title={name} />,
};

const text: SkinText = {
  oddsItems: 'WHAT’S ON THE REELS',
  oddsNote: (pct) => (
    <>
      Tier I items. Each reel has a rare <b>{pct}</b> chance to land on a <b>Tier II</b>.
    </>
  ),
  payItems: 'PAYTABLE · SIDE BY SIDE',
  payBundles: 'PAYTABLE · ALL 3 REELS',
  pay: {
    row3: ['3 IN A ROW', 'BONUS SPIN'],
    row4: ['4 IN A ROW', '1 TURNS TIER II + FREE SPIN'],
    jackpot: ['ALL 5 · JACKPOT', 'ALL TIER II · TAKE 1 + FREE SPIN'],
    ones: ['ALL ×1', 'BONUS SPIN'],
    twos: ['ALL ×2', '1 GROWS TO ×3 + BONUS SPIN'],
    threes: ['ALL ×3', '1 GROWS TO ×5 + BONUS SPIN'],
  },
  rulesItems: 'Same type, on reels next to each other. A dark reel breaks a row.',
  rulesBundles: 'Only while all 3 reels are lit: take a bundle and the row is broken.',
  help: {
    items: (
      <>
        <b>Pull the hiking pole</b> to spin. <b>Drag an item onto a hiker</b>, or click it and then
        the hiker, to pack it: its reel goes dark. A respin spins <b>every lit reel</b>, so anything
        you leave is gone. Each respin feeds the squirrel an acorn.
      </>
    ),
    resources: (
      <>
        <b>Each hiker takes {P.bundlesEach} bundles.</b> A bundle holds 1 to 3 random resources
        (rarely 5). Hover one to see what’s inside. Bundles open into resources when the hike
        starts.
      </>
    ),
    done: (
      <>
        <b>Packed!</b> The bundles opened into resources. The hike starts on the trailhead.
      </>
    ),
  },
};

export const CABINET: Skin = {
  cx: styles,
  paint,
  text,
  Backdrop: () => <div className={styles.backdrop} />,
  Machine: CabinetMachine,
  Symbol: CabinetSymbol,
};
