// Display text and asset URLs for a Dragon tile. Wording only; the rules that
// pick a banner or tick live in core/tile.
import { caveName, noBreedingText, NOT_AVAILABLE } from '../../lib/core/breeding';
import type { Banner, Tick } from '../../lib/core/tile';
import type { Dragon, Rarity, Snapshot } from '../../lib/snapshot';

export function bannerText(banner: Banner): string {
  switch (banner.kind) {
    case 'summoning-only':
    case 'evolution-only':
    case 'shop-only':
      return noBreedingText(banner.kind);
    case 'not-available':
      return NOT_AVAILABLE;
    case 'not-breedable-in-cave':
      return `Not breedable in ${caveName(banner.cave)} cave`;
    case 'purchase-only':
      return 'Purchase only';
  }
}

/** Banners that say the Dragon can't come from this cave right now get the red strip. */
export function bannerBlocks(banner: Banner): boolean {
  return banner.kind !== 'purchase-only';
}

/** The tick's name, the same whether it is on or off (its accessible label). */
export function tickName(tick: Tick): string {
  return tick.label === 'owned' ? 'Owned' : tick.label === 'rift' ? 'Rift' : 'Normal';
}

/** The tick's visible text: the Owned tick shows ✔ only while it is on. */
export function tickText(tick: Tick): string {
  return tick.label === 'owned' && tick.owned ? '✔ Owned' : tickName(tick);
}

/** The CSS custom property holding a rarity's colour (src/ui/theme.css), e.g. for the Filters symbols. */
export function rarityColour(rarity: Rarity): string {
  return `var(--rarity-${rarity.toLowerCase()})`;
}

/**
 * A tile's border colour. DragonVale draws no outline round Hybrids, so
 * theirs is transparent: the border keeps its width and tiles keep one size.
 */
export function rarityBorder(rarity: Rarity): string {
  return rarity === 'Hybrid' ? 'transparent' : rarityColour(rarity);
}

/** The far-zoom square's fill: the border colour, or a neutral grey for borderless Hybrids. */
export function rarityFill(rarity: Rarity): string {
  return rarity === 'Hybrid' ? 'var(--muted)' : rarityColour(rarity);
}

/** The Rift Element's icon URL for a Rift Dragon (its Elements include Rift), else null. */
export function riftIcon(snapshot: Pick<Snapshot, 'elements'>, dragon: Pick<Dragon, 'elements'>): string | null {
  if (!dragon.elements.includes('Rift')) return null;
  const icon = snapshot.elements.find((e) => e.name === 'Rift')?.icon;
  return icon ? assetUrl(icon) : null;
}

/** A displayed Element's name and icon URL, for the row on a tile's art. */
export type ElementIcon = { readonly name: string; readonly icon: string };

/**
 * The icons of the Elements `dragon` displays, in its own order. Rift is left
 * out (the Rift icon badge shows it), and so is any Element without an icon.
 */
export function elementIcons(snapshot: Pick<Snapshot, 'elements'>, dragon: Pick<Dragon, 'elements'>): ElementIcon[] {
  return dragon.elements.flatMap((name) => {
    if (name === 'Rift') return [];
    const icon = snapshot.elements.find((e) => e.name === name)?.icon;
    return icon ? [{ name, icon: assetUrl(icon) }] : [];
  });
}

/**
 * A snapshot image path (relative, under public/) as a URL that works under
 * Vite's `base`. Paths that already carry a scheme (data:, https:) pass through.
 */
export function assetUrl(path: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(path) ? path : import.meta.env.BASE_URL + path.replace(/^\/+/, '');
}
