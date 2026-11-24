/**
 * Placeholder glyphs (Phase 10.7): one small line drawing per class, drawn
 * in a Skill Trails badge that has no icon file yet (its class color, its
 * badge shape), and one per morale type for the name banner. Wyatt is
 * painting the real icons; these stand in until they arrive.
 */
import type { ClassId, MoraleTypeId } from '../../engine';

/** 24 × 24 paths, drawn with a round stroke and no fill. */
export const CLASS_GLYPHS: Readonly<Record<ClassId, string>> = {
  // A flag on a pole.
  leader: 'M6 21V4M6 4h11l-3 4 3 4H6',
  // Two paw prints, one behind the other.
  follower: 'M8 16a2 2 0 1 0 0.01 0M16 8a2 2 0 1 0 0.01 0M5 12l2 1M10 12l1 2M13 4l2 1M18 4l1 2',
  // Binoculars.
  scout:
    'M4 15a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M14 15a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M7 12V6h3v6M14 12V6h3v6M10 9h4',
  // A boot.
  trekker: 'M7 3v9l-3 4v3h15v-2l-5-2-2-3V3z',
  // A magnifying glass.
  scavenger: 'M10 10m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0M14.5 14.5L20 20',
  // A gear.
  crafter:
    'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
  // A cooking pot.
  chef: 'M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM2 10h2M20 10h2M9 6c0-2 2-2 2-4M14 6c0-2 2-2 2-4',
  // A hammer.
  smith: 'M5 21l9-9M12 5l5 5 3-3-5-5zM10 7l3-3',
  // A needle and thread.
  tailor: 'M18 3L6 15l-1 4 4-1L21 6zM15 6l3 3M6 15c-3 3 0 6 3 3',
  // A set square.
  architect: 'M4 20V4l16 16zM8 16V12l4 4z',
  // A backpack.
  packer: 'M7 8a5 5 0 0 1 10 0v12H7zM9 4h6M7 13h10M10 13v3h4v-3',
  // A leaf.
  naturalist: 'M5 19C5 9 11 4 20 4c0 9-5 15-15 15zM5 19l9-9',
  // A coin.
  merchant:
    'M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0M12 7v10M15 9h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9',
  // A heart.
  support: 'M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z',
  // A music note.
  entertainer:
    'M9 18V5l10-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  // A shield.
  hardy: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z',
  // A crescent moon and a star.
  watcher: 'M15 4a8 8 0 1 0 5 13A7 7 0 0 1 15 4zM18 3v3M16.5 4.5h3',
  // A flame.
  daredevil:
    'M12 21c-4 0-6-3-6-6 0-4 4-6 4-11 3 2 7 6 7 11 0 3-2 6-5 6zM12 21c-2 0-3-1-3-3 0-2 2-3 3-5 1 2 3 3 3 5 0 2-1 3-3 3z',
  // A die.
  jack: 'M5 5h14v14H5zM9 9h0.01M15 15h0.01M15 9h0.01M9 15h0.01',
};

/** The morale types' placeholder symbols (the legend's): people, a fork and knife, a bolt… */
export const MORALE_GLYPHS: Readonly<Record<MoraleTypeId, string>> = {
  // Three people.
  extrovert:
    'M12 8m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M5 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M19 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M7 19a5 5 0 0 1 10 0M1 19a4 4 0 0 1 5-4M23 19a4 4 0 0 0-5-4',
  // One person.
  introvert: 'M12 8m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0M5 20a7 7 0 0 1 14 0',
  // Two people.
  ambivert:
    'M8 9m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M16 9m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M2 20a6 6 0 0 1 12 0M10 20a6 6 0 0 1 12 0',
  // A fork and a knife.
  foody: 'M7 3v7a2 2 0 0 0 2 2v9M11 3v7a2 2 0 0 1-2 2M9 3v6M16 21V3c3 2 3 7 3 10h-3',
  // A lightning bolt.
  energetic: 'M13 2L5 14h6l-1 8 8-12h-6z',
  // A compass.
  wanderlust: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M15.5 8.5l-2 5-5 2 2-5z',
  // A house.
  homebody: 'M4 11l8-7 8 7M6 9v11h12V9M10 20v-5h4v5',
};
