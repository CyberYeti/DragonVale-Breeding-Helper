// The breeding rules' public types (spec §6).

import type { Dragon } from '../../snapshot';

/** The Breeding cave the player is breeding in. */
export type Cave = 'normal' | 'rift' | 'coop';

/**
 * The Owned forms display setting: which owned forms count. Either counts
 * either form, except in the Rift cave, where it counts the Rift form.
 * Display only: it never changes what is breedable (see `ownedPerSetting`).
 */
export type OwnedForms = 'either' | 'normal' | 'rift';

/**
 * Two parents. Unordered, except that a named parent comes first (for a
 * one-name Requirement) and a Co-op bred Route's friend's Dragon comes first.
 * Both can be the same Dragon: the Collection has no counts.
 */
export type Pair = readonly [Dragon, Dragon];

/** Why a Route is or isn't met. Checked in this order; the first that applies wins. */
export type RouteReason =
  /** A Valid pair (or, for Co-op bred, an owned parent; for Evolved, the owned base) exists. */
  | { readonly kind: 'met' }
  /** Summoned and Purchased Routes are never met by the Collection. */
  | { readonly kind: 'not-bred' }
  /** A Co-op bred Route makes only normal forms; it was asked about a Rift form. */
  | { readonly kind: 'normal-form-only' }
  /** No owned Dragon counts as a parent for this kind of breeding. */
  | { readonly kind: 'no-parents' }
  /**
   * Named Dragons that aren't among the parents that count: not owned, owned
   * only in a form that doesn't count, or unable to be parents. For an Evolved
   * Route, its base Dragon not owned in the right form.
   */
  | { readonly kind: 'missing-parents'; readonly dragons: readonly string[] }
  /** Required Elements (including `elementOnBothParents`) no parent that counts carries. */
  | { readonly kind: 'missing-elements'; readonly elements: readonly string[] }
  /** Every parent that counts, pooled together, has fewer than `minDistinctElements`. */
  | { readonly kind: 'too-few-elements'; readonly needed: number }
  /** The only pairs that would meet it are opposite primaries, such as Plant + Metal. */
  | { readonly kind: 'opposites'; readonly pair: readonly [string, string] }
  /** Everything is covered by some parent, but no two parents meet it together. */
  | { readonly kind: 'no-valid-pair' };

export type RouteStatus = {
  readonly met: boolean;
  /**
   * How many ways the Route can be met now. Bred: the number of Valid pairs.
   * Co-op bred: the number of owned parents the friend's Dragon could pair
   * with. Evolved: 1 when the base Dragon is owned. Otherwise 0.
   */
  readonly pairCount: number;
  readonly reason: RouteReason;
};
