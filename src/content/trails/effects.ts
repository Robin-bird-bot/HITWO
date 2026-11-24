/**
 * What each Skill Trails step does (09-hikers.md, "The first 6 hikers" and
 * "Rules that need care"), by step id. Each one plugs into the engine's hook
 * points; the engine never checks for a step by name. Numbers are in
 * BALANCE.trails.
 *
 * - **Move All:** "brought along" means moved by someone else's Move All. It
 *   covers the leader's Appetite for that hiker and the hiker's own (a muddy
 *   line, the night). Cost cuts come first, then chances; nothing goes below 0.
 * - **First and last** (Copydog): on the hiker's tile this phase. First:
 *   nobody scavenged it earlier this phase. Last: everyone else on the tile has
 *   acted. Alone, they're both.
 * - **Usable steps** share an id with their upgrade, so uses carry over.
 */
import { BALANCE } from '../../config/balance';
import type {
  AbilityDef,
  CraftModifier,
  EffectContext,
  Hooks,
  ItemType,
  QueryContext,
  TraitDef,
} from '../../engine/effects';
import type { Hiker, ItemTypeName, Tile } from '../../engine/types';
import { CARDS, CHALLENGES } from '../challenges';
import { ITEMS, isOffered } from '../items';
import { RESOURCES } from '../resources';

export type StepEffect = Pick<TraitDef, 'hooks' | 'ability' | 'toggle'>;

const B = BALANCE.trails;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Other hikers still hiking on this hiker's tile. */
const others = (ctx: QueryContext): Hiker[] =>
  ctx.hikersOnTile(ctx.self.tileId).filter((h) => h.id !== ctx.self.id);

/** Being brought along costs this hiker no Appetite: the leader's part for them, and their own. */
const broughtFree =
  (source: string): Hooks['modifyCost'] =>
  (q, ctx) =>
    q.subjectId === ctx.self.id &&
    (q.key === 'moveAll.perHiker' || (q.key === 'move.appetite' && q.role === 'brought'))
      ? { source, percent: -100 }
      : undefined;

/** Moving alone (the Move action) costs this hiker less Appetite. */
const aloneDiscount =
  (source: string, flat: number): Hooks['modifyCost'] =>
  (q, ctx) =>
    q.key === 'move.appetite' && q.via === 'move' && q.subjectId === ctx.self.id
      ? { source, flat: -flat }
      : undefined;

/** Weather that isn't Clear (Rain Lover). */
const weatherOut = (ctx: QueryContext) => (ctx.state.weather?.today ?? 'clear') !== 'clear';

const resourcesOf = (node: string) => RESOURCES.filter((r) => r.node === node).map((r) => r.id);

/** Hikers who scavenged this tile earlier this phase (Copydog), not counting this one. */
function earlierThisPhase(ctx: QueryContext, tileId: string): number {
  const ids = ctx.state.scavengedToday
    .filter((r) => r.tileId === tileId && r.phase === ctx.state.phase && r.hikerId !== ctx.self.id)
    .map((r) => r.hikerId);
  return new Set(ids).size;
}

/** Everyone else on this hiker's tile has acted this phase (alone counts). */
const scavengesLast = (ctx: QueryContext) => others(ctx).every((h) => h.acted);

const WORD = { food: 'food', clothes: 'clothes', shelter: 'shelters', tool: 'tools' } as const;

/** Artisan (Tier 2) or Master (Tier 3) for one item type: that tier, and more cards. */
function craftsTier(name: string, type: keyof typeof WORD, tier: 2 | 3): Hooks {
  const cards = tier === 2 ? B.artisanCards : B.masterCards;
  return {
    craftTier: (t) => (t === type ? tier : undefined),
    modifyCraft: (q): CraftModifier | undefined =>
      q.type === type
        ? {
            source: name,
            label: `${name}: ${cards} more card${cards === 1 ? '' : 's'} crafting ${WORD[type]}`,
            tone: 'bonus',
            cards,
          }
        : undefined,
  };
}

/** Learns random Tier 1 recipes of a type (Family Cookbook and the rest). */
const learnsRecipes = (name: string, type: ItemTypeName): Hooks => ({
  onLearn: (ctx) => ctx.learnBlueprints(ctx.self, type, 1, B.recipes, name),
});

// ── Leash Puller ───────────────────────────────────────────────────────────

const leashOn: Hooks = { pullsGroup: () => ({ energy: B.leashPuller.energy, everyone: true }) };
/** Off (II, III): each hiker brought rolls on its own. III: brings hikers who acted; nobody loses an action. */
function leashOff(tier: 2 | 3): Hooks {
  return {
    broughtWaive: (_e, ctx) =>
      ctx.roll(B.leashPuller.offChance[tier])
        ? { appetite: true, ...(tier === 2 ? { keepAction: true as const } : {}) }
        : undefined,
    ...(tier === 3 ? { bringsActed: () => true, broughtKeepAction: () => true } : {}),
  };
}

// ── Copydog ────────────────────────────────────────────────────────────────

function copydog(name: string, tier: 1 | 2 | 3): Hooks {
  return {
    modifyScavenge(q, ctx) {
      const out = [];
      const n = earlierThisPhase(ctx, q.tileId);
      if (n > 0) {
        out.push({
          source: name,
          label: `${name}: +${n} of the resource kept (${n === 1 ? '1 hiker' : `${n} hikers`} scavenged here this phase)`,
          tone: 'bonus' as const,
          bonus: { count: n, appetiteEach: 0 },
        });
      }
      const first = n === 0;
      const extra = tier === 2 ? first : tier === 3 ? scavengesLast(ctx) : false;
      if (extra) {
        out.push({
          source: name,
          label: `${name}: ${B.copydog.cards} more cards (${tier === 2 ? 'first' : 'last'} to scavenge here)`,
          tone: 'bonus' as const,
          cards: B.copydog.cards,
        });
      }
      return out;
    },
    // III: scavenging first costs no Appetite.
    ...(tier === 3
      ? {
          modifyCost: (q, ctx) =>
            q.key === 'scavenge.appetite' &&
            q.subjectId === ctx.self.id &&
            earlierThisPhase(ctx, ctx.self.tileId) === 0
              ? { source: name, percent: -100 }
              : undefined,
        }
      : {}),
  };
}

// ── Garbage Connoisseur ────────────────────────────────────────────────────

const garbage = (tier: 1 | 2 | 3): Hooks => ({
  recipeSubs: (type: ItemType) =>
    type === 'food'
      ? {
          for: ['meat', 'fish', 'mushroom'],
          with: ['metal', 'stone', 'flint'],
          perSwap: B.garbageConnoisseur.perSwap[tier],
        }
      : undefined,
});

// ── Furrager ───────────────────────────────────────────────────────────────

function furrager(name: string, tier: 1 | 2): Hooks {
  return {
    modifyScavenge: () => ({
      source: name,
      label:
        tier === 1
          ? `${name}: Fur is much likelier`
          : `${name}: Fur is much likelier, comes ×2 or ×3, and can turn up anywhere`,
      tone: 'bonus',
      resourceWeight: { fur: B.furrager.furWeight },
      ...(tier === 2
        ? {
            multiply: { resource: 'fur', x2: B.furrager.x2 },
            resourceSwap: { resource: 'fur', chance: B.furrager.offNodeChance },
          }
        : {}),
    }),
  };
}

const FUR_TRADE: AbilityDef = {
  id: 'furTrade',
  label: 'Fur Trade',
  limit: { per: 'phase', uses: Infinity },
  usesAction: true,
  choices: RESOURCES.map((r) => ({ id: r.id, label: r.name })),
  validate: (ctx) =>
    (ctx.self.inventory.resources.fur ?? 0) < B.furTrade.fur
      ? `Needs ${B.furTrade.fur} Fur.`
      : undefined,
  apply(ctx, choice) {
    if (!choice) return;
    ctx.spendResources(
      ctx.self,
      Array.from({ length: B.furTrade.fur }, () => 'fur'),
      'Fur Trade',
    );
    ctx.gain(ctx.self, [choice], 'Fur Trade');
  },
};

// ── Singer ─────────────────────────────────────────────────────────────────

const SINGER: AbilityDef = {
  id: 'singer',
  label: 'Singer',
  limit: { per: 'day', uses: 1 },
  validate: (ctx) =>
    ctx.self.stats.energy < B.singer.energy ? `Needs ${B.singer.energy} Energy.` : undefined,
  apply(ctx) {
    ctx.changeStat(ctx.self, 'energy', -B.singer.energy, 'Singer');
    for (const h of ctx.hikersOnTile(ctx.self.tileId)) {
      ctx.changeStat(h, 'morale', B.singer.morale, 'Singer', 'a song');
    }
  },
};

const SINGER_II: AbilityDef = {
  id: 'singer',
  label: 'Singer II',
  limit: { per: 'day', uses: 1 },
  apply(ctx) {
    const near = ctx.state.hikers.filter(
      (h) => h.status === 'active' && ctx.distance(h.tileId, ctx.self.tileId) <= 1,
    );
    for (const h of near) ctx.changeStat(h, 'morale', B.singer.moraleII, 'Singer II', 'a song');
  },
};

// ── Mom ────────────────────────────────────────────────────────────────────

const dogMom: Hooks = {
  onTileScavenged(e, ctx) {
    const dog = ctx.state.hikers.find((h) => h.id === e.scavengerId);
    if (dog?.family !== 'dog' || dog.id === ctx.self.id) return;
    const tile = ctx.state.section.tiles[ctx.self.tileId];
    const nodes = (tile?.nodes ?? []).filter((n) => n.type !== 'caps');
    if (!nodes.length) return;
    ctx.gain(ctx.self, [ctx.pick(resourcesOf(ctx.pick(nodes).type))], 'Dog Mom');
  },
};

function agilityClass(label: string, energy: number): AbilityDef {
  return {
    id: 'agilityClass',
    label,
    limit: { per: 'day', uses: 1 },
    // A Dog here who has already acted gets another action this phase.
    choicesFor: (ctx) =>
      others(ctx)
        .filter((h) => h.family === 'dog' && h.acted)
        .map((h) => ({ id: h.id, label: h.name })),
    validate: (ctx) =>
      energy && ctx.self.stats.energy < energy ? `Needs ${energy} Energy.` : undefined,
    apply(ctx, choice) {
      const dog = ctx.state.hikers.find((h) => h.id === choice);
      if (!dog) return;
      if (energy) ctx.changeStat(ctx.self, 'energy', -energy, label);
      ctx.refundAction(dog, label);
    },
  };
}

function mba(name: string, tier: 1 | 2 | 3): Hooks {
  return {
    modifyScavenge: () => ({
      source: name,
      label:
        tier === 1
          ? `${name}: Caps are likelier`
          : tier === 2
            ? `${name}: Caps are likelier, and Caps cards give ${B.mba.capsBonus} more`
            : `${name}: Caps likelier and worth ${B.mba.capsBonus} more, kept at once`,
      tone: 'bonus',
      typeWeight: { caps: B.mba.capsWeight },
      ...(tier >= 2 ? { capsBonus: B.mba.capsBonus } : {}),
      ...(tier === 3 ? { autoKeep: 'caps' as const } : {}),
    }),
  };
}

function traveler(name: string, tier: 1 | 2 | 3): Hooks {
  const ET = B.experiencedTraveler;
  return {
    waiveAppetite: (e, ctx) => e.cause === 'Move' && ctx.roll(ET.alone[tier]),
    ...(tier === 2 ? { waiveWhenBrought: (ctx: EffectContext) => ctx.roll(ET.brought[2]) } : {}),
    ...(tier === 3
      ? {
          modifyCost: broughtFree(name),
          onMove: (_e, ctx) => ctx.changeStat(ctx.self, 'morale', ET.morale, name, 'on the move'),
        }
      : {}),
  };
}

// ── Gdog ───────────────────────────────────────────────────────────────────

const HOMEMADE: Hooks = {
  modifyCraft: () => ({
    source: 'Homemade',
    label: `Homemade: ${B.homemade.cards} more card and +${B.homemade.luck} Luck`,
    tone: 'bonus',
    cards: B.homemade.cards,
    luck: B.homemade.luck,
  }),
};

// ── Wink ───────────────────────────────────────────────────────────────────

const JUST_AROUND: Hooks = {
  // Rolled once they've arrived, so each hiker's tile is where they moved to.
  waiveForGroup: (e, ctx) => {
    const h = ctx.state.hikers.find((x) => x.id === e.payerId);
    const near =
      !!h &&
      ctx.distance(h.tileId, ctx.state.section.checkpointId) <= B.justAroundTheNextCorner.tiles;
    return near && ctx.roll(B.justAroundTheNextCorner.chance);
  },
};

const PACKED_TOOLBOX: Hooks = {
  onLearn(ctx) {
    const pool = Object.values(ITEMS).filter(
      (d) => d.type === 'tool' && d.tier === 1 && isOffered(d),
    );
    for (let i = 0; i < B.packedToolbox.tools && pool.length; i++) {
      const def = ctx.pick(pool);
      pool.splice(pool.indexOf(def), 1);
      if (ctx.bagRoom(ctx.self) > 0) ctx.giveItem(ctx.self, def.id, 'Packed Toolbox');
      else
        ctx.note(
          ctx.self,
          'Packed Toolbox',
          `${ctx.self.name}’s pack is full: no room for the ${def.name}.`,
        );
    }
  },
};

// ── Rule Changer ───────────────────────────────────────────────────────────

/** "Row 3: Bear Encounter", or "Row 3, 2nd from the left" for a tile with nothing shown. */
function tileLabel(ctx: QueryContext, tile: Tile): string {
  const shown =
    tile.revealedCard && !tile.revealedCard.hidden ? CARDS[tile.revealedCard.cardId] : undefined;
  if (shown) return `Row ${tile.row + 1}: ${shown.name}`;
  const row = Object.values(ctx.state.section.tiles)
    .filter((t) => t.row === tile.row)
    .sort((a, b) => a.col - b.col);
  const at = row.indexOf(tile) + 1;
  const nth = at === 1 ? '1st' : at === 2 ? '2nd' : at === 3 ? '3rd' : `${at}th`;
  return row.length === 1 ? `Row ${tile.row + 1}` : `Row ${tile.row + 1}, ${nth} from the left`;
}

const isChallenge = (cardId: string) => CHALLENGES.some((c) => c.id === cardId);

function ruleChanger(label: string, tier: 1 | 2 | 3): AbilityDef {
  return {
    id: 'ruleChanger',
    label,
    limit: { per: 'biome', uses: B.ruleChanger.uses[tier] },
    tileChoices: true,
    choicesFor(ctx) {
      const tiles = Object.values(ctx.state.section.tiles).filter((t) => !t.visited);
      if (tier === 3) {
        // Any tile nobody has reached, whether or not it holds a challenge.
        return tiles
          .filter((t) => t.kind === 'normal')
          .map((t) => ({ id: t.id, label: tileLabel(ctx, t) }));
      }
      return tiles
        .filter((t) => {
          const card = t.revealedCard;
          if (!card || card.hidden || !isChallenge(card.cardId)) return false;
          if (tier === 1) return card.tier === 1 && ctx.distance(t.id, ctx.self.tileId) === 1;
          return card.tier <= 2;
        })
        .map((t) => ({ id: t.id, label: tileLabel(ctx, t) }));
    },
    apply(ctx, choice) {
      if (!choice) return;
      if (tier === 3) ctx.removeChallenge(choice, label);
      else ctx.swapChallenge(choice, label);
    },
  };
}

const rainLover = (name: string, tier: 1 | 2 | 3): Hooks => ({
  modifyScavenge: (_q, ctx) =>
    weatherOut(ctx)
      ? {
          source: name,
          label: `${name}: +${B.rainLover.luck[tier]} Luck and ${B.rainLover.cards} more card in this weather`,
          tone: 'luck',
          luck: B.rainLover.luck[tier],
          cards: B.rainLover.cards,
        }
      : undefined,
  ...(tier === 3
    ? {
        modifyXp: (_q, ctx) =>
          weatherOut(ctx) ? { source: name, percent: B.rainLover.xpPercent } : undefined,
      }
    : {}),
});

// ── Every step ─────────────────────────────────────────────────────────────

export const STEP_EFFECTS: Readonly<Record<string, StepEffect>> = {
  // Finn
  'finn-leader-t1': { toggle: { on: leashOn, off: {} } },
  'finn-leader-t2': { toggle: { on: leashOn, off: leashOff(2) } },
  'finn-leader-t3': { toggle: { on: leashOn, off: leashOff(3) } },
  'finn-follower-t1': { hooks: { modifyCost: broughtFree('Whatcha Up To?') } },
  'finn-follower-t2': {
    hooks: { modifyCost: broughtFree('Whatcha Up To? II'), keepsActionWhenBrought: () => true },
  },
  'finn-follower-t3': {
    hooks: {
      // Onto a tile with someone there: no action and no Appetite, every time.
      freeMove: (q, ctx) =>
        ctx.hikersOnTile(q.toTileId).some((h) => h.id !== ctx.self.id)
          ? { key: 'neverAlone', per: 'phase', discount: 'all', unlimited: true }
          : undefined,
    },
  },
  'finn-scavenger-t1': { hooks: copydog('Copydog', 1) },
  'finn-scavenger-t2': { hooks: copydog('Copydog II', 2) },
  'finn-scavenger-t3': { hooks: copydog('Copydog III', 3) },

  // Ellie
  'ellie-chef-t1': { hooks: garbage(1) },
  'ellie-chef-t2': { hooks: garbage(2) },
  'ellie-chef-t3': { hooks: garbage(3) },
  'ellie-scavenger-t1': { hooks: furrager('Furrager', 1) },
  'ellie-scavenger-t2': { hooks: furrager('Furrager II', 2) },
  'ellie-scavenger-t3': { ability: FUR_TRADE },
  'ellie-entertainer-t1': { ability: SINGER },
  'ellie-entertainer-t2': { hooks: { watchReach: () => 1 } },
  'ellie-entertainer-t3': { ability: SINGER_II },

  // Mom
  'mom-support-t1': { hooks: dogMom },
  'mom-support-t2': { ability: agilityClass('Agility Class', B.agilityClass.energy) },
  'mom-support-t3': { ability: agilityClass('Agility Class II', 0) },
  'mom-merchant-t1': { hooks: mba('MBA', 1) },
  'mom-merchant-t2': { hooks: mba('MBA II', 2) },
  'mom-merchant-t3': { hooks: mba('MBA III', 3) },
  'mom-trekker-t1': { hooks: traveler('Experienced Traveler', 1) },
  'mom-trekker-t2': { hooks: traveler('Experienced Traveler II', 2) },
  'mom-trekker-t3': { hooks: traveler('Experienced Traveler III', 3) },

  // Gdog
  'gdog-chef-t1': { hooks: learnsRecipes('Family Cookbook', 'food') },
  'gdog-chef-t2': { hooks: craftsTier('Artisan Chef', 'food', 2) },
  'gdog-chef-t3': { hooks: craftsTier('Master Chef', 'food', 3) },
  'gdog-tailor-t1': { hooks: learnsRecipes('Clothing Catalogue', 'clothes') },
  'gdog-tailor-t2': { hooks: craftsTier('Artisan Seamstress', 'clothes', 2) },
  'gdog-tailor-t3': { hooks: craftsTier('Master Seamstress', 'clothes', 3) },
  'gdog-trekker-t1': {
    hooks: {
      modifyCost: aloneDiscount('Short', B.short.discount),
      modifyCapacity: (q) =>
        q.key === 'bag.slots' ? { source: 'Short', flat: B.short.slots } : undefined,
    },
  },
  'gdog-trekker-t2': {
    hooks: {
      // Brought along: 1 less for her part, not when she leads.
      modifyCost: (q, ctx) =>
        aloneDiscount('Short II', B.short.discount)?.(q, ctx) ??
        (q.key === 'moveAll.perHiker' && q.subjectId === ctx.self.id
          ? { source: 'Short II', flat: -B.short.discount }
          : undefined),
    },
  },
  'gdog-trekker-t3': { hooks: HOMEMADE },

  // Wink
  'wink-leader-t1': { hooks: { broughtKeepAction: () => true } },
  'wink-leader-t2': {
    hooks: {
      broughtKeepAction: () => true,
      // 1 less for the whole Move All, not per hiker.
      modifyCost: (q, ctx) =>
        q.key === 'moveAll.appetite' && q.actorId === ctx.self.id
          ? { source: 'Lead the Way II', flat: -B.leadTheWay.discount }
          : undefined,
    },
  },
  'wink-leader-t3': { hooks: JUST_AROUND },
  'wink-architect-t1': { hooks: learnsRecipes('Floor Plans', 'shelter') },
  'wink-architect-t2': { hooks: craftsTier('Artisan Architect', 'shelter', 2) },
  'wink-architect-t3': { hooks: craftsTier('Master Architect', 'shelter', 3) },
  'wink-packer-t1': { hooks: PACKED_TOOLBOX },
  'wink-packer-t2': { hooks: { extraToolUse: () => true } },
  'wink-packer-t3': { hooks: { skipsRevealed: () => true } },

  // Wyatt
  'wyatt-naturalist-t1': { hooks: rainLover('Rain Lover', 1) },
  'wyatt-naturalist-t2': { hooks: rainLover('Rain Lover II', 2) },
  'wyatt-naturalist-t3': { hooks: rainLover('Rain Lover III', 3) },
  'wyatt-daredevil-t1': { ability: ruleChanger('Rule Changer', 1) },
  'wyatt-daredevil-t2': { ability: ruleChanger('Rule Changer II', 2) },
  'wyatt-daredevil-t3': { ability: ruleChanger('Rule Changer III', 3) },
  'wyatt-smith-t1': { hooks: learnsRecipes('Toy Chest', 'tool') },
  'wyatt-smith-t2': { hooks: craftsTier('Artisan Smith', 'tool', 2) },
  'wyatt-smith-t3': { hooks: craftsTier('Master Smith', 'tool', 3) },
};
