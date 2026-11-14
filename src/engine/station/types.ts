/**
 * Ranger station themes as data (docs/design/06-ranger-stations.md). A theme
 * only changes what is for sale: Quality, prices and the market are the same
 * at every station.
 */
import type { ItemType } from '../effects';
import type { ItemId } from '../types';

export type StationThemeId =
  | 'finn'
  | 'chefBear'
  | 'wink'
  | 'businessman'
  | 'roccoBoutique'
  | 'roccoResale'
  | 'drSckhunk'
  | 'bearEI'
  | 'bearnes';

/** Where a station's focus item slots (and its blueprints) come from. */
export type StationFocus =
  /** One item type (Finn's clothes, Ellie's food…). */
  | { type: ItemType }
  /** An explicit list: the featured items (Dr. Sckhunk, BeaR E I, Bearnes). */
  | { items: readonly ItemId[] }
  /** Items the party used up or lost this run (Rocco's "Borrowed" Boutique). */
  | { usedOrLost: true }
  /** Anything (Rocco's Random Resale, and Rocco's blueprints). */
  | { any: true };

export interface StationTheme {
  id: StationThemeId;
  /** The hanging sign. */
  name: string;
  shopkeeper: {
    name: string;
    /** In public/assets/shopkeepers/, 465×800, anchored at the bottom. */
    portrait: string;
    /** A second layer in front of the counter (the Businessman's resting arm). */
    arm?: string;
  };
  focus: StationFocus;
  blueprints: StationFocus;
  /** Featured items: more likely in every item slot (and the only shop for Puked Nuggets). */
  featured: readonly ItemId[];
  /** When an item slot turns into a trinket: these are more likely (Bearnes: XP trinkets). */
  favoredTrinkets?: readonly ItemId[];
  /** Every item and blueprint is face-down until bought (Rocco's Random Resale). */
  mystery?: true;
  /** Resource bundles: more than the usual, some of them resource packs (Random Resale). */
  bundles?: { count: number; packs: true };
  /** Placeholder lines in the shopkeeper's voice. The first greeting is the doc's quote. */
  lines: {
    greet: readonly string[];
    selling: string;
    ahead: string;
    bye: string;
  };
  placeholder?: true;
}
