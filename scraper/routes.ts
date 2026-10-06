// routesFor(): turns one Dragon's Data:BreedingHints.json entry into its Routes
// (spec §4 "Routes" and "What the scraper works out"). Module:BreedingSandbox
// on the wiki is the reference for what each hint key means.
//
// Every hint key is either mapped or deliberately ignored; any other key fails
// the run, since the wiki can add or rename keys without notice.

import { isRecord, type BredRoute, type Conditions, type ElementKind, type Rarity, type Requirement, type Route } from '../src/lib/snapshot';

/** Keys of a hint that are price data, not breeding data. */
const IGNORED_KEYS = new Set(['BuyPrice', 'BuyPriceType']);
/** Keys that make a Bred (or Co-op bred) Route. */
const BREEDING_KEYS = new Set([
  'RequiredDragons',
  'RequiredElements',
  'MinimumRequiredElements',
  'RequiredElementsForBothParents',
  'Any',
]);
/** Keys that only add Conditions or the Rift marker to a Bred Route. */
const CONDITION_KEYS = new Set([
  'RequiredTime',
  'RequiredWeather',
  'RiftAlignment',
  'RequiredTraits',
  'RequiredDragonTraits',
  'RequiredCave',
  'RequiredCloneCave',
  'Prerequisites',
]);
const EVOLUTION_KEYS = new Set(['IsEvolution', 'RequiredDecorations']);
const SUMMON_KEYS = new Set(['RequiredArtifacts']);
export const HINT_KEYS: ReadonlySet<string> = new Set([
  ...IGNORED_KEYS,
  ...BREEDING_KEYS,
  ...CONDITION_KEYS,
  ...EVOLUTION_KEYS,
  ...SUMMON_KEYS,
]);

const RIFT = 'Rift';

/** What routesFor needs to know about the Dragon. */
export type RouteDragon = {
  name: string;
  rarity: Rarity;
  elements: string[];
  /** Data:Dragons.json `Devolution`: the Dragon it evolves from. */
  devolution?: string;
};

/** What routesFor needs to know about the rest of the data. */
export type RouteContext = {
  elementKind: ReadonlyMap<string, ElementKind>;
  /** Every Dragon's displayed Elements, by name. */
  dragonElements: ReadonlyMap<string, readonly string[]>;
};

export type RouteProblems = { fail(message: string): void };

/**
 * The Routes for one Dragon, from its hint (undefined when it has none).
 * Returns null after reporting a fail-level problem.
 */
export function routesFor(
  dragon: RouteDragon,
  hint: unknown,
  context: RouteContext,
  problems: RouteProblems,
): Route[] | null {
  if (hint === undefined) return routesWithoutHint(dragon, context, problems);
  return new HintReader(dragon, context, problems).read(hint);
}

/**
 * The 10 basic primaries are bought; the 9 without a hint are also bred from
 * their own Element. Rift primaries have no hint and are only bought.
 */
function routesWithoutHint(dragon: RouteDragon, context: RouteContext, problems: RouteProblems): Route[] | null {
  const { name, rarity, elements } = dragon;
  const isPrimary = (e: string | undefined) => e !== undefined && context.elementKind.get(e) === 'primary';
  if (rarity === 'Primary' && elements.length === 1 && isPrimary(elements[0])) {
    return [{ kind: 'bred', requirement: { elements: [...elements] } }, { kind: 'purchased' }];
  }
  const others = elements.filter((e) => e !== RIFT);
  if (elements.includes(RIFT) && others.length === 1 && isPrimary(others[0])) {
    return [{ kind: 'purchased' }];
  }
  problems.fail(`${name} has no breeding hint and isn't a primary or rift primary, so it has no Route`);
  return null;
}

class HintReader {
  private ok = true;

  constructor(
    private readonly dragon: RouteDragon,
    private readonly context: RouteContext,
    private readonly problems: RouteProblems,
  ) {}

  read(hint: unknown): Route[] | null {
    const name = this.dragon.name;
    if (!isRecord(hint)) {
      this.problems.fail(`${name}'s breeding hint isn't an object`);
      return null;
    }
    for (const key of Object.keys(hint)) {
      if (!HINT_KEYS.has(key)) this.fail(`${name}'s breeding hint has unknown key "${key}"`);
    }
    if (!this.ok) return null;

    const has = (keys: ReadonlySet<string>) => Object.keys(hint).some((k) => keys.has(k));
    const groups = [has(BREEDING_KEYS) || has(CONDITION_KEYS), has(EVOLUTION_KEYS), has(SUMMON_KEYS)];
    if (groups.filter(Boolean).length !== 1) {
      this.fail(
        `${name}'s breeding hint mixes or lacks breeding, evolution and artifact keys: ${JSON.stringify(Object.keys(hint))}`,
      );
      return null;
    }

    let route: Route | null;
    if (groups[1]) route = this.evolved(hint);
    else if (groups[2]) route = this.summoned(hint);
    else route = this.bred(hint);
    const routes: Route[] = route && this.ok ? [route] : [];
    if (routes.length === 0) return null;
    // The basic primaries are all bought, Air included, though Air also has a hint.
    if (this.dragon.rarity === 'Primary') routes.push({ kind: 'purchased' });
    return routes;
  }

  private evolved(hint: Record<string, unknown>): Route | null {
    const { name, devolution } = this.dragon;
    if (hint.IsEvolution !== true) this.fail(`${name}'s breeding hint has IsEvolution other than true`);
    const decorations = this.strings(hint, 'RequiredDecorations', { min: 1 });
    if (devolution === undefined) this.fail(`${name} evolves (IsEvolution) but has no Devolution to evolve from`);
    else this.dragonName(devolution, 'Devolution');
    if (!this.ok || !decorations || devolution === undefined) return null;
    return { kind: 'evolved', from: devolution, decorations };
  }

  private summoned(hint: Record<string, unknown>): Route | null {
    const artifacts = this.strings(hint, 'RequiredArtifacts', { min: 1 });
    return artifacts ? { kind: 'summoned', artifacts } : null;
  }

  private bred(hint: Record<string, unknown>): Route | null {
    const { name, rarity, elements: displayed } = this.dragon;
    const parents = this.strings(hint, 'RequiredDragons', { max: 2 });
    for (const p of parents ?? []) this.dragonName(p, 'RequiredDragons');
    const elements = this.elementNames(hint, 'RequiredElements');
    const bothParents = this.elementNames(hint, 'RequiredElementsForBothParents');
    const min = hint.MinimumRequiredElements;
    if (min !== undefined && !(Number.isInteger(min) && (min as number) > 0)) {
      this.fail(`${name}'s breeding hint has a MinimumRequiredElements that isn't a positive whole number`);
    }
    if (hint.Any !== undefined && hint.Any !== true) this.fail(`${name}'s breeding hint has Any other than true`);
    const cave = hint.RequiredCave;
    if (cave !== undefined && cave !== 'Rift' && cave !== 'Any') {
      this.fail(`${name}'s breeding hint has unknown RequiredCave ${JSON.stringify(cave)}`);
    }
    const conditions = this.conditions(hint, parents ?? []);

    // Rift on both parents means Rift breeding (both parents in Rift form), as in Module:BreedingSandbox.
    const riftOnly = displayed.includes(RIFT) || cave === 'Rift' || (bothParents ?? []).includes(RIFT);
    const onBoth = (bothParents ?? []).filter((e) => e !== RIFT);
    if (onBoth.length > 1) {
      this.fail(`${name}'s breeding hint needs more than one Element on both parents: ${onBoth.join(', ')}`);
    }
    if (!this.ok) return null;

    // Galaxy Dragons breed in the Cooperative cave unless the hint names another
    // one; `RequiredDragons: [X], Any: true` there means a friend's X plus any Dragon.
    if (
      rarity === 'Galaxy' &&
      cave === undefined &&
      hint.Any === true &&
      parents?.length === 1 &&
      !elements &&
      !bothParents &&
      min === undefined
    ) {
      return { kind: 'coop', friendsDragon: parents[0]!, ...(conditions && { conditions }) };
    }

    const requirement: Requirement = {};
    if (parents && parents.length > 0) requirement.parents = parents;
    if (elements && elements.length > 0) requirement.elements = unique(elements);
    if (min !== undefined) requirement.minDistinctElements = min as number;
    if (onBoth[0] !== undefined) requirement.elementOnBothParents = onBoth[0];
    // A bare `Any` is any pair (Motley, Dargon); next to other keys it adds nothing.
    if (hint.Any === true && Object.keys(requirement).length === 0) requirement.anyPair = true;
    if (Object.keys(requirement).length === 0) {
      this.fail(`${name}'s breeding hint has no requirement on the parents`);
      return null;
    }
    const route: BredRoute = { kind: 'bred', requirement };
    if (riftOnly) route.rift = 'only';
    if (conditions) route.conditions = conditions;
    return route;
  }

  /** Badge-only Conditions; undefined when there are none. */
  private conditions(hint: Record<string, unknown>, parents: string[]): Conditions | undefined {
    const { name } = this.dragon;
    const conditions: Conditions = {};
    const time = this.string(hint, 'RequiredTime');
    if (time !== undefined) conditions.time = time;
    const weather = this.string(hint, 'RequiredWeather');
    if (weather !== undefined) conditions.weather = weather;
    const alignment = this.string(hint, 'RiftAlignment');
    if (alignment !== undefined && this.elementName(alignment, 'RiftAlignment')) conditions.alignment = alignment;

    const traits = this.elementNames(hint, 'RequiredTraits');
    if (traits && traits.length !== 1) this.fail(`${name}'s breeding hint needs ${traits.length} RequiredTraits; one is supported`);
    else if (traits) conditions.parentTrait = traits[0]!;

    // RequiredDragonTraits pairs up with RequiredDragons by position.
    const dragonTraits = this.elementNames(hint, 'RequiredDragonTraits');
    if (dragonTraits && dragonTraits.length !== parents.length) {
      this.fail(`${name}'s breeding hint has ${dragonTraits.length} RequiredDragonTraits for ${parents.length} RequiredDragons`);
    } else if (dragonTraits) {
      conditions.namedParentTraits = dragonTraits.map((trait, i) => ({ dragon: parents[i]!, trait }));
    }

    const cloneCave = this.string(hint, 'RequiredCloneCave');
    if (cloneCave !== undefined) conditions.cloneCave = cloneCave;
    const prerequisite = this.prerequisite(hint.Prerequisites);
    if (prerequisite !== undefined) conditions.prerequisite = prerequisite;
    return Object.keys(conditions).length > 0 ? conditions : undefined;
  }

  /**
   * `Prerequisites: {Owned: {Elements: [E], Dragons: [D]}}`: own every other
   * Dragon with Element E, and each D (Module:BreedingSandbox). Rigel's reads
   * "Own all 22 other Galaxy Dragons".
   */
  private prerequisite(value: unknown): string | undefined {
    if (value === undefined) return undefined;
    const { name } = this.dragon;
    const owned = isRecord(value) && Object.keys(value).length === 1 ? value.Owned : undefined;
    const keys = isRecord(owned) ? Object.keys(owned) : [];
    if (!isRecord(owned) || keys.length === 0 || keys.some((k) => k !== 'Elements' && k !== 'Dragons')) {
      this.fail(`${name}'s breeding hint has Prerequisites the scraper doesn't know: ${JSON.stringify(value)}`);
      return undefined;
    }
    const parts: string[] = [];
    for (const element of this.elementNames(owned, 'Prerequisites.Owned.Elements') ?? []) {
      const others = [...this.context.dragonElements].filter(([n, els]) => n !== name && els.includes(element));
      parts.push(`all ${others.length} other ${element} Dragons`);
    }
    const dragons = this.strings(owned, 'Prerequisites.Owned.Dragons');
    for (const d of dragons ?? []) if (this.dragonName(d, 'Prerequisites.Owned.Dragons')) parts.push(d);
    return parts.length > 0 ? `Own ${parts.join(' and ')}` : undefined;
  }

  // ---- Field readers: each reports a malformed value and returns undefined ----

  private string(hint: Record<string, unknown>, key: string): string | undefined {
    const value = hint[key];
    if (value === undefined) return undefined;
    if (typeof value === 'string' && value !== '') return value;
    this.fail(`${this.dragon.name}'s breeding hint has a ${key} that isn't a string`);
    return undefined;
  }

  /** `key` may be a dotted label; only its last part is looked up. */
  private strings(hint: Record<string, unknown>, key: string, { min = 0, max = Infinity } = {}): string[] | undefined {
    const value = hint[key.split('.').at(-1)!];
    if (value === undefined) return undefined;
    if (isStringArray(value) && value.length >= min && value.length <= max) return [...value];
    const size = max === Infinity ? `at least ${min}` : `${min}-${max}`;
    this.fail(`${this.dragon.name}'s breeding hint has a ${key} that isn't a list of ${size} names`);
    return undefined;
  }

  private elementNames(hint: Record<string, unknown>, key: string): string[] | undefined {
    const names = this.strings(hint, key);
    return names?.every((e) => this.elementName(e, key)) ? names : undefined;
  }

  private elementName(element: string, key: string): boolean {
    if (this.context.elementKind.has(element)) return true;
    this.fail(`${this.dragon.name} has unknown Element "${element}" in its breeding hint's ${key}`);
    return false;
  }

  private dragonName(dragon: string, key: string): boolean {
    if (this.context.dragonElements.has(dragon)) return true;
    this.fail(`${this.dragon.name} names unknown Dragon "${dragon}" in ${key}`);
    return false;
  }

  private fail(message: string): void {
    this.ok = false;
    this.problems.fail(message);
  }
}

/** Every Element some Route uses: in its requirement or its Conditions. */
export function elementsUsedBy(routes: readonly Route[]): Set<string> {
  const used = new Set<string>();
  for (const route of routes) {
    if (route.kind !== 'bred' && route.kind !== 'coop') continue;
    if (route.kind === 'bred') {
      const { elements = [], elementOnBothParents } = route.requirement;
      for (const e of elements) used.add(e);
      if (elementOnBothParents) used.add(elementOnBothParents);
    }
    const c = route.conditions;
    for (const e of [c?.alignment, c?.parentTrait, ...(c?.namedParentTraits ?? []).map((t) => t.trait)]) {
      if (e) used.add(e);
    }
  }
  return used;
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}
