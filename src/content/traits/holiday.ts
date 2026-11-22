/**
 * The holiday hikers' new traits (Nov 20 update, holiday-hikers-2;
 * 07-characters.md, "Holiday hikers"): Grammy Clause, Lelf, the Grinch and
 * Redolf. Most of them are about Presents (src/engine/items/presents.ts).
 * None has icon art yet, so their badges show initials until Wyatt sends it.
 *
 * The Grinch is a she (she's Ellie): her traits say she and her. The rest
 * say "this hiker", like every other trait.
 */
import { BALANCE } from '../../config/balance';
import type { AbilityChoice, QueryContext, TraitDef } from '../../engine/effects';
import type { Hiker, PresentGrade, ResourceId } from '../../engine/types';
import { ITEMS } from '../items';
import { presentName } from '../items/presents';
import { morale, special, trail, unique, utility } from './build';
import { atStartOfDay, moraleNow } from './moraleKit';

const N = BALANCE.traits;

/** +1 or −1, the way the docs write a Morale change. */
const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

/** One Present of each grade in the hiker's bag: the first of each, in bag order. */
function presentsByGrade(hiker: Hiker): { uid: string; grade: PresentGrade }[] {
  const seen = new Set<PresentGrade>();
  const out: { uid: string; grade: PresentGrade }[] = [];
  for (const item of hiker.inventory.bag) {
    if (ITEMS[item.itemId]?.type !== 'present') continue;
    const grade = item.grade ?? 'plain';
    if (seen.has(grade)) continue;
    seen.add(grade);
    out.push({ uid: item.uid, grade });
  }
  return out;
}

/** "Smash a Tier 3 Present": one choice per grade of Present in the hiker's bag. */
const presentChoices =
  (verb: string) =>
  (ctx: QueryContext): AbilityChoice[] =>
    presentsByGrade(ctx.self).map((p) => ({
      id: p.uid,
      label: `${verb} a ${presentName(p.grade)}`,
    }));

/** The Present a choice names, if it's still in the hiker's bag. */
const hasPresent = (hiker: Hiker, uid: string | undefined) =>
  hiker.inventory.bag.some((i) => i.uid === uid && ITEMS[i.itemId]?.type === 'present');

export const HOLIDAY_TRAITS: readonly TraitDef[] = [
  // ── Grammy Clause ──
  utility(
    null,
    'giftWrapper',
    'Gift Wrapper',
    `Crafts only Presents, and can’t open them. Plain: ${BALANCE.presents.sameResource} of one resource or ${BALANCE.presents.sameType} of one type. Wish lists: ${BALANCE.presents.smallWishList} make Tier 2+, ${BALANCE.presents.bigWishList} make Tier 3. Both change after every Present.`,
    {
      ...unique('grammyClause'),
      hooks: {
        wrapsPresents: () => true,
        onRunStart: (ctx) => ctx.rollWishLists(ctx.self),
        canAct: (q, ctx) => {
          if (q.action.type === 'craft') return `${ctx.self.name} only wraps Presents.`;
          if (q.action.type === 'openPresent') return 'Grammy can’t open her own Presents.';
          return undefined;
        },
      },
    },
  ),
  utility(
    null,
    'downTheChimney',
    'Down the Chimney',
    'Once per day, as a free action: send a Present from this hiker’s pack to any hiker on the map.',
    {
      ...unique('grammyClause'),
      ability: {
        id: 'downTheChimney',
        label: 'Down the Chimney',
        limit: { per: 'day', uses: 1 },
        choicesFor: (ctx) => {
          const to = ctx.state.hikers.filter(
            (h) => h.id !== ctx.self.id && h.status === 'active' && ctx.bagRoom(h) > 0,
          );
          return presentsByGrade(ctx.self).flatMap((p) =>
            to.map((h) => ({
              id: `${p.uid}>${h.id}`,
              label: `${presentName(p.grade)} to ${h.name}`,
            })),
          );
        },
        apply(ctx, choice) {
          const [uid, toId] = (choice ?? '').split('>');
          const to = ctx.state.hikers.find((h) => h.id === toId);
          if (to && uid) ctx.sendItem(ctx.self, to, uid, 'Down the Chimney');
        },
      },
    },
  ),
  utility(
    null,
    'checkingItTwice',
    'Checking It Twice',
    'Once per day, as a free action: both wish lists change.',
    {
      ...unique('grammyClause'),
      ability: {
        id: 'checkingItTwice',
        label: 'Checking It Twice',
        limit: { per: 'day', uses: 1 },
        validate: (ctx) =>
          ctx.self.wishLists ? undefined : `${ctx.self.name} has no wish lists to check.`,
        apply(ctx) {
          ctx.rollWishLists(ctx.self);
          ctx.note(ctx.self, 'Checking It Twice', 'New wish lists.');
        },
      },
    },
  ),
  morale(
    'seasonOfGiving',
    'Season of Giving',
    `${signed(N.seasonOfGiving.opened)} Morale each time someone opens a Present this hiker wrapped. ${signed(N.seasonOfGiving.noneWrapped)} at the start of a day after wrapping none.`,
    {
      hooks: {
        ...atStartOfDay('Season of Giving', (ctx) =>
          (ctx.self.lastWrapDay ?? 0) < ctx.state.day - 1
            ? { delta: N.seasonOfGiving.noneWrapped, why: 'wrapped no Presents yesterday' }
            : undefined,
        ),
        onPresentOpened(e, ctx) {
          if (e.wrappedBy === ctx.self.id) {
            moraleNow(ctx, 'Season of Giving', N.seasonOfGiving.opened, 'a Present was opened');
          }
        },
      },
    },
  ),

  // ── Lelf ──
  utility(
    null,
    'toyMaker',
    'Toy Maker',
    `Presents this hiker opens hold a Tool ${N.toyMaker.toolWeight}× as often.`,
    {
      ...special('lelf'),
      hooks: { presentWeights: () => ({ tool: N.toyMaker.toolWeight }) },
    },
  ),
  utility(
    null,
    'spareParts',
    'Spare Parts',
    `As a free action: take apart a Present for ${N.spareParts.resources} resources of your choice.`,
    {
      ...unique('lelf'),
      ability: {
        id: 'spareParts',
        label: 'Spare Parts',
        limit: { per: 'day', uses: Infinity },
        choicesFor: presentChoices('Take apart'),
        resourcePick: N.spareParts.resources,
        validate: (ctx, choice) =>
          ctx.resourceRoom(ctx.self) < N.spareParts.resources
            ? `${ctx.self.name} needs room for ${N.spareParts.resources} more resources.`
            : hasPresent(ctx.self, choice?.split('|')[0])
              ? undefined
              : 'That Present isn’t in the pack.',
        apply(ctx, choice) {
          const [uid, picked = ''] = (choice ?? '').split('|');
          if (!uid) return;
          ctx.usePresent(ctx.self, uid, 'parts', 'Spare Parts');
          ctx.gain(ctx.self, picked.split(',').filter(Boolean) as ResourceId[], 'Spare Parts');
        },
      },
    },
  ),
  morale(
    'holidaySpirit',
    'Holiday Spirit',
    `${signed(N.holidaySpirit.opened)} Morale each time a hiker on this tile opens a Present. ${signed(N.holidaySpirit.noneOpened)} at the start of a day after nobody opened one.`,
    {
      hooks: {
        ...atStartOfDay('Holiday Spirit', (ctx) =>
          (ctx.state.lastPresentDay ?? 0) < ctx.state.day - 1
            ? { delta: N.holidaySpirit.noneOpened, why: 'nobody opened a Present yesterday' }
            : undefined,
        ),
        onPresentOpened(e, ctx) {
          if (e.tileId === ctx.self.tileId) {
            moraleNow(ctx, 'Holiday Spirit', N.holidaySpirit.opened, 'a Present opened here');
          }
        },
      },
    },
  ),

  // ── The Grinch (she/her) ──
  utility(
    null,
    'choosy',
    'Choosy',
    `When she opens a Present, she sees ${N.choosy.choices} items and keeps 1.`,
    { ...unique('grinch'), hooks: { presentChoices: () => N.choosy.choices } },
  ),
  utility(
    null,
    'twoSizesTooSmall',
    'Two Sizes Too Small',
    'She can’t give or trade items to other hikers, only receive them. She can still use, drop or sell them.',
    { ...unique('grinch'), hooks: { keepsItems: () => 'The Grinch doesn’t share.' } },
  ),
  utility(
    null,
    'wreckTheHalls',
    'Wreck the Halls',
    `As a free action, she smashes a Present in her pack for ${N.wreckTheHalls.min}–${N.wreckTheHalls.max} Morale.`,
    {
      ...unique('grinch'),
      ability: {
        id: 'wreckTheHalls',
        label: 'Wreck the Halls',
        limit: { per: 'day', uses: Infinity },
        choicesFor: presentChoices('Smash'),
        apply(ctx, choice) {
          if (!choice || !hasPresent(ctx.self, choice)) return;
          ctx.usePresent(ctx.self, choice, 'smashed', 'Wreck the Halls');
          const n = ctx.int(N.wreckTheHalls.min, N.wreckTheHalls.max);
          ctx.changeStat(ctx.self, 'morale', n, 'Wreck the Halls', 'she smashed a Present');
        },
      },
    },
  ),
  morale(
    'bahHumbug',
    'Bah Humbug',
    `${signed(N.bahHumbug.opened)} Morale each time she opens a Present. ${signed(N.bahHumbug.fire)} each time another hiker on her tile Sits by the Fire.`,
    {
      ...special('grinch'),
      hooks: {
        onPresentOpened(e, ctx) {
          if (e.openerId === ctx.self.id) {
            moraleNow(ctx, 'Bah Humbug', N.bahHumbug.opened, 'she opened a Present');
          }
        },
        // TODO(wyatt): Sit by the Fire is still held, so only the Present half works in play.
        onTileSitByFire: (_e, ctx) =>
          moraleNow(ctx, 'Bah Humbug', N.bahHumbug.fire, 'someone sat by the fire'),
      },
    },
  ),

  // ── Redolf ──
  trail(
    null,
    'rednose',
    'Rednose',
    // No effect for now (Phase 10.6); it's reworked in Phase 10.7. The badge and icon stay.
    'Placeholder text',
    { ...unique('redolf') },
  ),
  utility(
    null,
    'treatSniffer',
    'Treat Sniffer',
    `Presents this hiker opens hold Food ${N.treatSniffer.foodWeight}× as often.`,
    {
      ...special('redolf'),
      hooks: { presentWeights: () => ({ food: N.treatSniffer.foodWeight }) },
    },
  ),
  utility(
    null,
    'presentMuncher',
    'Present Muncher',
    `As a free action: eat a Present for ${N.presentMuncher.min}–${N.presentMuncher.max} Appetite.`,
    {
      ...unique('redolf'),
      ability: {
        id: 'presentMuncher',
        label: 'Present Muncher',
        limit: { per: 'day', uses: Infinity },
        choicesFor: presentChoices('Eat'),
        apply(ctx, choice) {
          if (!choice || !hasPresent(ctx.self, choice)) return;
          ctx.usePresent(ctx.self, choice, 'eaten', 'Present Muncher');
          const n = ctx.int(N.presentMuncher.min, N.presentMuncher.max);
          if (n > 0) ctx.changeStat(ctx.self, 'appetite', n, 'Present Muncher', 'ate a Present');
          else ctx.note(ctx.self, 'Present Muncher', 'Mostly wrapping paper: no Appetite.');
        },
      },
    },
  ),
];
