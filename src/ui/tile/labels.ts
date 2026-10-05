// Display text and asset URLs for a Dragon tile. Wording only; the rules that
// pick a banner or tick live in core/tile.
import type { Cave } from '../../lib/core/breeding';
import type { Banner, Tick } from '../../lib/core/tile';
import type { Rarity } from '../../lib/snapshot';

const CAVE_NAMES: Record<Cave, string> = { normal: 'Normal', rift: 'Rift', coop: 'Co-op' };

export function caveName(cave: Cave): string {
  return CAVE_NAMES[cave];
}

export function bannerText(banner: Banner): string {
  switch (banner.kind) {
    case 'summoning-only':
      return 'Summoning only';
    case 'evolution-only':
      return 'Evolution only';
    case 'shop-only':
      return 'Shop only';
    case 'not-available':
      return 'Not available';
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

export function tickText(tick: Tick): string {
  return tick.label === 'owned' ? '✔ Owned' : tick.label === 'rift' ? 'Rift' : 'Normal';
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
