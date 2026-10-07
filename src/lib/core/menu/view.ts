// Search, filters, Owned forms and the owned/total counts (spec §8 Filters and Display).

import type { Dragon, DragonariumPage, Rarity } from '../../snapshot';
import { breedableNow, ownedPerSetting, type Cave, type OwnedForms } from '../breeding';
import { formsOf } from '../collection';
import type { World } from '../world';
import { tabContents } from './contents';
import type {
  Count,
  Filters,
  GroupCount,
  MenuDisplay,
  MenuItem,
  PageGroup,
  Section,
  SidebarCounts,
  View,
} from './types';

/** No filter on: Breedable now off, Show All, no rarity ticked. */
export const NO_FILTERS: Filters = Object.freeze({ breedableNow: false, show: 'all', rarities: new Set<Rarity>() });

/**
 * Whether Owned forms shows `dragon`: Either shows every Dragon, Normal hides
 * Rift dragons, Rift shows only Dragons with a Rift form and Rift dragons.
 */
export function isShown(dragon: Dragon, ownedForms: OwnedForms): boolean {
  return ownedForms === 'either' || formsOf(dragon).includes(ownedForms);
}

/**
 * Applies search, Owned forms and the filters to a tab's sections.
 *
 * - A non-blank `query` searches every Dragon and replaces `sections` with
 *   one `search` section, whatever the tab.
 * - Owned forms hides the Dragons it doesn't show.
 * - Filters: Breedable now (in `cave`), Show All/Owned/Not owned (owned per
 *   Owned forms), Rarity (none ticked = all).
 *
 * `owned`/`total` count each shown Dragon once, after search and Owned forms
 * but before the filters. "Select all shown" takes `shownNames(view.sections)`.
 */
export function applyView(
  sections: readonly Section[],
  query: string,
  filters: Filters,
  display: MenuDisplay,
  world: World,
  cave: Cave,
): View {
  const { ownedForms } = display;
  const q = normalise(query);
  const base: readonly Section[] = q === '' ? sections : [{ kind: 'search', query: query.trim(), items: search(world, q) }];

  const owned = (d: Dragon) => ownedPerSetting(world.collection, d, cave, ownedForms);
  const visible = base.map((s) => withItems(s, s.items.filter((i) => isShown(i.dragon, ownedForms))));
  const count = countOf(visible.flatMap((s) => s.items.map((i) => i.dragon)), owned);

  const breedable = filters.breedableNow ? breedableNow(world, cave) : null;
  const keep = (d: Dragon) =>
    (breedable === null || breedable.has(d.name)) &&
    (filters.show === 'all' || owned(d) === (filters.show === 'owned')) &&
    (filters.rarities.size === 0 || filters.rarities.has(d.rarity));

  return {
    sections: visible.map((s) => withItems(s, s.items.filter((i) => keep(i.dragon)))),
    owned: count.owned,
    total: count.total,
  };
}

/** The names of every Dragon in `sections`, each once, in order: "Select all shown". */
export function shownNames(sections: readonly Section[]): string[] {
  return [...new Set(sections.flatMap((s) => s.items.map((i) => i.dragon.name)))];
}

/**
 * Owned/total for every sidebar entry under Owned forms in `cave`: the four
 * tabs, every Dragonarium page, and each page group (each Dragon once).
 */
export function sidebarCounts(world: World, cave: Cave, display: MenuDisplay): SidebarCounts {
  const { ownedForms } = display;
  const owned = (d: Dragon) => ownedPerSetting(world.collection, d, cave, ownedForms);
  const countDragons = (dragons: Iterable<Dragon>) =>
    countOf([...dragons].filter((d) => isShown(d, ownedForms)), owned);
  const tabCount = (kind: 'all' | 'breedable' | 'limited' | 'event') =>
    countDragons(tabContents(world, { kind }, cave).sections.flatMap((s) => s.items.map((i) => i.dragon)));
  const pageDragons = (page: DragonariumPage) =>
    page.dragons.map((n) => world.dragons.get(n)).filter((d): d is Dragon => d !== undefined);

  const groups: GroupCount[] = GROUPS.map((group) => {
    const pages = world.snapshot.pages.filter((p) => p.group === group);
    return {
      group,
      count: countDragons(pages.flatMap(pageDragons)),
      pages: pages.map((page) => ({ page, count: countDragons(pageDragons(page)) })),
    };
  });

  return { all: tabCount('all'), breedable: tabCount('breedable'), limited: tabCount('limited'), event: tabCount('event'), groups };
}

const GROUPS: readonly PageGroup[] = ['elemental', 'epic', 'special'];

function countOf(dragons: readonly Dragon[], owned: (d: Dragon) => boolean): Count {
  const unique = new Map(dragons.map((d) => [d.name, d]));
  let n = 0;
  for (const d of unique.values()) if (owned(d)) n++;
  return { owned: n, total: unique.size };
}

const withItems = (section: Section, items: readonly MenuItem[]): Section => ({ ...section, items });

const normalise = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Every Dragon whose Name or wiki page title contains `q`, or one of whose
 * displayed Elements starts with it (search covers Elements, spec §8). Exact
 * names first, then names starting with `q`, then other name matches, then
 * Element matches; ties by release order.
 */
function search(world: World, q: string): MenuItem[] {
  const ranked: [number, Dragon][] = [];
  for (const dragon of world.snapshot.dragons) {
    const rank = searchRank(dragon, q);
    if (rank !== null) ranked.push([rank, dragon]);
  }
  ranked.sort(([ra, a], [rb, b]) => ra - rb || a.order - b.order);
  return ranked.map(([, dragon]) => ({ dragon }));
}

function searchRank(dragon: Dragon, q: string): number | null {
  const names = [dragon.name, dragon.wikiPage].map(normalise);
  if (names.includes(q)) return 0;
  if (names.some((n) => n.startsWith(q))) return 1;
  if (names.some((n) => n.includes(q))) return 2;
  if (dragon.elements.some((e) => normalise(e).startsWith(q))) return 3;
  return null;
}
