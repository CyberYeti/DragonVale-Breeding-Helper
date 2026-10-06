// What a Dragon tile shows (spec §8 Dragon tile, Filters and Display).

import type { Dragon } from '../../snapshot';
import type { Cave, OwnedForms } from '../breeding';
import type { Form } from '../collection';

/** The Display popover's settings. */
export type Display = {
  readonly ownedForms: OwnedForms;
  /** "Show all Dragons in colour": greyscale off. */
  readonly allInColour: boolean;
};

/** The one banner across a tile's art, if any. */
export type Banner =
  /** No cave can breed it: its only Routes are Summoned. */
  | { readonly kind: 'summoning-only' }
  /** No cave can breed it: its only Routes are Evolved (and maybe Purchased). */
  | { readonly kind: 'evolution-only' }
  /** No cave can breed it: its only Route is Purchased (the rift primaries). */
  | { readonly kind: 'shop-only' }
  /** Limited and not Available. */
  | { readonly kind: 'not-available' }
  /** "Not breedable in <cave> cave": the chosen cave can never make it. */
  | { readonly kind: 'not-breedable-in-cave'; readonly cave: Cave }
  /** In a running Event's shop with `Breedable: false`. */
  | { readonly kind: 'purchase-only' };

/** One ownership tick. Toggling it writes the Collection flag `form`. */
export type Tick = {
  /** `normal` / `rift` for a Dragon with both forms; `owned` for a single-form Dragon. */
  readonly label: 'normal' | 'rift' | 'owned';
  /** The flag this tick reads and writes (pass it to core/collection's `toggle`). */
  readonly form: Form;
  readonly owned: boolean;
};

/** Everything `DragonTile` renders, apart from lite mode. */
export type TileView = {
  /** Name, rarity (border colour) and image (null: silhouette) come from here. */
  readonly dragon: Dragon;
  /** Owned in a form that counts under Owned forms (in this cave). */
  readonly owned: boolean;
  /** Art in colour: owned, or "Show all Dragons in colour" is on. Otherwise greyscale. */
  readonly colour: boolean;
  /** Breedable now in the chosen cave: the drifting sheen. */
  readonly sheen: boolean;
  /** At most one; the first that applies (spec §8). */
  readonly banner: Banner | null;
  /** Normal + Rift form ticks, or one Owned tick. */
  readonly ticks: readonly Tick[];
  /** The form the tile opens as (the Focus view's Target form). */
  readonly opensAs: Form;
  /**
   * Owned in the form it opens as. A graph shows the "Owned" banner on a
   * Target with this set (spec §9 rule 8); the menu ignores it.
   */
  readonly ownedBanner: boolean;
};
