/**
 * How a path looks on the illustrated map (Phase 10.5, section 7; gen11.py →
 * path_svg), as SVG stroke layers in world pixels:
 *
 * - a soft cream track under every path (wider and stronger under paved);
 * - unwalked: gray, dashed for normal, dotted for steep, muddy and rough,
 *   solid for paved;
 * - walked: the first walker's party color, 15% wider, with a thin dark
 *   outline. A walked normal path turns solid; dotted ones stay dotted, so
 *   their cost still shows; paved stays solid.
 */
import { MAP_STYLE, u } from '../../../config/mapStyle';
import type { LineKind } from '../../../engine';

export interface PathStroke {
  color: string;
  width: number;
  opacity?: number;
  dash?: string;
  cap: 'round' | 'butt';
}

const P = MAP_STYLE.paths;

export const isDotted = (kind: LineKind) =>
  kind === 'steep' || kind === 'muddy' || kind === 'rough';

export function pathStrokes(
  kind: LineKind,
  walker: string | undefined,
  routes = false,
): PathStroke[] {
  const k = u(1);
  if (kind === 'paved') {
    return [
      {
        color: P.track.color,
        opacity: P.pavedTrack.opacity,
        width: P.pavedTrack.width * k,
        cap: 'round',
      },
      ...(walker
        ? [
            {
              color: P.outline.color,
              opacity: 0.45,
              width: (P.pavedWidth + 2.3) * k,
              cap: 'round' as const,
            },
          ]
        : []),
      { color: walker ?? P.gray, width: P.pavedWidth * k, cap: 'round' },
    ];
  }
  const dotted = isDotted(kind);
  const dash = dotted
    ? `0.1 ${(P.dotGap * k).toFixed(1)}`
    : walker
      ? undefined
      : `${(P.dash[0] * k).toFixed(1)} ${(P.dash[1] * k).toFixed(1)}`;
  const width = (dotted ? P.dotWidth : P.width) * k * (walker ? 1 + P.walkedWider : 1);
  const cap = dotted || walker ? 'round' : 'butt';
  return [
    {
      color: P.track.color,
      opacity: routes ? 0.25 : P.track.opacity,
      width: P.track.width * k,
      cap: 'round',
    },
    ...(walker
      ? [
          {
            color: P.outline.color,
            opacity: P.outline.opacity,
            width: width + P.outline.extra * k,
            ...(dash ? { dash } : {}),
            cap,
          } as PathStroke,
        ]
      : []),
    { color: walker ?? P.gray, width, ...(dash ? { dash } : {}), cap },
  ];
}
