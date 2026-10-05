// The library-free graph model every graph view draws (spec §9). It names
// Dragons, Elements and Routes; it knows nothing about positions, Svelte
// Flow or how a tile looks. core/layout places it, ui/graph draws it.

import type { RouteKind } from '../../snapshot';
import type { Cave } from '../breeding';
import type { Breeding, World } from '../world';
import type { Form } from '../collection';

/** A Dragon in a given form: what the player wants to obtain. */
export type Target = { readonly dragon: string; readonly form: Form };

/**
 * How a node or edge is drawn, besides its kind:
 * - `normal`: plain.
 * - `met`: a met Route, and the edges into and out of its pill.
 * - `dimmed`: a Route that needs a missing limited parent that isn't
 *   Available (rule 6), or a Target that isn't Available (rule 7).
 * - `locked`: a Purchase only Route (🔒), or a missing limited parent that
 *   isn't Available (the Dragon a dimmed Route waits on).
 */
export type GraphState = 'normal' | 'met' | 'dimmed' | 'locked';

/** Stable ids, unique within one model. */
export type NodeId = string;

/**
 * Set only by `pullTree`: `lit` for the pulled tree (the Target's Focus path),
 * `faded` for the rest of the tab graph behind it. Unset in a Focus view or a
 * plain tab graph.
 */
export type Pull = 'lit' | 'faded';

// ---- Nodes ------------------------------------------------------------------

type NodeBase = {
  readonly id: NodeId;
  readonly state: GraphState;
  readonly badges: readonly Badge[];
  readonly pull?: Pull;
};

/** A Dragon tile. The UI asks core/tile how it looks; this says why it's here. */
export type DragonNode = NodeBase & {
  readonly kind: 'dragon';
  readonly dragon: string;
  /** The form this node stands for. A single-form Dragon is always its one form. */
  readonly form: Form;
  /**
   * Owned in the way that ends the branch here. The Target: owned in its
   * form. A named parent: among the parents that count for its Route's kind
   * of breeding (Normal breeding: either form). An Evolved Route's base:
   * owned in that form. Not the tile's colour, which follows Owned forms.
   */
  readonly owned: boolean;
  /** Whether this Dragon's Routes are drawn below it. */
  readonly expanded: boolean;
  /**
   * For layering, bottom-up: 1 for a Dragon none of whose Routes names
   * another Dragon, else 1 + the highest generation among the named parents
   * and Evolved bases of all its Routes (Elements are 0). Worked out from the
   * snapshot, so it's the same in every view, cave and Collection. Cycles
   * (the Chrysalis family) are cut where a walk in snapshot order first
   * closes them, so only an edge that closes a cycle can point from a higher
   * or equal generation.
   */
  readonly generation: number;
  /**
   * A tab graph's named parent (or Evolved base) from outside the tab, drawn
   * smaller. Always false in a Focus view.
   */
  readonly outside: boolean;
};

/** An Element hub, a leaf. Shared by every Route in the model that needs it for the same kind of breeding. */
export type ElementNode = NodeBase & {
  readonly kind: 'element';
  readonly element: string;
  /** Which parents `covered` was worked out for. */
  readonly breeding: Breeding;
  /** Some parent that counts carries it. Display only: it never decides where a view stops. */
  readonly covered: boolean;
};

/** A Route pill (◆) joining a Dragon to what one of its Routes needs. */
export type RouteNode = NodeBase & {
  readonly kind: 'route';
  /** The Dragon node this Route makes. */
  readonly owner: NodeId;
  readonly dragon: string;
  readonly form: Form;
  /** Index into the Dragon's `routes`. */
  readonly routeIndex: number;
  readonly routeKind: Extract<RouteKind, 'bred' | 'coop' | 'evolved'>;
  /** routeStatus's `met`, for this Dragon in this form. */
  readonly met: boolean;
};

/** A requirement drawn as one node: "Any 4+ elements" or "Any pair". One per Route. */
export type RuleNode = NodeBase & {
  readonly kind: 'rule';
  readonly rule: 'minDistinctElements' | 'anyPair';
  readonly label: string;
};

/** "<Dragon> (friend's)": a Co-op bred Route's friend's Dragon. Never checked or expanded. */
export type FriendNode = NodeBase & {
  readonly kind: 'friend';
  readonly dragon: string;
  readonly label: string;
};

export type GraphNode = DragonNode | ElementNode | RouteNode | RuleNode | FriendNode;
export type GraphNodeKind = GraphNode['kind'];

// ---- Edges ------------------------------------------------------------------

/**
 * Every edge points up: from what is needed to what it makes.
 * - `requirement`: an Element, rule node or named parent into a Route pill.
 * - `evolves-from`: the base Dragon into an Evolved Route's pill.
 * - `coop-only`: the friend's node into a Co-op bred Route's pill.
 * - `route`: a Route pill into the Dragon it makes.
 */
export type GraphEdgeKind = 'requirement' | 'evolves-from' | 'coop-only' | 'route';

export type GraphEdge = {
  readonly id: string;
  readonly kind: GraphEdgeKind;
  readonly source: NodeId;
  readonly target: NodeId;
  /** The Route pill this edge belongs to (its in-edges and its out-edge). */
  readonly route: NodeId;
  readonly state: GraphState;
  readonly badges: readonly Badge[];
  readonly pull?: Pull;
};

// ---- Badges -----------------------------------------------------------------

/**
 * Something drawn on an edge label or a node. `label` is the text to show;
 * `kind` (and the data with it) is for styling and tests.
 *
 * On a Route's out-edge (pill → Dragon): purchase-only, not-available,
 * no-valid-pair, condition, other-cave. On an in-edge: both-parents,
 * decoration (evolves-from), any-dragon (coop-only). On a Dragon node:
 * owned, purchased, summoned, dead-end, cannot-be-parent.
 */
export type Badge = { readonly label: string } & (
  | { readonly kind: 'owned' }
  | { readonly kind: 'purchased' }
  | { readonly kind: 'summoned'; readonly artifacts: readonly string[] }
  /** A Dragon none of whose Routes can be bred (Summoned, Purchased): its branch ends. */
  | { readonly kind: 'dead-end' }
  /** A named parent that can't be a parent: drawn, never expanded. */
  | { readonly kind: 'cannot-be-parent' }
  | { readonly kind: 'decoration'; readonly decorations: readonly string[] }
  | { readonly kind: 'any-dragon' }
  | { readonly kind: 'both-parents' }
  | { readonly kind: 'purchase-only' }
  /** Missing limited parents that aren't Available. */
  | { readonly kind: 'not-available'; readonly dragons: readonly string[] }
  /** Every Element is covered, but no Valid pair exists. */
  | { readonly kind: 'no-valid-pair' }
  | { readonly kind: 'condition'; readonly condition: ConditionKind; readonly value: string }
  /** The chosen cave doesn't use this Route for this Dragon and form; these caves do (maybe none). */
  | { readonly kind: 'other-cave'; readonly caves: readonly Cave[] }
);

export type BadgeKind = Badge['kind'];

export type ConditionKind =
  | 'time'
  | 'weather'
  | 'alignment'
  | 'parentTrait'
  | 'namedParentTrait'
  | 'cloneCave'
  | 'prerequisite';

// ---- The Target -------------------------------------------------------------

/**
 * Why the Target can't be bred now in the chosen cave. All that apply, in
 * this order; none means it's Breedable now.
 */
export type TargetReason = { readonly label: string } & (
  | { readonly kind: 'owned' }
  /** No cave can breed it in any form: its only Routes are Evolved, Summoned or Purchased. */
  | { readonly kind: 'no-breeding'; readonly sources: readonly RouteKind[] }
  /** Some cave can, but not the chosen one in this form. */
  | { readonly kind: 'cave'; readonly cave: Cave }
  | { readonly kind: 'not-available' }
  | { readonly kind: 'purchase-only' }
  /** The cave uses some of its Routes, but none is met yet. */
  | { readonly kind: 'not-met' }
);

export type TargetInfo = {
  readonly node: NodeId;
  readonly dragon: string;
  readonly form: Form;
  readonly owned: boolean;
  readonly breedableNow: boolean;
  /** The line saying why it can't be bred now. Empty exactly when `breedableNow`. */
  readonly reasons: readonly TargetReason[];
};

/** What a graph view draws: nodes and edges, no positions. */
export type GraphModel = {
  /** Insertion order: the Target first, then each branch as it's expanded. */
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  /** The Focus view's Target, or a pulled tree's. null in a plain tab graph. */
  readonly target: TargetInfo | null;
};

/**
 * A tab graph (spec §9, Kinds of graph): the tab's Dragons, each with all its
 * Routes, plus everything they need. Feed it to `pullTree` to focus a Dragon
 * inside it.
 */
export type TabGraph = GraphModel & {
  readonly target: null;
  readonly cave: Cave;
  /** The tab's Dragon nodes, in the order given, each once. */
  readonly members: readonly NodeId[];
  /** The World it was built from, so `pullTree` can work out the Focus path. */
  readonly world: World;
};
