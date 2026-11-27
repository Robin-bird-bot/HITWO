/** The packing screen's shared words. */
import { BALANCE } from '../../config/balance';
import { picksFor, type PackType, type PackingState } from '../../packing/logic';

const P = BALANCE.packing;

export const TYPE_LABEL: Readonly<Record<PackType, string>> = {
  tool: 'TOOL',
  food: 'FOOD',
  clothes: 'CLOTHES',
  shelter: 'SHELTER',
};

/** The plate's words: what's still owed. */
export function owedWords(state: PackingState): { big: string; small: string } {
  const n = state.seats.length;
  if (state.step === 'items') {
    return {
      big: state.picksLeft > 0 ? `TAKE ${state.picksLeft} MORE` : 'ALL PACKED',
      small: `${P.picks.base} + ${P.picks.perHiker} PER HIKER = ${picksFor(n)} ITEMS`,
    };
  }
  if (state.step === 'resources') {
    const all = state.packs.every((p) => p.bundles.length >= P.bundlesEach);
    const left = P.bundlesEach - (state.packs[state.turn]?.bundles.length ?? 0);
    return {
      big: all ? 'ALL SET' : `TAKE ${Math.max(0, left)} MORE`,
      small: `${state.seats[state.turn]?.name.toUpperCase() ?? ''} · BUNDLES GO HERE`,
    };
  }
  return { big: 'READY', small: 'HAPPY TRAILS' };
}
