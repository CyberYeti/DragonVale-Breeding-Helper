// The World: everything the breeding rules read, precomputed once per change
// of snapshot, Collection, overlay or day (spec §§5–6). The Breeding cave and
// Owned forms are not in it; they are passed per call.

import type { Dragon, Snapshot } from '../../snapshot';
import type { Collection } from '../collection';
import type { Overlay } from '../limited';

/** The kind of breeding: Normal (Normal and Co-op caves) or Rift (Rift cave). */
export type Breeding = 'normal' | 'rift';

/** The owned Dragons that count as parents for one kind of breeding. */
export type ParentSet = {
  /** In snapshot order. */
  readonly dragons: readonly Dragon[];
  readonly names: ReadonlySet<string>;
};

/** Immutable. Build a new one with `buildWorld` whenever an input changes. */
export type World = {
  readonly snapshot: Snapshot;
  readonly collection: Collection;
  readonly overlay: Overlay;
  /** The time Available was worked out for. */
  readonly now: Date;
  /** Every snapshot Dragon by Name. */
  readonly dragons: ReadonlyMap<string, Dragon>;
  /**
   * Element → the Dragons whose `breedingElements` carry it, fewest
   * `breedingElements` first, ties to the lowest `order`. So the first one is
   * the Element's Basic dragon. Elements no Dragon carries are absent.
   */
  readonly carriers: ReadonlyMap<string, readonly Dragon[]>;
  /**
   * Which owned Dragons count as parents (spec §6), per kind of breeding.
   * Normal: owned in any form. Rift: owned Rift forms and owned Rift dragons.
   * Never a Dragon with `canBeParent: false`, never an orphan.
   */
  readonly parents: Readonly<Record<Breeding, ParentSet>>;
  /**
   * Names of the Dragons that are Available at `now`: every Dragon that isn't
   * limited, plus limited ones in the Limited rotation or a running Event's shop.
   */
  readonly available: ReadonlySet<string>;
  /** Names of the Dragons that are Purchase only: in a running Event's shop with `Breedable: false`. */
  readonly purchaseOnly: ReadonlySet<string>;
};
