import { describe, expect, it } from 'vitest';
import { SCAVENGE_CARDS } from '../../content';
import type { ScavengeCard, ScavengeCardType } from '../../engine';
import { backKind, cardText, cardTitle, faceIcons, resourcesTitle } from './cardLook';

const card = (type: ScavengeCardType, extra: Partial<ScavengeCard> = {}): ScavengeCard => ({
  type,
  rarity: SCAVENGE_CARDS[type].rarity,
  node: 'forest',
  flipped: true,
  ...extra,
});

describe('scavenge card names', () => {
  it('names what-you-see cards after their resources, as in ScavTypes', () => {
    expect(cardTitle(card('resource', { resources: ['wood'] }))).toBe('WOOD');
    expect(cardTitle(card('x2', { node: 'river', resources: ['fish', 'fish'] }))).toBe('FISH ×2');
    expect(cardTitle(card('pair', { resources: ['wood', 'moss'] }))).toBe('WOOD + MOSS');
    expect(cardTitle(card('mixed', { node2: 'river', resources: ['wood', 'fish'] }))).toBe(
      'WOOD + FISH',
    );
  });

  it('names the rest by type, keeping a Wild secret', () => {
    expect(cardTitle(card('trio', { resources: ['wood', 'moss', 'grass'] }))).toBe('TRIO');
    expect(cardTitle(card('wild', { resources: ['grass'] }))).toBe('WILD');
    expect(cardTitle(card('bundleOfTheWild'))).toBe('BUNDLE OF THE WILD');
    expect(faceIcons(card('wild', { resources: ['grass'] }))).toEqual([]);
  });

  it('fills in the node in the line under the card', () => {
    expect(cardText(card('choice', { node: 'mountain' }))).toBe('Pick any Mountain resource');
  });

  it('says what a revealed card gave', () => {
    expect(resourcesTitle(['clay', 'clay'])).toBe('CLAY ×2');
    expect(resourcesTitle(['oil', 'wood', 'oil'])).toBe('OIL ×2 + WOOD');
  });

  it('shows the node, caps or item back', () => {
    expect(backKind(card('varietyWild', { node: 'river' }))).toBe('river');
    expect(backKind(card('caps'))).toBe('caps');
    expect(backKind(card('choiceShelter'))).toBe('items');
  });
});
