// Wording for the Filters popover and the chips row (spec §8 Filters and
// Display). The filtering itself is core/menu's applyView.
import type { Filters, Show } from '../../lib/core/menu';
import type { Rarity } from '../../lib/snapshot';

/** Every rarity, in the wiki's order. */
export const RARITIES: readonly Rarity[] = [
  'Primary',
  'Hybrid',
  'Rare',
  'Epic',
  'Galaxy',
  'Gemstone',
  'Legendary',
  'Mythic',
];

const RARITY_SYMBOLS: Record<Rarity, string> = {
  Primary: '◖',
  Hybrid: '◓',
  Rare: '◼',
  Epic: '🟐',
  Galaxy: '🟊',
  Gemstone: '◆',
  Legendary: '▲',
  Mythic: '▮',
};

/** The wiki's symbol for a rarity. */
export function raritySymbol(rarity: Rarity): string {
  return RARITY_SYMBOLS[rarity];
}

export const SHOWS: readonly Show[] = ['all', 'owned', 'not-owned'];

const SHOW_LABELS: Record<Show, string> = { all: 'All', owned: 'Owned', 'not-owned': 'Not owned' };

export function showLabel(show: Show): string {
  return SHOW_LABELS[show];
}

/** The number on the Filters button: one per filter that is on, one per ticked rarity. */
export function filterCount(filters: Filters): number {
  return (filters.breedableNow ? 1 : 0) + (filters.show !== 'all' ? 1 : 0) + filters.rarities.size;
}

/** `filters` with `rarity` ticked or unticked. */
export function toggleRarity(filters: Filters, rarity: Rarity): Filters {
  const rarities = new Set(filters.rarities);
  if (!rarities.delete(rarity)) rarities.add(rarity);
  return { ...filters, rarities };
}
