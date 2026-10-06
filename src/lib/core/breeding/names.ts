// Names and phrases the tile, graph and click panel share, so every view
// words them the same (spec §8 spellings). Wording only; no rules.

import type { RouteKind } from '../../snapshot';
import type { Cave, NoBreeding } from './types';

const CAVE_NAMES: Record<Cave, string> = { normal: 'Normal', rift: 'Rift', coop: 'Co-op' };

/** "Normal", "Rift", "Co-op". */
export const caveName = (cave: Cave): string => CAVE_NAMES[cave];

const ROUTE_KIND_NAMES: Record<RouteKind, string> = {
  bred: 'Bred',
  coop: 'Co-op bred',
  evolved: 'Evolved',
  summoned: 'Summoned',
  purchased: 'Purchased',
};

/** "Bred", "Co-op bred", "Evolved", "Summoned", "Purchased". */
export const routeKindName = (kind: RouteKind): string => ROUTE_KIND_NAMES[kind];

const NO_BREEDING_TEXT: Record<NoBreeding, string> = {
  'summoning-only': 'Summoning only',
  'evolution-only': 'Evolution only',
  'shop-only': 'Shop only',
};

/** "Summoning only", "Evolution only", "Shop only". */
export const noBreedingText = (only: NoBreeding): string => NO_BREEDING_TEXT[only];

/** A limited Dragon that isn't Available. */
export const NOT_AVAILABLE = 'Not available';
