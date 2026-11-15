/**
 * The trail's drop spots for pack things (Nov 14 update), given by the game
 * screen to the panels that draw them: a hiker's worn-clothes slots and the
 * party's portraits. `packs`: bag items and resources can be dragged now.
 */
import { createContext, useContext } from 'react';
import type { DropTarget } from './drag';

export interface ItemDrops {
  packs: boolean;
  /** A worn-clothes slot (its arg is the slot: body, feet or gear). */
  slot?: DropTarget;
  /** A party portrait (its arg is the hiker's id). */
  portrait?: DropTarget;
}

export const ItemDropsContext = createContext<ItemDrops>({ packs: false });

export const useItemDrops = () => useContext(ItemDropsContext);

/** A target that takes nothing, where a screen has no drops of that kind. */
export const NO_DROP: DropTarget = { accepts: () => false, onDrop: () => {} };
