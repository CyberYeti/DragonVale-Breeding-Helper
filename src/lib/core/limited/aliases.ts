// Shared names for staged Dragons. The wiki keeps each stage of some Dragons
// as its own Dragon ("Dracomancy 1" … "Dracomancy 4", one wiki page), while
// Data:Limited.json may list the shared name ("Dracomancy"). That name stands
// for the first stage, the one the others evolve from: the shop sells that
// one, and the later stages are reached by evolving it.

import type { Dragon } from '../../snapshot';

/**
 * Shared name -> Dragon, for every wiki page that holds several Dragons of
 * which exactly one isn't Evolved from another on the page. The shared name
 * is the page title without its " Dragon" ("Dracomancy"). Pages whose
 * Dragons are all bred alike (Snowflake 1-7) have no single first stage, so
 * their shared name stays unmatched. A shared name that is also a Dragon's
 * own name is left out.
 */
export function stageAliases(dragons: readonly Pick<Dragon, 'name' | 'wikiPage' | 'routes'>[]): Map<string, string> {
  const byPage = new Map<string, Pick<Dragon, 'name' | 'routes'>[]>();
  for (const dragon of dragons) byPage.set(dragon.wikiPage, [...(byPage.get(dragon.wikiPage) ?? []), dragon]);

  const names = new Set(dragons.map((d) => d.name));
  const aliases = new Map<string, string>();
  for (const [page, stages] of byPage) {
    if (stages.length < 2) continue;
    const onPage = new Set(stages.map((d) => d.name));
    const first = stages.filter((d) => !d.routes.some((r) => r.kind === 'evolved' && onPage.has(r.from)));
    const shared = page.replace(/ Dragon$/, '');
    if (first.length === 1 && !names.has(shared)) aliases.set(shared, first[0]!.name);
  }
  return aliases;
}
