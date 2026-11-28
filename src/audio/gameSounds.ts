/**
 * The game's sounds from its log (32-audio-system.md, section 6; the "When it
 * plays" column of 33-sound-list.md). Every change to the game goes through
 * `applyAction`, which writes log events; after each one, the events it wrote
 * become sounds here, in one place:
 *
 * - **Resources:** `res.<category>` for each one gained, at most a few per
 *   action, a moment apart; caps, losses, buying and selling.
 * - **Stats:** once per action, not per point: up (Energy, Appetite, Morale)
 *   or down; `stat.low` when a hiker drops into Fatigued, Hungry, low Morale
 *   or low Stuffing, not every time after.
 * - **Conditions, injuries, items, actions, the day, the weather, the night
 *   event** (its group's sting, then the creature a moment later), the
 *   checkpoint, Wonders, skill steps, the summit and the end of a hike.
 *
 * Sounds that belong to a screen (clicks, windows, the scavenge cards, the
 * minigames) are played by that screen instead.
 */
import { BALANCE } from '../config/balance';
import { CONDITIONS, ITEMS } from '../content';
import { categoriesOf } from '../content/resources';
import type { GameEvent, GameState, Hiker, ResourceId } from '../engine';
import { thresholdStates } from '../engine/thresholds';
import { BAR_LEVELS } from '../ui/panels/hikerInfo';

const A = BALANCE.audio;

/** One sound to play: its id and, optionally, when (seconds from now) and how. */
export interface Cue {
  id: string;
  delay?: number;
  volume?: number;
  version?: number;
}

/** Which sting opens each night creature's event (33-sound-list.md, "Night events"). */
export const NIGHT_GROUP: Readonly<Record<string, 'nuisance' | 'danger' | 'eerie'>> = {
  raccoons: 'nuisance',
  opossums: 'nuisance',
  foxes: 'nuisance',
  bats: 'nuisance',
  'drunk-hiker': 'nuisance',
  // Not in the list's groups: a gang of raccoons is still a nuisance.
  'raccoon-gang': 'nuisance',
  wolves: 'danger',
  coyote: 'danger',
  hyenas: 'danger',
  robber: 'danger',
  bears: 'danger',
  leopard: 'danger',
  bobcat: 'danger',
  cultists: 'eerie',
  monster: 'eerie',
};

/** Each night creature's own sound. */
export const NIGHT_SOUND: Readonly<Record<string, string>> = {
  raccoons: 'night.raccoons',
  opossums: 'night.opossums',
  foxes: 'night.foxes',
  bats: 'night.bats',
  'drunk-hiker': 'night.drunkHiker',
  'raccoon-gang': 'night.raccoonGang',
  wolves: 'night.wolves',
  coyote: 'night.coyotes',
  hyenas: 'night.hyenas',
  robber: 'night.robbers',
  bears: 'night.bears',
  leopard: 'night.leopards',
  bobcat: 'night.bobcats',
  cultists: 'night.cultists',
  monster: 'night.monster',
};

const SPACE_SOUND: Readonly<Record<string, string>> = {
  trailSign: 'space.trailSign',
  geoCache: 'space.geoCache',
  campsite: 'space.campsite',
  overlook: 'space.overlook',
  narrowPath: 'space.narrowPath',
  mystery: 'space.mystery',
  choice: 'space.choice',
  opportunity: 'space.opportunity',
};

/** The resource sounds for these resources: one per resource, at most a few, a moment apart. */
export function resourceCues(resources: readonly ResourceId[], start = 0): Cue[] {
  return resources.slice(0, A.resources.max).map((r, i) => ({
    id: `res.${categoriesOf(r)[0] ?? 'building'}`,
    delay: start + (i * A.resources.gapMs) / 1000,
  }));
}

/** True when a hiker is now Fatigued, Hungry, low on Morale or low on Stuffing. */
function lowStates(h: Hiker): Set<string> {
  const out = new Set<string>(
    thresholdStates(h).filter((s) => s === 'hungry' || s === 'fatigued' || s === 'lowStuffing'),
  );
  if (h.stats.morale <= BAR_LEVELS.morale.low) out.add('lowMorale');
  return out;
}

/** Uses left on each tool, by its id. */
function usesLeft(state: GameState): Map<string, number> {
  const out = new Map<string, number>();
  for (const h of state.hikers) {
    for (const it of [...h.inventory.bag, ...Object.values(h.inventory.equipped)]) {
      if (it?.usesLeft !== undefined) out.set(it.uid, it.usesLeft);
    }
  }
  return out;
}

/**
 * The sounds for the events one action wrote. `before` is the game just
 * before them (null on the first look, when nothing plays for stat changes).
 * `walkSec` is how long a moving token takes to arrive: what happens on the
 * tile it lands on waits for it.
 */
export function cuesFor(
  events: readonly GameEvent[],
  before: GameState | null,
  after: GameState,
  walkSec = 0,
): Cue[] {
  const cues: Cue[] = [];
  const once = new Set<string>();
  const add = (id: string, delay = 0, extra: Omit<Cue, 'id' | 'delay'> = {}) =>
    cues.push({ id, ...(delay ? { delay } : {}), ...extra });
  const addOnce = (id: string, delay = 0) => {
    if (once.has(id)) return;
    once.add(id);
    add(id, delay);
  };
  const newDay = events.some((e) => e.kind === 'phase');
  const gained: ResourceId[] = [];
  let capsIn = false;
  let itemIn = false;

  for (const e of events) {
    switch (e.kind) {
      case 'stat': {
        // Morning and night change everyone's stats; the day's own sting covers that.
        if (newDay || e.to === e.from) break;
        if (e.to < e.from) addOnce('stat.down');
        else if (e.stat === 'energy') addOnce('stat.energyUp');
        else if (e.stat === 'appetite') addOnce('stat.appetiteUp');
        else if (e.stat === 'morale') addOnce('stat.moraleUp');
        break;
      }
      case 'condition':
        addOnce(CONDITIONS[e.condition]?.kind === 'positive' ? 'cond.good' : 'cond.bad');
        break;
      case 'conditionEnded':
        if (CONDITIONS[e.condition]?.kind === 'negative') addOnce('cond.cured');
        break;
      case 'injury':
        addOnce('injury');
        break;
      case 'healed':
      case 'woke':
        addOnce('healed');
        break;
      case 'passedOut':
        addOnce('passedOut');
        break;
      case 'learned':
        if (e.level && e.level >= 2)
          add('trait.levelStep', 0, { version: Math.min(2, e.level - 2) });
        else if (!e.start) addOnce('trait.learn');
        break;
      case 'traitGained':
        addOnce('trait.learn');
        break;
      case 'trait':
      case 'freeAction':
      case 'biteKept':
        addOnce('trait.proc');
        break;
      case 'phase':
        addOnce(`day.${e.phase}`);
        break;
      case 'weatherChanged':
        if (e.from !== e.to) addOnce(`weather.${e.to}`);
        break;
      case 'nightEvent': {
        const group = NIGHT_GROUP[e.creatureId];
        if (group) add(`night.${group}`);
        const own = NIGHT_SOUND[e.creatureId];
        if (own) add(own, A.night.creatureDelaySec);
        // Nobody was hit, so no window opens: it ends well at once.
        if (!e.hits.length) add('night.good', A.night.endDelaySec);
        break;
      }
      case 'checkedIn':
        addOnce('map.checkpoint', walkSec);
        break;
      case 'summit':
        addOnce('hike.summit', walkSec);
        break;
      case 'hikeOver':
        addOnce('hike.over');
        break;
      case 'move': {
        if (e.revealed?.length) addOnce('map.reveal', walkSec);
        const space = after.section.tiles[e.to]?.special;
        const sound = space ? SPACE_SOUND[space] : undefined;
        if (sound) addOnce(sound, walkSec);
        break;
      }
      case 'challenge':
        // A failed challenge's punishment.
        if (e.results.some((r) => !r.passed)) addOnce('mg.punish');
        break;
      case 'revealedCard':
        addOnce('map.reveal');
        break;
      case 'challengeOpened':
        addOnce('map.challengeLand', walkSec);
        addOnce('card.challenge', walkSec + A.challengeCardDelaySec);
        break;
      case 'scavenge':
        gained.push(...e.resources);
        if (e.caps) capsIn = true;
        if (e.items?.length) itemIn = true;
        break;
      case 'gained':
        gained.push(...e.resources);
        if (e.caps) capsIn = true;
        if (e.items.length) itemIn = true;
        break;
      case 'lost':
        addOnce('res.lose');
        break;
      case 'crafted':
        addOnce('act.craftDone');
        itemIn = true;
        break;
      case 'blueprintFound':
      case 'blueprints':
        itemIn = true;
        break;
      case 'ate':
        addOnce(ITEMS[e.itemId]?.drink ? 'item.drink' : 'item.eat');
        break;
      case 'used':
        addOnce('item.use');
        break;
      case 'itemGone':
        if (e.why !== 'eaten') addOnce('item.break');
        break;
      case 'dressed':
        addOnce(e.on ? 'item.equip' : 'item.unequip');
        break;
      case 'give':
        addOnce('item.give');
        break;
      case 'returned':
        addOnce('act.returnToNature');
        break;
      case 'tend':
        addOnce('act.tend');
        break;
      case 'sleep':
        addOnce('act.sleep');
        break;
      case 'watch':
        addOnce('act.keepWatch');
        break;
      case 'shelterSetUp':
      case 'shelterPlaced':
        if (e.hikerId) addOnce('act.shelterUp');
        break;
      case 'shelterPackedUp':
        if (!e.auto) addOnce('act.shelterDown');
        break;
      case 'taught':
        addOnce('act.teach');
        break;
      case 'carry':
        if (e.how === 'pickedUp') addOnce('act.carry');
        break;
      case 'abandoned':
        addOnce('act.abandon');
        break;
      case 'wrapped':
        addOnce('present.wrap');
        break;
      case 'presentOpened':
        addOnce('present.open');
        break;
      case 'bought':
        addOnce('station.buy');
        break;
      case 'sold':
        addOnce('station.sell');
        break;
      case 'traded':
        addOnce('station.trade');
        break;
      case 'rejoined':
        addOnce('select.add');
        break;
      case 'wonderAccomplished':
        addOnce('wonder.done');
        break;
      case 'infoboardPin':
        addOnce('map.pin');
        addOnce('res.capsSpend');
        break;
      default:
        break;
    }
  }

  cues.push(...resourceCues(gained));
  if (capsIn) add('res.caps');
  if (itemIn) add('item.new');

  if (before) {
    // A use spent on a tool that's still there: one LED goes dark.
    const was = usesLeft(before);
    for (const [uid, left] of usesLeft(after)) {
      const old = was.get(uid);
      if (old !== undefined && left < old) {
        addOnce('item.ledDown');
        break;
      }
    }
    // Dropping into a low state, not every time after.
    for (const h of after.hikers) {
      const old = before.hikers.find((b) => b.id === h.id);
      if (!old || h.status !== 'active') continue;
      const was = lowStates(old);
      if ([...lowStates(h)].some((s) => !was.has(s))) {
        addOnce('stat.low');
        break;
      }
    }
  }
  return cues;
}
