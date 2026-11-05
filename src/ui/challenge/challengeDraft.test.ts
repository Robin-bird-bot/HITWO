import { describe, expect, it } from 'vitest';
import { validateAction, type GameState } from '../../engine';
import { fixtureGame, hiker, place, run } from '../../engine/test/fixtures';
import {
  canGive,
  give,
  penaltyTag,
  sectionStatus,
  skip,
  startDraft,
  toAction,
  type Draft,
} from './challengeDraft';
import { openCardDef } from '../../engine';

function opened(cardId: string, setup: (s: GameState) => void = () => {}) {
  const s = fixtureGame({ seed: 3, challenges: true });
  place(s, 'ash', 'L');
  place(s, 'birch', 'L');
  setup(s);
  const state = run(s, { type: 'debug', op: { kind: 'openChallenge', cardId, tileId: 'L' } });
  const open = state.challenge;
  if (!open) throw new Error('not opened');
  return { state, open };
}

describe('the challenge pop-up draft', () => {
  it('starts with the first space selected and fills it from the packs', () => {
    const { state, open } = opened('flies', (s) => {
      hiker(s, 'ash').inventory.resources = { wood: 2, fish: 1 };
      hiker(s, 'birch').inventory.resources = { moss: 2 };
    });
    let d: Draft = startDraft(state, open);
    // No food cards on the tile, so the resources space is selected first.
    expect(d.target).toEqual({ section: 0, option: 1, req: 0 });
    expect(canGive(state, open, d, { kind: 'resource', from: 'ash', resource: 'fish' })).toBe(
      false,
    );
    d = give(state, open, d, { kind: 'resource', from: 'ash', resource: 'wood' });
    d = give(state, open, d, { kind: 'resource', from: 'ash', resource: 'wood' });
    expect(canGive(state, open, d, { kind: 'resource', from: 'ash', resource: 'wood' })).toBe(
      false,
    );
    expect(sectionStatus(state, open, d, 0)).toMatchObject({ decision: undefined, missing: 1 });
    d = give(state, open, d, { kind: 'resource', from: 'birch', resource: 'moss' });
    expect(sectionStatus(state, open, d, 0)).toMatchObject({ decision: 'pay', option: 1 });

    const action = toAction(state, open, d);
    expect(action && validateAction(state, action)).toBeNull();
  });

  it('fails a section on ✗, or when nothing on the tile could pay it', () => {
    const { state, open } = opened('steep-trail', (s) => {
      hiker(s, 'birch').stats.energy = 1;
      hiker(s, 'ash').stats.energy = 0;
    });
    let d = startDraft(state, open);
    // Energy 0 and 1 on the tile: nobody can find 2 Energy.
    expect(sectionStatus(state, open, d, 0)).toMatchObject({ decision: 'fail', impossible: true });

    const fresh = opened('steep-trail');
    d = skip(startDraft(fresh.state, fresh.open), 1);
    expect(sectionStatus(fresh.state, fresh.open, d, 1).decision).toBe('fail');
    expect(toAction(fresh.state, fresh.open, d)).toBeUndefined(); // Ash still to decide.
  });

  it('moves the selection on to the next hiker once a space is full', () => {
    const { state, open } = opened('steep-trail');
    let d = startDraft(state, open);
    d = give(state, open, d, { kind: 'stat', from: 'ash', stat: 'energy' });
    expect(d.target).toEqual({ section: 0, option: 0, req: 0 });
    d = give(state, open, d, { kind: 'stat', from: 'ash', stat: 'energy' });
    expect(d.target).toEqual({ section: 1, option: 0, req: 0 });
  });

  it('names the penalty, with each hiker’s own Y', () => {
    const { open } = opened('steep-trail');
    const card = openCardDef(open);
    if (!card) throw new Error('no card');
    const ash = { id: 'ash' } as never;
    expect(penaltyTag(card, open.rolls)).toMatch(/^60%: STRAINED \d–\d DAYS$/);
    expect(penaltyTag(card, open.rolls, ash)).toBe(
      `60%: STRAINED ${open.rolls.y.ash?.days} DAY${open.rolls.y.ash?.days === 1 ? '' : 'S'}`,
    );
  });
});
