/**
 * Button opportunities (Nov 6 update, 2): each press happens at once while the
 * pop-up stays open, and "Done" closes it.
 *
 * - buy: pay a price rolled for each press (Snake Salesman); a press the
 *   purse can't cover fails and costs nothing.
 * - slots: pay a stat, then a weighted outcome table (Snake Slots).
 * - shiftTiers: one random unrevealed tile gets easier, another harder (Predator Bait).
 * - raiseRandom: the presser gains something, and a random unrevealed tile
 *   gets harder, each tile only once (Predator's Den).
 * - revealConnected: reveal a connected tile's card, with a chance of injury
 *   (Old Firewatch Tower).
 *
 * Kinds are data (ButtonDef); nothing here names a card.
 */
import { resourceCount, resourceLimit } from '../inventory';
import { pushEvent } from '../log';
import { adjacentTileIds } from '../map';
import { pick, roll, weightedPick } from '../rng';
import { addInjury, changeStat } from '../stats';
import type { Action, GameState, Hiker, HikerId, Tile } from '../types';
import { applyEffects } from './applyEffects';
import { challengeHikers, openCardDef, paidCause } from './resolve';
import { tileTier } from './pick';
import { isRevealed } from '../wonders/wonders';
import { revealCardOn } from './reveal';
import { chanceOf, rollValue } from './rolls';
import type { ButtonDef, ChallengeDef } from './types';

type PressAction = Extract<Action, { type: 'pressButton' }>;

/** The press counter's key: one per party button, one per hiker for per-hiker buttons. */
export const pressKey = (button: ButtonDef, hikerId?: HikerId) =>
  button.per === 'hiker' ? `${button.id}:${hikerId ?? ''}` : button.id;

export function pressesLeft(
  state: GameState,
  button: ButtonDef,
  hikerId?: HikerId,
): number | undefined {
  if (button.max === undefined) return undefined;
  return button.max - (state.challenge?.presses?.[pressKey(button, hikerId)] ?? 0);
}

/** Tiles in this section nobody has landed on, whose cards are still unknown (not the Wonder's). */
export function unrevealedTiles(state: GameState): Tile[] {
  return Object.values(state.section.tiles).filter(
    (t) => t.kind === 'normal' && !t.visited && !t.revealedCard && !t.wonder,
  );
}

/**
 * Unknown tiles whose challenge can still drop a tier (none goes below Tier I).
 * TODO(wyatt): in biome 1 every tile starts at Tier I, so Predator Bait only
 * works there once something (Predator's Den) has raised a tile. Until then the
 * button is off, so a press can't only make things harder.
 */
export function easierTiles(state: GameState): Tile[] {
  return unrevealedTiles(state).filter((t) => tileTier(state, t) > 1);
}

/** Connected tiles a hiker could reveal from here (Old Firewatch Tower), a hidden Wonder included. */
export function revealableFrom(state: GameState, hiker: Hiker): Tile[] {
  return adjacentTileIds(state.section, hiker.tileId)
    .map((id) => state.section.tiles[id])
    .filter(
      (t): t is Tile =>
        !!t &&
        t.kind === 'normal' &&
        !t.visited &&
        !t.revealedCard &&
        !(t.wonder && isRevealed(t.wonder)),
    );
}

function find(state: GameState, action: PressAction) {
  const open = state.challenge;
  const card = open && openCardDef(open);
  const button = card?.buttons?.find((b) => b.id === action.button);
  const hiker = action.hikerId
    ? open && challengeHikers(state, open).find((h) => h.id === action.hikerId)
    : undefined;
  return { open, card, button, hiker };
}

export function validatePress(state: GameState, action: PressAction): string | undefined {
  const { open, card, button, hiker } = find(state, action);
  if (!open || !card || !button) return 'There’s no such button here.';
  if (button.per === 'hiker' && !hiker) return 'Pick a hiker on this tile.';
  const left = pressesLeft(state, button, action.hikerId);
  if (left !== undefined && left <= 0) return 'No presses left.';
  switch (button.kind) {
    case 'slots': {
      const pay = button.pay[Number(action.choice ?? 0)];
      if (!pay || !hiker) return 'Pick how to pay.';
      if (pay.stat === 'morale' && hiker.stats.morale <= 0) {
        return `Morale 0: ${hiker.name} can’t do anything that costs Morale.`;
      }
      if (hiker.stats[pay.stat] < pay.amount)
        return `${hiker.name} doesn’t have ${pay.amount} to pay.`;
      return undefined;
    }
    case 'shiftTiers':
      if (unrevealedTiles(state).length < 2) return 'There aren’t two unknown tiles left.';
      return easierTiles(state).length
        ? undefined
        : 'Every unknown tile is already Tier I, so none can get easier.';
    case 'raiseRandom':
      return unrevealedTiles(state).some((t) => !t.denRaised)
        ? undefined
        : 'Every unknown tile has already been made harder.';
    case 'revealConnected': {
      if (!hiker) return 'Pick a hiker on this tile.';
      const ok = revealableFrom(state, hiker).some((t) => t.id === action.choice);
      return ok ? undefined : 'Pick a connected tile nobody has landed on.';
    }
    case 'buy':
      return undefined;
  }
}

export function applyPress(state: GameState, action: PressAction): void {
  const { open, card, button, hiker } = find(state, action);
  if (!open || !card || !button) throw new Error('applyPress: no button');
  const key = pressKey(button, action.hikerId);
  open.presses = { ...open.presses, [key]: (open.presses?.[key] ?? 0) + 1 };
  const here = challengeHikers(state, open);
  const log = (note: string, extra: { easier?: string; harder?: string } = {}) =>
    pushEvent(state, {
      kind: 'pressed',
      cardId: card.id,
      button: button.id,
      ...(hiker ? { hikerId: hiker.id } : {}),
      note,
      ...extra,
    });
  const give = (to: Hiker[], effects: ChallengeDef['penalty']) =>
    applyEffects(
      state,
      { card, tileId: open.tileId, targets: to, onTile: here, rolls: open.rolls },
      effects,
    );

  switch (button.kind) {
    case 'buy': {
      const price = rollValue(state.rng, { roll: 'y', range: button.price }, open.rolls.luck);
      if (state.caps < price) {
        log(`couldn’t pay ${price} caps`);
        return;
      }
      state.caps -= price;
      log(`paid ${price} cap${price === 1 ? '' : 's'}`);
      // The first hiker here with room in their pack takes it.
      const to = here.find((h) => resourceCount(h) < resourceLimit(state, h)) ?? here[0];
      if (to) give([to], button.gives);
      return;
    }
    case 'slots': {
      const pay = button.pay[Number(action.choice ?? 0)];
      if (!pay || !hiker) return;
      changeStat(state, hiker, pay.stat, -pay.amount, paidCause(card.name));
      const outcome = weightedPick(
        state.rng,
        button.table.map((o) => ({ item: o, weight: o.weight })),
      );
      log(outcome.label);
      give([hiker], outcome.effects);
      return;
    }
    case 'shiftTiers': {
      const easier = pick(state.rng, easierTiles(state));
      const harder = pick(
        state.rng,
        unrevealedTiles(state).filter((t) => t.id !== easier.id),
      );
      easier.tierBonus = (easier.tierBonus ?? 0) - 1;
      harder.tierBonus = (harder.tierBonus ?? 0) + 1;
      log('one tile got easier, another harder', { easier: easier.id, harder: harder.id });
      return;
    }
    case 'raiseRandom': {
      if (hiker) give([hiker], button.gives);
      const tile = pick(
        state.rng,
        unrevealedTiles(state).filter((t) => !t.denRaised),
      );
      tile.tierBonus = (tile.tierBonus ?? 0) + 1;
      tile.denRaised = true;
      log('a tile somewhere got harder', { harder: tile.id });
      return;
    }
    case 'revealConnected': {
      if (!hiker || !action.choice) return;
      revealCardOn(state, action.choice, card.name);
      const injured = roll(state.rng, chanceOf(button.injury, { rolls: open.rolls, onTile: here }));
      if (injured) addInjury(state, hiker, card.name);
      log(injured ? 'revealed a tile, and slipped' : 'revealed a tile');
      return;
    }
  }
}
