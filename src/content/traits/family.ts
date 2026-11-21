/**
 * Family traits (02-traits-and-conditions.md, "Families"): only hikers of
 * certain families can have them. "Pets" are Dogs and Cats. Plush hikers
 * aren't real pets, so traits for Dogs or Pets don't count them.
 */
import { BALANCE } from '../../config/balance';
import type { Hooks, QueryContext, TraitDef } from '../../engine/effects';
import type { Family, ResourceId } from '../../engine/types';
import { ITEMS } from '../items';
import { RESOURCES } from '../resources';
import { atStartOfDay, othersOf } from './moraleKit';
import { family, morale, PETS, trail, utility } from './build';
import { COPY_TEXT, copyHooks } from './utility';

const N = BALANCE.traits;
const ONE = N.morale;

const familyOf = (ctx: QueryContext, id: string) =>
  ctx.state.hikers.find((h) => h.id === id)?.family;
const resourceName = (id: ResourceId) => RESOURCES.find((r) => r.id === id)?.name ?? id;

/** Bringing these families along with this hiker's Move All costs nothing extra. */
const freeToBring = (source: string, who: readonly Family[]): Hooks => ({
  modifyCost: (q, ctx) => {
    if (q.key !== 'moveAll.perHiker' || q.actorId !== ctx.self.id) return undefined;
    const family = familyOf(ctx, q.subjectId);
    return family && who.includes(family) ? { source, percent: -100 } : undefined;
  },
});

/** Start of day: +1 with someone of this family on the tile, −1 without. */
const withOrWithout = (name: string, who: Family, word: string) =>
  atStartOfDay(name, (ctx) =>
    othersOf(ctx, who).length
      ? { delta: ONE, why: `with ${word}` }
      : { delta: -ONE, why: `no ${word.replace(/^(a|another) /, '')} here` },
  );

export const FAMILY_TRAITS: readonly TraitDef[] = [
  trail(1, 'lapPet', 'Lap Pet', 'Being moved with the group by a Human costs nothing extra.', {
    ...family(...PETS),
    hooks: {
      modifyCost: (q, ctx) =>
        q.key === 'moveAll.perHiker' &&
        q.subjectId === ctx.self.id &&
        familyOf(ctx, q.actorId) === 'human'
          ? { source: 'Lap Pet', percent: -100 }
          : undefined,
    },
  }),
  trail(
    1,
    'petSitter',
    'Pet Sitter',
    'Pets brought along by this hiker’s Move All cost nothing extra.',
    { ...family('human'), hooks: freeToBring('Pet Sitter', PETS) },
  ),
  trail(
    2,
    'herder',
    'Herder',
    'Humans brought along by this hiker’s Move All cost nothing extra.',
    { ...family('dog'), hooks: freeToBring('Herder', ['human']) },
  ),
  utility(2, 'copycat', 'Copycat', COPY_TEXT, {
    ...family('cat'),
    group: 'copier',
    hooks: copyHooks('Copycat', 0),
  }),
  utility(
    2,
    'dogWhisperer',
    'Dog Whisperer',
    'Dogs on this hiker’s tile get +1 card to choose from when scavenging.',
    {
      ...family('human'),
      hooks: {
        modifyTileScavenge: (_q, target, ctx) =>
          target.family === 'dog'
            ? {
                source: 'Dog Whisperer',
                label: `Dog Whisperer: 1 extra card (${ctx.self.name} is here)`,
                tone: 'bonus',
                cards: N.dogWhisperer.cards,
              }
            : undefined,
      },
    },
  ),
  utility(
    2,
    'fetch',
    'Fetch',
    'Once per day, as a free action, takes 1 resource from a hiker on an adjacent tile.',
    {
      ...family('dog'),
      ability: {
        id: 'fetch',
        label: 'Fetch',
        limit: { per: 'day', uses: 1 },
        // Boss's days (Tag Team): items too, from 2 tiles away.
        choicesFor(ctx) {
          const boost = ctx.boost('fetch');
          const reach = Math.max(N.fetch.reach, boost.reach);
          return ctx.state.hikers
            .filter((h) => {
              if (h.status !== 'active' || h.id === ctx.self.id) return false;
              const d = ctx.distance(h.tileId, ctx.self.tileId);
              return d >= 1 && d <= reach;
            })
            .flatMap((h) => [
              ...(Object.entries(h.inventory.resources) as [ResourceId, number][])
                .filter(([, n]) => n > 0)
                .map(([r]) => ({
                  id: `${h.id}|r|${r}`,
                  label: `${resourceName(r)} from ${h.name}`,
                })),
              ...(boost.items
                ? h.inventory.bag.map((i) => ({
                    id: `${h.id}|i|${i.uid}`,
                    label: `${ITEMS[i.itemId]?.name ?? 'Item'} from ${h.name}`,
                  }))
                : []),
            ]);
        },
        apply(ctx, choice) {
          const [hikerId, kind, what] = (choice ?? '').split('|');
          const from = ctx.state.hikers.find((h) => h.id === hikerId);
          if (!from || !what) return;
          ctx.take(
            from,
            ctx.self,
            kind === 'i' ? { itemUid: what } : { resource: what as ResourceId },
            'Fetch',
          );
        },
      },
    },
  ),
  utility(
    2,
    'mouser',
    'Mouser',
    'Night events that take food or resources skip hikers on this hiker’s tile.',
    { ...family('cat'), hooks: { guardsSupplies: () => true } },
  ),
  utility(1, 'trainer', 'Trainer', 'Pets on this hiker’s tile gain 50% more XP.', {
    ...family('human'),
    hooks: {
      modifyTileXp: (_q, target) =>
        PETS.includes(target.family)
          ? { source: 'Trainer', percent: N.trainer.percent }
          : undefined,
    },
  }),
  // Family Morale traits (checked at the start of the day). Plush hikers aren't Dogs or Cats.
  morale(
    'dogLover',
    'Dog Lover',
    'Start of day: +1 Morale sharing a tile with a Dog, −1 with no Dog on the tile.',
    { ...family('human'), hooks: withOrWithout('Dog Lover', 'dog', 'a Dog') },
  ),
  morale(
    'catPerson',
    'Cat Person',
    'Start of day: +1 Morale sharing a tile with a Cat, −1 with no Cat on the tile.',
    { ...family('human'), hooks: withOrWithout('Cat Person', 'cat', 'a Cat') },
  ),
  morale(
    'loyal',
    'Loyal',
    'Start of day: +1 Morale sharing a tile with a Human, −1 with no Human on the tile.',
    { ...family(...PETS), hooks: withOrWithout('Loyal', 'human', 'a Human') },
  ),
  morale(
    'packAnimal',
    'Pack Animal',
    'Start of day: +1 Morale sharing a tile with another Dog, −1 with no other Dog on the tile.',
    { ...family('dog'), hooks: withOrWithout('Pack Animal', 'dog', 'another Dog') },
  ),
  morale(
    'aloof',
    'Aloof',
    'Start of day: +1 Morale with no Dog on the tile, −1 sharing a tile with a Dog.',
    {
      ...family('cat'),
      hooks: atStartOfDay('Aloof', (ctx) =>
        othersOf(ctx, 'dog').length
          ? { delta: -ONE, why: 'a Dog is here' }
          : { delta: ONE, why: 'no Dog here' },
      ),
    },
  ),
];
