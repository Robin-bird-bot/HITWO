/**
 * What the shopkeeper says (docs/BUILD_PLAN.md Phase 9, "Shopkeeper dialogue"):
 * a greeting, "What's selling?" (this visit's market as ×2 and ×½ chips) and
 * "What's ahead?" (the next biome's tier, its common nodes from the trail
 * already made, and placeholder weather and line chips).
 */
import { ASSETS } from '../../config/assets';
import { BIOME_AHEAD, STATION_THEME_BY_ID, type AheadChip } from '../../content/stations';
import { RESOURCES } from '../../content/resources';
import type { GameState, NodeType } from '../../engine';
import { NODE_NAME } from '../map/looks';

export type Talk = 'greet' | 'selling' | 'ahead';

export interface TalkChip {
  key: string;
  text: string;
  tone: 'info' | 'good' | 'bad';
  /** A resource's picture, or an icon name. */
  img?: string;
  icon?: AheadChip['icon'] | 'star' | 'sprout';
  label: string;
}

const NUMERAL = ['', 'I', 'II', 'III', 'IV'];
const resName = (id: string) => RESOURCES.find((r) => r.id === id)?.name ?? id;

/** The shopkeeper's line for this talk. Greetings take turns by checkpoint. */
export function talkLine(state: GameState, talk: Talk): string {
  const station = state.station;
  if (!station) return '';
  const lines = STATION_THEME_BY_ID[station.themeId].lines;
  if (talk === 'selling') return lines.selling;
  if (talk === 'ahead') return lines.ahead;
  return lines.greet[(station.checkpoint - 1) % lines.greet.length] ?? '';
}

/** "What's selling?": ×2 for this visit's high resources, ×½ for its low ones. */
export function marketChips(state: GameState): TalkChip[] {
  const market = state.station?.market;
  if (!market) return [];
  const chip = (id: string, tone: 'good' | 'bad'): TalkChip => ({
    key: `${tone}-${id}`,
    img: ASSETS.resources[id],
    text: tone === 'good' ? '×2' : '×½',
    tone,
    label: `${resName(id)} sells for ${tone === 'good' ? 'double' : 'half'}`,
  });
  return [...market.high.map((id) => chip(id, 'good')), ...market.low.map((id) => chip(id, 'bad'))];
}

/** "What's ahead?": the next section's tier and two most common nodes, then the biome's chips. */
export function aheadChips(state: GameState): TalkChip[] {
  const next = state.station?.next;
  if (!next) return [];
  const counts = new Map<NodeType, number>();
  for (const t of Object.values(next.tiles)) {
    for (const n of t.nodes) {
      if (n.type !== 'caps') counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
    }
  }
  const common = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([node]) => NODE_NAME[node].toUpperCase());
  const chips: TalkChip[] = [
    {
      key: 'tier',
      icon: 'star',
      text: `TIER ${NUMERAL[next.tier] ?? next.tier}`,
      tone: 'info',
      label: `Tier ${next.tier}`,
    },
  ];
  if (common.length) {
    chips.push({
      key: 'nodes',
      icon: 'sprout',
      text: `${common.join(' + ')} COMMON`,
      tone: 'good',
      label: `${common.join(' and ')} nodes are common`,
    });
  }
  for (const [i, c] of BIOME_AHEAD[next.biome].chips.entries()) {
    chips.push({ key: `biome-${i}`, icon: c.icon, text: c.text, tone: c.tone, label: c.text });
  }
  return chips;
}
