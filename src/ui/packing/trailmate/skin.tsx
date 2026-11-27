/**
 * TrailMate as a look for the packing screen: its CSS for the shared parts,
 * how it draws chips, slots and resources, and its words.
 */
import type { CSSProperties } from 'react';
import { BALANCE } from '../../../config/balance';
import { asset } from '../../../config/assets';
import { itemPool } from '../../../packing/logic';
import { SelectBackground } from '../../select/background/SelectBackground';
import type { Paint, Skin, SkinText } from '../machine';
import { sizeColor, TYPE_COLOR } from './colors';
import { GreenItem, TrailMateMachine, TrailMateSymbol } from './TrailMate';
import styles from './TrailMate.module.css';

const P = BALANCE.packing;

const greenResource = (id: string) => asset(`resources-green/${id}.png`);

const paint: Paint = {
  typeVars: (t) => ({ '--tc': TYPE_COLOR[t] }) as CSSProperties,
  sizeVars: (n) => ({ '--tc': sizeColor(n) }) as CSSProperties,
  typeChip: (t) => (
    <div className={styles.chip}>
      <GreenItem itemId={itemPool(t, 1)[0] ?? ''} />
    </div>
  ),
  sizeChip: (n) => (
    <div className={styles.chip}>
      <b>×{n}</b>
    </div>
  ),
  slotArt: (itemId) => <GreenItem itemId={itemId} />,
  resourceIcon: (id, name) => <img src={greenResource(id)} alt={name} title={name} />,
};

const text: SkinText = {
  oddsItems: 'WHAT’S ON THE SCREENS',
  oddsNote: (pct) => (
    <>
      Tier I items. Each screen has a rare <b>{pct}</b> chance to land on a <b>Tier II</b>.
    </>
  ),
  payItems: 'PAYTABLE · SIDE BY SIDE',
  payBundles: 'PAYTABLE · ALL 3 SCREENS',
  pay: {
    row3: ['3 IN A ROW', 'BONUS SCAN'],
    row4: ['4 IN A ROW', '1 GOES TIER II + FREE SCAN'],
    jackpot: ['ALL 5 · JACKPOT', 'ALL TIER II · TAKE 1 + FREE SCAN'],
    ones: ['ALL ×1', 'BONUS SCAN'],
    twos: ['ALL ×2', '1 GROWS TO ×3 + BONUS SCAN'],
    threes: ['ALL ×3', '1 GROWS TO ×5 + BONUS SCAN'],
  },
  rulesItems: 'Same type, on screens next to each other. An offline screen breaks a row.',
  rulesBundles: 'Only while all 3 screens are on: take a bundle and the row is broken.',
  help: {
    items: (
      <>
        <b>Press SCAN</b> (or pull the antenna) to spin. <b>Drag an item onto a hiker</b>, or click
        it and then the hiker, to pack it: its screen goes offline. A rescan spins{' '}
        <b>every screen still on</b>, so anything you leave is gone. Each rescan uses a battery
        cell.
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
        <b>Packed!</b> The bundles downloaded into resources. The hike starts on the trailhead.
      </>
    ),
  },
};

export const TRAILMATE: Skin = {
  cx: styles,
  paint,
  text,
  Backdrop: () => <SelectBackground preset="dark" />,
  Machine: TrailMateMachine,
  Symbol: TrailMateSymbol,
};
