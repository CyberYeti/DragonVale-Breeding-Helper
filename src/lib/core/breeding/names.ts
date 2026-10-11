// Names and phrases the tile, graph and click panel share, so every view
// words them the same (spec §8 spellings). Wording only; no rules.

import type { RouteKind } from '../../snapshot';
import type { World } from '../world';
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

/**
 * A `self-or-opposite-hybrid` Route in words: "Breeds only from Fire + Fire
 * or a Fire/Cold hybrid". `parent` is the named parent; `name` spells a
 * Dragon (the bare name by default, or e.g. its wiki page).
 */
export function partnerText(world: World, parent: string, name: (dragon: string) => string = (n) => n): string {
  const own = (world.dragons.get(parent)?.elements ?? []).filter((e) => e !== 'Rift');
  const pair = own.length === 1 ? world.snapshot.opposites.find((p) => p.includes(own[0]!)) : undefined;
  const hybrid = pair ? `a ${own[0]}/${pair[0] === own[0] ? pair[1] : pair[0]} hybrid` : 'an opposite hybrid';
  return `Breeds only from ${name(parent)} + ${name(parent)} or ${hybrid}`;
}
