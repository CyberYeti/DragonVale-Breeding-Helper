// Wording for the menu grid's sections: headings and empty states. The
// Limited rotation and Event tabs (ticket #44) extend these and add tile
// notes ("ends in N days", shop costs) through MenuTile's `note`.

import type { Filters, Section } from '../../lib/core/menu';

/** A section's heading, or null for none. A tab with one section needs none; the page header names it. */
export function sectionHeading(section: Section, count: number): string | null {
  if (count < 2) return null;
  switch (section.kind) {
    case 'page':
      return section.page.name;
    case 'event':
      return section.event.name;
    case 'breedable':
      return 'Breedable now';
    case 'rotation':
      return 'Limited rotation';
    case 'search':
      return `Search: “${section.query}”`;
  }
}

/** Whether any filter is on (Breedable now, Show other than All, a ticked rarity). */
export function filtersOn(filters: Filters): boolean {
  return filters.breedableNow || filters.show !== 'all' || filters.rarities.size > 0;
}

/** What an empty section says. `hiddenByFilters`: filters are on, so they may be what emptied it. */
export function emptyText(section: Section, hiddenByFilters: boolean, caveTitle: string): string {
  if (hiddenByFilters) return 'Nothing here matches the filters.';
  switch (section.kind) {
    case 'search':
      return 'No Dragon matches that search.';
    case 'breedable':
      return `Nothing is Breedable now in the ${caveTitle} cave.`;
    case 'rotation':
      return 'Nothing is in the Limited rotation right now.';
    case 'event':
      return 'This Event has no Dragons to show.';
    case 'page':
      return 'Nothing here with this Owned forms setting.';
  }
}
