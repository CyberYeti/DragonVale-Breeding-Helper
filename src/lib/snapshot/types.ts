// The snapshot's shape (spec §4). The snapshot holds domain data only; the app
// builds graph nodes and edges from it at runtime.

export type Snapshot = {
  meta: SnapshotMeta;
  /** Only Elements used by at least one Route. */
  elements: Element[];
  /** The 5 opposite-Element pairs, hard-coded in the scraper. */
  opposites: [string, string][];
  dragons: Dragon[];
  pages: DragonariumPage[];
  /** Old Name -> new Name, cumulative. Never shrinks. */
  renames: Record<string, string>;
};

export type SnapshotMeta = {
  /** The app refuses a snapshot it can't read. */
  schemaVersion: number;
  /** Identifies this snapshot; the Collection's snapshotRevision points at it. */
  revision: string;
  /** Wiki URL. */
  source: string;
  license: 'CC BY-SA 3.0';
  /** Revision ID per `Data:*.json` page. */
  pageRevisions: Record<string, number>;
  fetchedAt: string;
};

export type ElementKind = 'primary' | 'epic' | 'gem' | 'legendary' | 'mythic' | 'rift' | 'other';

export type Element = {
  name: string;
  kind: ElementKind;
  /** Local path under public/images/. */
  icon: string | null;
};

export type Rarity =
  | 'Primary'
  | 'Hybrid'
  | 'Rare'
  | 'Epic'
  | 'Galaxy'
  | 'Gemstone'
  | 'Legendary'
  | 'Mythic';

export type Traits = { kind: 'all' } | { kind: 'fixed'; element: string } | { kind: 'none' };

export type Dragon = {
  /** The key everywhere. */
  name: string;
  /** From Alias, else the bare name (Legendary, Mythic). */
  wikiPage: string;
  rarity: Rarity;
  /** Release order. */
  order: number;
  /** Displayed Elements. */
  elements: string[];
  /** What it adds to a pair's pool as a parent. */
  breedingElements: string[];
  isLimited: boolean;
  traits: Traits;
  canBeParent: boolean;
  /** Local path under public/images/; null = silhouette. */
  image: string | null;
  /** One or more. */
  routes: Route[];
};

export type DragonariumPage = {
  /** From the page's Collection field. */
  name: string;
  group: 'elemental' | 'epic' | 'special';
  /** In the game's order. */
  dragons: string[];
  icon: string | null;
};

/** One way to obtain a Dragon. A Dragon's Source is the set of its Routes' kinds. */
export type Route = BredRoute | CoopRoute | EvolvedRoute | SummonedRoute | PurchasedRoute;

export type RouteKind = Route['kind'];

export type BredRoute = {
  kind: 'bred';
  requirement: Requirement;
  /** Marks a Bred Route of a Rift dragon: only Rift breeding meets it. */
  rift?: 'only';
  conditions?: Conditions;
};

export type CoopRoute = {
  kind: 'coop';
  /** The friend's Dragon. The other parent can be any Dragon. */
  friendsDragon: string;
  conditions?: Conditions;
};

export type EvolvedRoute = { kind: 'evolved'; from: string; decorations: string[] };

export type SummonedRoute = { kind: 'summoned'; artifacts: string[] };

export type PurchasedRoute = { kind: 'purchased' };

/** Every field that is set must pass. */
export type Requirement = {
  /** 0-2 named Dragons; 2 = exactly that pair. */
  parents?: string[];
  /** The pair's combined pool must hold all of them. */
  elements?: string[];
  minDistinctElements?: number;
  elementOnBothParents?: string;
  /** Motley, Dargon. */
  anyPair?: true;
};

/** Badges only; never block anything. */
export type Conditions = {
  time?: string;
  weather?: string;
  alignment?: string;
  parentTrait?: string;
  /** Each named parent with the trait it must carry (Zaffer: Blue Fire with Air, Plasma with Metal). */
  namedParentTraits?: { dragon: string; trait: string }[];
  /** Solis, Lunis. */
  cloneCave?: string;
  /** Rigel: own all 22 other Galaxy Dragons. */
  prerequisite?: string;
};
