/**
 * What the land is built from (Phase 10.5, section 8): the run seed, the
 * section's index and biome, and its tiles, nodes and paths. Nothing else, so
 * the same run always gets the same land and nothing needs saving.
 */
import type { NodeKind, Section } from '../../../../engine';
import { HEX } from '../../mapLayout';
import type { MapGeometry } from '../geometry';
import type { NameLists } from './features';
import type { LandInput } from './model';
import { paletteFor } from './palette';

const NAME_FILES = import.meta.glob<NameLists & { _note?: string }>(
  '/public/assets/map/oregon-names.json',
  { eager: true, import: 'default' },
);

/** The Oregon place names (public/assets/map/oregon-names.json). */
export const OREGON_NAMES: NameLists = (() => {
  const raw = Object.values(NAME_FILES)[0] ?? ({} as NameLists);
  const { river, creek, pond, lookout, woods, meadow, peak, falls } = raw;
  return {
    river: river ?? [],
    creek: creek ?? [],
    pond: pond ?? [],
    lookout: lookout ?? [],
    woods: woods ?? [],
    meadow: meadow ?? [],
    peak: peak ?? [],
    falls: falls ?? [],
  };
})();

export function landInput(
  section: Section,
  geo: MapGeometry,
  {
    runSeed,
    sectionIndex,
    cellUnits,
  }: { runSeed: number; sectionIndex: number; cellUnits: number },
): LandInput {
  const tiles = Object.values(section.tiles)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((t) => ({
      id: t.id,
      x: geo.centers[t.id]?.x ?? 0,
      y: geo.centers[t.id]?.y ?? 0,
      scale: geo.scales[t.id] ?? 1,
      kind: t.kind,
      special: t.special,
      nodes: t.nodes.map((n) => n.weather?.was ?? n.type) as NodeKind[],
    }));
  const paths = section.lines.map((l) => ({ id: l.id, kind: l.kind, pts: geo.paths[l.id] ?? [] }));
  return {
    runSeed,
    sectionIndex,
    palette: paletteFor(section.biome),
    tiles,
    paths,
    hexR: HEX.h / 2,
    cellUnits,
  };
}

/**
 * The land is made once per section and kept: nodes that change later (a
 * challenge takes one away, a Planter adds one) don't redraw it. A reload
 * draws it from the nodes as they are then.
 */
const pinned = new Map<string, LandInput>();

export function sectionLandInput(
  section: Section,
  geo: MapGeometry,
  opts: { runSeed: number; sectionIndex: number; cellUnits: number },
): LandInput {
  const id = `${opts.runSeed}:${opts.sectionIndex}:${opts.cellUnits}:${section.trailheadId}:${Object.keys(section.tiles).length}`;
  const hit = pinned.get(id);
  if (hit) return hit;
  const input = landInput(section, geo, opts);
  pinned.clear();
  pinned.set(id, input);
  return input;
}

/** A fingerprint of what the land is built from: a new one means a new land. */
export const landKey = (input: LandInput): string =>
  JSON.stringify([
    input.runSeed,
    input.sectionIndex,
    input.palette,
    input.cellUnits,
    input.tiles.map((t) => [t.id, Math.round(t.x), Math.round(t.y), t.nodes.join('')]),
  ]);
