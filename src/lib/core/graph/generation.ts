// Each Dragon's generation, for layering graphs bottom-up (spec §9).

import type { Dragon } from '../../snapshot';
import type { World } from '../world';

const cache = new WeakMap<World, ReadonlyMap<string, number>>();

/**
 * Every Dragon's generation: 1 when no Route names another Dragon, else 1 +
 * the highest generation among the named parents and Evolved bases of all
 * its Routes. Cycles (the Chrysalis family) are cut first: a depth-first
 * walk in snapshot order drops each need that leads back to a Dragon still
 * being walked, which leaves no cycle, so every other need gets a strictly
 * lower generation. Cached per World.
 */
export function generations(world: World): ReadonlyMap<string, number> {
  let found = cache.get(world);
  if (!found) cache.set(world, (found = compute(world)));
  return found;
}

function compute(world: World): Map<string, number> {
  const known = (dragon: Dragon) => needs(dragon).filter((name) => name !== dragon.name && world.dragons.has(name));

  // 1. The needs that close a cycle, as "dragon>need".
  const cut = new Set<string>();
  const state = new Map<string, 'walking' | 'done'>();
  const walk = (dragon: Dragon): void => {
    state.set(dragon.name, 'walking');
    for (const name of known(dragon)) {
      const seen = state.get(name);
      if (seen === 'walking') cut.add(`${dragon.name}>${name}`);
      else if (seen === undefined) walk(world.dragons.get(name)!);
    }
    state.set(dragon.name, 'done');
  };
  for (const dragon of world.snapshot.dragons) if (!state.has(dragon.name)) walk(dragon);

  // 2. The longest path down to the Elements over the needs left.
  const done = new Map<string, number>();
  const generationOf = (dragon: Dragon): number => {
    const found = done.get(dragon.name);
    if (found !== undefined) return found;
    let generation = 1;
    for (const name of known(dragon)) {
      if (cut.has(`${dragon.name}>${name}`)) continue;
      generation = Math.max(generation, generationOf(world.dragons.get(name)!) + 1);
    }
    done.set(dragon.name, generation);
    return generation;
  };
  for (const dragon of world.snapshot.dragons) generationOf(dragon);
  return done;
}

/** The Dragons a Dragon's Routes name: Bred Routes' parents and Evolved Routes' bases. */
function needs(dragon: Dragon): string[] {
  return dragon.routes.flatMap((route) =>
    route.kind === 'bred' ? (route.requirement.parents ?? []) : route.kind === 'evolved' ? [route.from] : [],
  );
}
