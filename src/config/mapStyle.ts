/**
 * The illustrated map's numbers (Phase 10.5; docs/UPDATE-2026-11-21-phase-10.5-illustrated-map.md).
 * Every [bracketed] number in the update is a first guess: TODO(wyatt).
 *
 * The update writes them in the prototype's units, where rows are 134 apart
 * (docs/design/illustrated-map/reference/). Our rows are 152 stage pixels
 * apart (Classic's ROW_STEP), so `u(n)` turns a prototype number into ours.
 */

/** Prototype units to our world pixels: Classic's rows (152) over the prototype's (134). */
export const UNIT = 152 / 134;
export const u = (n: number): number => n * UNIT;

export const MAP_STYLE = {
  /** Settings → Map style, per device. TODO(wyatt): [first guess] Illustrated by default. */
  defaultStyle: 'illustrated' as 'classic' | 'illustrated',

  /** Tiles moved a little off the grid. TODO(wyatt): ±[24] x, ±[16] y, size ×[0.90–1.07]. */
  jitter: { x: 24, y: 16, scaleMin: 0.9, scaleMax: 1.07 },

  /**
   * Winding paths (`wind()` in topo_layout.py): a1 = [0.5–1] × amp, a2 =
   * [0.2–0.6] × amp; amp [24] between rows and [16] within one. TODO(wyatt).
   */
  wind: { a1: [0.5, 1], a2: [0.2, 0.6], ampBetweenRows: 24, ampInRow: 16, samples: 40 },

  land: {
    /** The land reaches this far past the trail tree on every side. TODO(wyatt): [300]. */
    margin: 300,
    /**
     * World pixels per field cell. The update asks for 1 cell per prototype
     * unit (2 on phones); see `cellFor`. Raised if a laptop misses the budget.
     */
    cell: 1,
    phoneCell: 2,
    /** fbm noise scales. TODO(wyatt): [260], [90], [30]. */
    noise: [260, 90, 30],
    /** Light cut into 4 flat tones at these quantiles. TODO(wyatt): [12%, 42%, 84%]. */
    toneQuantiles: [0.12, 0.42, 0.84],
    /** Higher land tinted toward the haze color. TODO(wyatt): [10%]. */
    haze: 0.1,
    /** Contour levels, every 5th heavier, at this opacity. TODO(wyatt): about [26], [30%]. */
    contours: 26,
    contourEvery: 5,
    contourAlpha: 0.3,
    /**
     * Tree crowns: this share are conifers. TODO(wyatt): [42%]. The autumn
     * share ([16%] for the Meadow) is each biome's `autumnShare` in
     * public/assets/map/palettes.json.
     */
    conifers: 0.42,
    /** The sketch's tree symbols, of all the trees. TODO(wyatt): about [28%]. */
    sketchTrees: 0.28,
  },

  /** Stamps scattered on the painted land (public/assets/map/stamps/). TODO(wyatt): all bracketed. */
  stamps: {
    /** Side-on trees and bushes along forest edges: one per this many units of edge. */
    edgeEvery: 40,
    /** Trees and peaks about this tall; small things this tall. */
    tall: 26,
    small: 14,
    /** Deer in the largest meadow. */
    deer: [1, 2] as const,
    /** A waterfall where the river drops more than this over 40 units. */
    waterfallDrop: 0.12,
    waterfallOver: 40,
  },

  /** Painted as you explore. TODO(wyatt): radius [150], fade [70], pooling [16%], [1.2 s]. */
  reveal: { radius: 150, fade: 70, rim: 0.16, growSeconds: 1.2 },

  /** Paths (gen11.py → path_svg). TODO(wyatt): every bracketed number. */
  paths: {
    track: { color: '#F4EDDA', opacity: 0.42, width: 8 },
    pavedTrack: { opacity: 0.8, width: 10 },
    gray: '#77736A',
    dash: [10, 7] as const,
    width: 3.6,
    pavedWidth: 4.2,
    dotGap: 8.5,
    dotWidth: 5.6,
    walkedWider: 0.15,
    outline: { color: '#1D2220', opacity: 0.5, extra: 2.6 },
  },

  /** Tiles, the dark glass look (gen11.py → tile_svg). TODO(wyatt): the bracketed numbers. */
  tiles: {
    fill: '#0F1A16',
    opacity: 0.5,
    visitedOpacity: 0.36,
    edge: '#F7F1E4',
    edgeWidth: 2.2,
    paper: '#EEE5CB',
    paperOpacity: 0.45,
    pencil: '#5E5648',
  },

  /** Place names. TODO(wyatt): sizes [14–17] px; woods over [6] tiles' area, meadows over [4]. */
  labels: {
    sizeMin: 14,
    sizeMax: 17,
    water: '#1F5E6E',
    high: '#5A3F66',
    land: '#2A4A3A',
    halo: '#F4EDDA',
    woodsTiles: 6,
    meadowTiles: 4,
  },

  /** Generation time. TODO(wyatt): under [1.5 s] on a laptop; Classic after [6 s]. */
  budget: { seconds: 1.5, giveUpSeconds: 6 },

  /** Night and weather grades on the land (section 9). TODO(wyatt): the bracketed numbers. */
  grade: {
    night: {
      lum: [0.36, 0.44, 0.72],
      lumScale: 0.8,
      rgb: [0.22, 0.3, 0.42],
      add: [0.03, 0.04, 0.11],
    },
    glow: { color: [0.55, 0.32, 0.12], radius: 60 },
    rain: { color: 0.78, gray: 0.22, tint: [0.9, 0.95, 1.02], darken: 0.04 },
    storm: { darken: 0.1 },
    snow: { above: 0.45, ramp: 0.2 },
    heat: { color: [1.06, 0.98, 0.86], add: [0.04, 0.02, 0] },
  },

  /** The route view (section 11). TODO(wyatt): tiles [25%] fill and [35%] edge, unwalked [25%]. */
  routes: { tileFill: 0.25, tileEdge: 0.35, unwalked: 0.25 },
};

/** The field cell size for this device: coarser on phones. */
export const cellFor = (phone: boolean): number =>
  phone ? MAP_STYLE.land.phoneCell : MAP_STYLE.land.cell;
