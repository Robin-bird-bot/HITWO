/**
 * The shape of challenge, opportunity and Trial content
 * (docs/design/04-challenges.md, "How to read a challenge"). Content in
 * src/content/challenges.ts fills these in; the engine reads them. Nothing
 * here names a particular challenge.
 */
import type { ItemType } from '../effects';
import type { LineKind, NodeType, ResourceId, StatName } from '../types';

export type ChallengeKind = 'challenge' | 'opportunity' | 'trial';
export type Tier = 1 | 2 | 3;

/** A number on a card that's rolled: X once per challenge, Y once per hiker. */
export interface RollDef {
  roll: 'x' | 'y';
  /** The Tier I range, from the [brackets] in the doc. */
  range: readonly [number, number];
  /** A higher number is better for the party (Dangerous Current). */
  reverse?: true;
}

/** Things a cost or penalty can scale with on this tile. */
export type Per = 'hikerOnTile' | 'twoHikersOnTile' | 'dogOnTile' | 'foodCarried' | 'injury';

/**
 * A number on a card: a fixed number, a named roll ("X" or "Y" by name), or
 * one of those times something on the tile (2 Energy for every Dog).
 */
export type Amount = number | string | { base: number | string; per: Per; plus?: true };

/** Which resources fit a slot. With several, it's "(any mix)". */
export interface ResourceFilter {
  nodes?: readonly NodeType[];
  ids?: readonly ResourceId[];
  /** X resources picked at random from all 16 when revealed (Fox with a Specific Taste). */
  randomOf?: string;
}

export type Requirement =
  | {
      kind: 'resources';
      count: Amount;
      filter?: ResourceFilter;
      /** All the same resource (Spooky Ghost!). */
      same?: true;
      /** One from each hiker on the tile (Ninja Turtle's "1 Shell from each hiker"). */
      fromEach?: true;
    }
  /** Item cards; with several types, any mix ("1 tool or 1 food card"). */
  | { kind: 'items'; count: Amount; itemTypes?: readonly ItemType[] }
  | { kind: 'caps'; count: Amount }
  /** Stat points. With several stats, any mix. */
  | { kind: 'stat'; stats: readonly StatName[]; count: Amount }
  /** Clothing durability. TODO(phase 8): durability arrives with items, so this can't be met yet. */
  | { kind: 'durability'; count: Amount; slot?: 'gear'; oneItem?: true }
  /** A use from a tool. TODO(phase 8). */
  | { kind: 'toolUse'; count: Amount }
  /** Carry no more than this many resources; extras can be spent to pass (Rocky Path). */
  | { kind: 'carryLimit'; max: number };

/** One way to pay: every requirement in it. A card's options are the "or" alternatives. */
export type CostOption = readonly Requirement[];

/**
 * Opportunities where each hiker spends any amount (Nov 6 update, 2): the Risk
 * +/− chips, with a live readout.
 */
export interface SpendAnyDef {
  what: { stat: StatName } | { resources: 'any' } | { items: ItemType };
  /** At most this many per section. */
  max?: number;
  readout: 'statAfter' | 'tries' | 'swaps' | 'luck';
  /** After spending: effects for a hiker whose stat ended at or below a value (Citro Tub). */
  thresholds?: readonly { atMost: number; effects: readonly Effect[] }[];
  /** For every N spent, a chance at these effects (Abandoned Ranger Station). */
  every?: { n: number; chance: Chance; effects: readonly Effect[] };
  /** For each one spent, for whoever spent it (Hikers Exchange, Hungry Animals). */
  each?: readonly Effect[];
}

/** A slot machine outcome (Snake Slots). */
export interface SlotsOutcome {
  weight: number;
  label: string;
  effects: readonly Effect[];
}

/** A button on an opportunity: each press happens at once (Nov 6 update, 2). */
export type ButtonDef = {
  id: string;
  label: string;
  /** One counter for the party, or one per hiker. */
  per: 'party' | 'hiker';
  max?: number;
} & (
  | { kind: 'buy'; price: readonly [number, number]; gives: readonly Effect[] }
  | {
      kind: 'slots';
      pay: readonly { stat: StatName; amount: number }[];
      table: readonly SlotsOutcome[];
    }
  /** One random unrevealed tile gets easier, another harder (Predator Bait). */
  | { kind: 'shiftTiers' }
  /** The presser gets these, and a random unrevealed tile gets harder, once each (Predator's Den). */
  | { kind: 'raiseRandom'; gives: readonly Effect[] }
  /** Reveal a connected tile's card, with a chance of injury (Old Firewatch Tower). */
  | { kind: 'revealConnected'; injury: Chance }
);

/** Which hikers an each-hiker card judges. */
export type Who = 'all' | 'noClothing' | 'wearingClothes' | 'carryingFood';

export type Gate = 'snow' | 'stormy' | 'sunny' | 'afternoon' | 'dogOnTile';

/** A chance, as a fraction (0.5) or a named roll that's a percent ("chance"). */
export type Chance = number | string;

export type EffectOp =
  | {
      op: 'condition';
      id: string;
      duration: Amount;
      unit: 'phases' | 'days' | 'nights';
      /** Allergies: which node (this tile's, or a random one on it). */
      node?: 'tile' | NodeType;
      /** A condition that starts when this one ends ("Hangry for 1 phase, then Nauseous"). */
      then?: { id: string; duration: Amount; unit: 'phases' | 'days' | 'nights' };
      /** Only for hikers who already have one of these (Thin Ice: Soaked or Wet → also Frozen). */
      ifHas?: readonly string[];
    }
  | { op: 'injury' }
  /** A stat change; `lose` makes the amount a loss. */
  | { op: 'stat'; stat: StatName; delta: Amount; lose?: true }
  | { op: 'xp'; delta: Amount; lose?: true }
  /** N random resources, from the hiker or across the party. */
  | { op: 'loseResources'; count: Amount; from: 'hiker' | 'party' }
  /** Each single resource (not stack) has this chance to go. */
  | { op: 'loseEachResource'; chance: Chance; filter?: ResourceFilter }
  /** Lose every one of a set, picking one set at random (all Wood, or all Fish). */
  | { op: 'loseAllOf'; sets: readonly (readonly ResourceId[])[] }
  | { op: 'loseItem'; mode: 'randomUnequipped' }
  /** Each item in the bags (not equipped) has this chance to go. */
  | { op: 'loseBagItems'; chance: Chance }
  /** Food cards: all of them, a number of them, or each with a chance. */
  | { op: 'loseFood'; mode: 'all' | 'count' | 'each'; count?: Amount; chance?: Chance }
  | { op: 'abundance'; nodes: readonly NodeType[]; delta?: Amount; repeatChance?: number }
  | { op: 'nodesVanish'; chance: number; where: 'tile' | 'trail'; node?: NodeType }
  | { op: 'nodesBecome'; node: NodeType; chance: number; where: 'connected' }
  | { op: 'hideNodes'; where: 'around' }
  | { op: 'lines'; kind: LineKind; where: 'into' | 'connected' }
  | {
      op: 'move';
      /**
       * tunnel: together to a random tile in the next row up (Secret Tunnel).
       * trailhead: back to the start of this biome (Airlift).
       * chased: to a random connected tile in the row behind (a night event).
       */
      how:
        'back' | 'cameFrom' | 'swept' | 'blown' | 'falseTrail' | 'tunnel' | 'trailhead' | 'chased';
      /** Blown: the chance of each further step (1, 0.75, 0.5, 0.25). */
      chances?: readonly number[];
    }
  | { op: 'raiseTier'; where: 'unrevealedConnected' }
  /** Start another challenge on this tile (Bear Country's failure). */
  | { op: 'trigger'; tier: Tier; node: NodeType }
  /**
   * Food cards give less Appetite: all of them, or one at random.
   * TODO(phase 8): recorded on the items, used when eating arrives.
   */
  | { op: 'foodAppetite'; delta: Amount; which?: 'all' | 'one' }
  /** Each food card can spoil. TODO(phase 8). */
  | { op: 'spoilFood'; chance: number }
  /** Tools lose uses. TODO(phase 8). */
  | { op: 'toolUses'; delta: Amount }
  /** Clothing can be lost, by durability left. TODO(phase 8). */
  | { op: 'loseClothes'; chancePerDurability: number }
  /** A random negative condition (Rocco Raccoon), or a random one from a list (Mysterious Pill). */
  | { op: 'randomCondition'; duration: Amount; unit: 'days'; from?: readonly string[] }
  /** A random item (of these types), a particular item, or a Tier III placeholder. */
  | {
      op: 'gainItem';
      itemType?: ItemType;
      itemTypes?: readonly ItemType[];
      itemId?: string;
      tier3?: true;
    }
  | { op: 'cureInjury'; count: number }
  /** Cures conditions: all of them, or only negative ones. */
  | { op: 'cureConditions'; only?: 'negative' }
  /** Fills a stat back up to its maximum. */
  | { op: 'refill'; stat: StatName }
  /** Builds a random shelter on this tile (Ruins). */
  | { op: 'placeShelter' }
  /** Scavenging on this tile gets extra Luck until the next morning (Hungry Animals). */
  | { op: 'tileLuck'; amount: Amount }
  | { op: 'gainResources'; count: Amount; filter?: ResourceFilter }
  | { op: 'gainCaps'; count: Amount }
  /** Swaps N of the hiker's resources for random ones. */
  | { op: 'swapResources'; count: Amount }
  /** Takes caps from the party purse, as many as it has. */
  | { op: 'loseCaps'; count: Amount }
  /**
   * Equipped clothes lose durability: one item at random, or all of them.
   * TODO(phase 8): recorded as wear on the item until durability arrives.
   */
  | { op: 'wearClothes'; which: 'one' | 'all'; amount: Amount }
  /** Swaps a random bag item with a random one from a hiker on another tile. */
  | { op: 'swapItemFar' }
  /** Takes N random bag items from the hiker. */
  | { op: 'stealItems'; count: Amount };

export type Effect = EffectOp & {
  /** The chance this effect happens, rolled for each hiker it applies to. */
  chance?: Chance;
  /** Only if this "(25%)" part was included when the challenge was revealed. */
  onlyIf?: string;
  /** Hiker effects on a party card hit every hiker on the tile; this limits it. */
  target?: 'every' | 'injured';
};

/** One piece of a card's text. [Brackets] never show; {names} become rolled numbers. */
export type TextPart = string | { include: string; text: string };

/** A Risk challenge's danger, worked out live as each hiker spends. */
export interface RiskDef {
  /** What a hiker may spend to lower the danger. */
  spend: readonly (
    | { resources: ResourceFilter | 'any' }
    | { items: ItemType | 'any' }
    /** TODO(phase 8): clothing durability. */
    | { durability: true }
  )[];
  measure:
    | {
        kind: 'chance';
        readout: string;
        base?: Chance;
        /** Points added for each thing still carried. */
        perCarried?: readonly { what: ResourceFilter | 'anyResource' | ItemType; points: Chance }[];
        /** Points taken off for each thing spent. */
        perSpent?: readonly { what: ResourceFilter | 'anyResource' | 'anyItem'; points: Chance }[];
      }
    | { kind: 'threshold'; readout: string; carriedAtLeast: Amount }
    | {
        kind: 'loss';
        readout: string;
        stat?: StatName;
        base: Amount;
        perSpent: readonly { what: 'anyResource' | 'anyItem'; amount: number }[];
      }
    | {
        kind: 'chain';
        readout: string;
        chances: readonly number[];
        perSpent: readonly { what: ResourceFilter; points: number }[];
      };
  /** What happens to a hiker the danger hits (or, for a loss, how it's applied). */
  outcome: readonly Effect[];
}

/** What a Trial asks for. Checked at the end of every phase. */
export type TrialGoal =
  | { kind: 'leaveTile'; who: 'all' | 'dogs' }
  | { kind: 'leaveRow' }
  | { kind: 'together' }
  | { kind: 'apart' }
  | { kind: 'offNode'; node: NodeType }
  | { kind: 'endOnNode'; node: NodeType }
  | { kind: 'reachShelterOrNode'; node: NodeType }
  | { kind: 'underShelter' }
  | { kind: 'skipAction' }
  | { kind: 'rowForward' }
  | { kind: 'abundance'; node: NodeType; atLeast: Amount }
  | { kind: 'energyTogether'; atLeast: number }
  | { kind: 'noSleepNear' }
  | { kind: 'roccoReach' }
  | { kind: 'roccoScavenge' }
  | { kind: 'rangerRequest'; pay: Amount }
  /** A goal whose system isn't built yet; the Trial is never picked. */
  | { kind: 'off'; waitingOn: string };

/** When a Trial's time runs out. */
export type Deadline =
  { phases: Amount } | { days: Amount } | { until: 'endOfNextPhase' | 'nextMorning' | 'night' };

interface BaseDef {
  id: string;
  name: string;
  kind: ChallengeKind;
  tier: Tier;
  /** Node types it can appear on, or 'any'. */
  nodes: readonly NodeType[] | 'any';
  gates?: readonly Gate[];
  /** Has art in public/assets/challenges/<id>.jpg. */
  art: boolean;
  /** The flavor line under the title. Wyatt is writing these. */
  description: string;
  /** The description is a stand-in until Wyatt writes it. */
  descriptionPlaceholder?: true;
  quote?: string;
  rolls?: Readonly<Record<string, RollDef>>;
  /** "(25%)" parts and their chance of being included, rolled at reveal. */
  includes?: Readonly<Record<string, number>>;
  placeholder?: true;
}

export interface ChallengeDef extends BaseDef {
  kind: 'challenge' | 'opportunity';
  /**
   * party: one section; each: one per hiker; select: a ✓/✗ per hiker and only
   * ticked hikers take part; one: exactly one hiker takes part.
   */
  scope: 'party' | 'each' | 'select' | 'one';
  /** A Select card that can pick hikers on any tile (Airlift). */
  anyTile?: true;
  /** The card moves the hikers it picks, so a Frozen hiker can't be picked. */
  moves?: true;
  spendAny?: SpendAnyDef;
  buttons?: readonly ButtonDef[];
  who?: Who;
  /** The "or" alternatives. Empty for a Risk challenge. */
  cost: readonly CostOption[];
  costText: readonly TextPart[];
  penalty: readonly Effect[];
  penaltyText: readonly TextPart[];
  /** Effects for each hiker who passes (Black Cat), or an opportunity's reward. */
  reward?: readonly Effect[];
  rewardText?: readonly TextPart[];
  risk?: RiskDef;
  /** A rule the game can't run yet; the card still shows, but this part waits. */
  waitingOn?: string;
}

export interface TrialDef extends BaseDef {
  kind: 'trial';
  goal: TrialGoal;
  deadline: Deadline;
  goalText: readonly TextPart[];
  penalty: readonly Effect[];
  penaltyText: readonly TextPart[];
  /** On success (Lost Pup: +2 Morale). */
  reward?: readonly Effect[];
  /** Rocco Raccoon: rewards that stack by how many days it took. */
  stagedRewards?: readonly { withinDays: number; effects: readonly Effect[] }[];
  rewardText?: readonly TextPart[];
}

export type CardDef = ChallengeDef | TrialDef;
