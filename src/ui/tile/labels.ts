// Display text and asset URLs for a Dragon tile. Wording only; the rules that
// pick a banner or tick live in core/tile.
import { caveName, noBreedingText, NOT_AVAILABLE } from '../../lib/core/breeding';
import type { Banner, Tick } from '../../lib/core/tile';
import type { Rarity } from '../../lib/snapshot';

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

/** The CSS custom property holding a rarity's border colour (src/ui/theme.css). */
export function rarityColour(rarity: Rarity): string {
  return `var(--rarity-${rarity.toLowerCase()})`;
}

/**
 * A snapshot image path (relative, under public/) as a URL that works under
 * Vite's `base`. Paths that already carry a scheme (data:, https:) pass through.
 */
export function assetUrl(path: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(path) ? path : import.meta.env.BASE_URL + path.replace(/^\/+/, '');
}
