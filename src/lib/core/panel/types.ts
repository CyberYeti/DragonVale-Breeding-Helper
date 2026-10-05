// The click panel's data (spec §9 Click panel): one shape for the popover
// and the side sheet. The popover shows the headline, the reason and the top
// 3 of `pairs` / `suggestions`; the side sheet shows everything, and its
// search is a UI filter over these lists.

import type { Dragon, Route } from '../../snapshot';
import type { RouteStatus } from '../breeding';
import type { Form } from '../collection';
import type { Breeding } from '../world';

/** The Dragon, in a form, the player wants. A Rift dragon is always targeted as itself (`'rift'`). */
export type Target = { readonly dragon: string; readonly form: Form };

/** The graph node that was tapped. */
export type Clicked =
  /** Route pill: the `route`th entry of `dragon.routes`, for `dragon` in `form`. */
  | { readonly kind: 'route'; readonly dragon: string; readonly form: Form; readonly route: number }
  /**
   * Element node. `breeding` is the kind of breeding of the Route it hangs
   * from (Rift for a Rift form or a `rift: "only"` Route); by default the
   * cave's (Rift in the Rift cave, else Normal).
   */
  | { readonly kind: 'element'; readonly element: string; readonly breeding?: Breeding }
  /** Dragon node, in the form it is drawn as. */
  | { readonly kind: 'dragon'; readonly dragon: string; readonly form: Form };

/** How a panel's headline reads. */
export type Tone = 'ok' | 'warn' | 'bad' | 'muted';

/** A Dragon listed in a panel. Tapping it selects its node or makes it the Target in `form`. */
export type Listed = {
  readonly dragon: Dragon;
  /** The form it's listed in: the one that counts here, or the one the player would get. */
  readonly form: Form;
  /** Ownership ticks: one per form the Dragon shows. */
  readonly ticks: readonly { readonly form: Form; readonly owned: boolean }[];
};

/** A Dragon the player doesn't have (in the form that counts) but could get. */
export type Candidate = Listed & {
  /** Breedable now in the cave that makes `form`. */
  readonly breedableNow: boolean;
  readonly available: boolean;
};

/** A Dragon that would make a Valid pair with something owned. */
export type Suggestion = Candidate & {
  /** The simplest owned parent it would pair with. */
  readonly with: Listed;
};

/** Valid pairs that share a parent: `parent` + each of `with`. */
export type PairGroup = { readonly parent: Listed; readonly with: readonly Listed[] };

export type RoutePanel = {
  readonly kind: 'route';
  readonly dragon: Dragon;
  readonly form: Form;
  readonly route: Route;
  readonly status: RouteStatus;
  /** "✔ Met · 1,396 Valid pairs", "No Valid pair yet", "Not met". */
  readonly headline: string;
  readonly tone: Tone;
  /** Why it isn't met (e.g. "Plant Dragon + Metal Dragon are opposites"), or what met it. */
  readonly reason: string | null;
  /**
   * Met Bred or Co-op bred Route: every owned Valid pair, grouped by parent,
   * simplest parent first and simplest partner first. Empty otherwise.
   */
  readonly pairs: readonly PairGroup[];
  /**
   * Bred Route not met: Dragons that would make a Valid pair with something
   * owned. Never the Target or the Route's own Dragon. Breedable now first,
   * then Available, then not Available; then the basic-dragon order.
   */
  readonly suggestions: readonly Suggestion[];
};

export type ElementPanel = {
  readonly kind: 'element';
  readonly element: string;
  readonly breeding: Breeding;
  /** "You own 12 carrying it", "You own nothing that carries it". */
  readonly headline: string;
  readonly tone: Tone;
  /** Owned Dragons carrying it that count as parents here, basic-dragon order. */
  readonly carriers: readonly Listed[];
  /** The Basic dragon among those that can be parents here (owned or not); null when none. */
  readonly basic: Candidate | null;
  /**
   * Every other Dragon that carries it and could be a parent here, not owned
   * in a form that counts and never the Target. Ordered like suggestions.
   */
  readonly alternatives: readonly Candidate[];
};

export type DragonStatus = 'owned' | 'breedable-now' | 'not-breedable';

/** One of a Dragon's Routes, as the Dragon panel summarises it. */
export type RouteSummary = {
  /** Index into `dragon.routes`: pass it back as a `route` Clicked. */
  readonly index: number;
  readonly route: Route;
  readonly status: RouteStatus;
  readonly headline: string;
  readonly tone: Tone;
};

export type DragonPanel = {
  readonly kind: 'dragon';
  readonly dragon: Dragon;
  readonly form: Form;
  readonly isTarget: boolean;
  readonly status: DragonStatus;
  /** "Owned", "Owned (Rift form)", "Breedable now", "Can't breed now". */
  readonly headline: string;
  readonly tone: Tone;
  /** Why it can't be bred now (empty unless `not-breedable`). */
  readonly reasons: readonly string[];
  readonly ticks: Listed['ticks'];
  readonly routes: readonly RouteSummary[];
};

export type PanelData = RoutePanel | ElementPanel | DragonPanel;
