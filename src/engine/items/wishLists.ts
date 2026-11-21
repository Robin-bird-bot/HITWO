/**
 * Gift Wrapper's two wish lists (07-characters.md, Grammy Clause): each a
 * random list of specific resources, repeats allowed, from all 16. Rolled at
 * the start of the run, after every Present she wraps, and by Checking It Twice.
 */
import { BALANCE } from '../../config/balance';
import { RESOURCES } from '../../content/resources';
import { pick } from '../rng';
import type { RngState, WishLists } from '../types';

export function rollWishLists(rng: RngState): WishLists {
  const draw = (n: number) => Array.from({ length: n }, () => pick(rng, RESOURCES).id);
  return {
    small: draw(BALANCE.presents.smallWishList),
    big: draw(BALANCE.presents.bigWishList),
  };
}
