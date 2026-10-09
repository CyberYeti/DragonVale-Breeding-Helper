// Wording for the Filters popover and the chips row (spec §8 Filters and
// Display). The filtering itself is core/menu's applyView.
import type { ElementMatch, Filters, Show } from '../../lib/core/menu';
import type { ElementKind, Rarity, Snapshot } from '../../lib/snapshot';
import { assetUrl } from '../tile/labels';

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

/** The number on the Filters button: one per filter that is on, one per ticked rarity or Element. */
export function filterCount(filters: Filters): number {
  return (
    (filters.breedableNow ? 1 : 0) + (filters.show !== 'all' ? 1 : 0) + filters.rarities.size + filters.elements.size
  );
}

/** An Element the Element filter offers: its name and icon URL (null = no icon). */
export type ElementChoice = { readonly name: string; readonly icon: string | null };

/** Element kinds the filter leaves out: each has only a Dragon or three (Time, Nest, Vault, Mythic). */
const UNFILTERED_KINDS: ReadonlySet<ElementKind> = new Set(['legendary', 'mythic']);

/**
 * The Element filter's choices: the Elements some Dragon displays, but not
 * the Legendary or Mythic ones, in the snapshot's (Data:Game.json) order.
 */
export function elementChoices(snapshot: Pick<Snapshot, 'elements' | 'dragons'>): ElementChoice[] {
  const displayed = new Set(snapshot.dragons.flatMap((d) => d.elements));
  return snapshot.elements
    .filter((e) => displayed.has(e.name) && !UNFILTERED_KINDS.has(e.kind))
    .map((e) => ({ name: e.name, icon: e.icon ? assetUrl(e.icon) : null }));
}

const ELEMENT_MATCH_LABELS: Record<ElementMatch, string> = { exact: 'Match exact', contains: 'Any containing' };

/** The Element switch's side: "Match exact" or "Any containing". */
export function elementMatchLabel(match: ElementMatch): string {
  return ELEMENT_MATCH_LABELS[match];
}

/** `filters` with `element` ticked or unticked. */
export function toggleElement(filters: Filters, element: string): Filters {
  const elements = new Set(filters.elements);
  if (!elements.delete(element)) elements.add(element);
  return { ...filters, elements };
}

/** `filters` with `rarity` ticked or unticked. */
export function toggleRarity(filters: Filters, rarity: Rarity): Filters {
  const rarities = new Set(filters.rarities);
  if (!rarities.delete(rarity)) rarities.add(rarity);
  return { ...filters, rarities };
}
