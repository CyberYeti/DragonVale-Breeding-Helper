// Valid pairs (spec §6): which two parents meet a Bred Route's Requirement,
// counted and listed without walking every pair.
//
// About 400 owned Dragons make about 80k pairs, and Breedable now asks this
// for every Route in the snapshot. So the parents are grouped by what matters
// to one Requirement: which of its Elements they carry (at most 2^5 groups),
// or, for `minDistinctElements`, their whole pool. Groups are paired instead
// of Dragons, and opposite primaries, the only pairs a group can't vouch for,
// are taken off afterwards.

import type { Dragon, Requirement } from '../../snapshot';
import type { Breeding, World } from '../world';
import type { Pair } from './types';

/** The parents that count for one kind of breeding, indexed for pairing. */
export type ParentIndex = {
  /** In snapshot order. */
  readonly dragons: readonly Dragon[];
  readonly byName: ReadonlyMap<string, Dragon>;
  /** Each parent's `breedingElements` as a set. */
  readonly elementsOf: ReadonlyMap<Dragon, ReadonlySet<string>>;
  /** Element → the parents that carry it. */
  readonly carriers: ReadonlyMap<string, readonly Dragon[]>;
  /** Opposite primaries among the parents, such as Plant Dragon + Metal Dragon. */
  readonly opposites: readonly Pair[];
  readonly oppositeOf: ReadonlyMap<Dragon, ReadonlySet<Dragon>>;
  /** The snapshot's opposite Elements, each way: Fire → Cold, Cold → Fire. */
  readonly oppositeElement: ReadonlyMap<string, string>;
};

const cache = new WeakMap<World, Partial<Record<Breeding, ParentIndex>>>();

/** The index for `world`'s parents for `breeding`. Built once per World. */
export function parentIndex(world: World, breeding: Breeding): ParentIndex {
  let perWorld = cache.get(world);
  if (!perWorld) cache.set(world, (perWorld = {}));
  return (perWorld[breeding] ??= buildIndex(world, breeding));
}

function buildIndex(world: World, breeding: Breeding): ParentIndex {
  const { dragons } = world.parents[breeding];
  const elementsOf = new Map(dragons.map((d) => [d, new Set(d.breedingElements)] as const));

  const carriers = new Map<string, Dragon[]>();
  for (const [dragon, elements] of elementsOf) {
    for (const element of elements) {
      let list = carriers.get(element);
      if (!list) carriers.set(element, (list = []));
      list.push(dragon);
    }
  }

  // The primary of an Element is the Primary Dragon that carries only it.
  const primaryOf = new Map<string, Dragon>();
  for (const [dragon, elements] of elementsOf) {
    if (dragon.rarity === 'Primary' && elements.size === 1) primaryOf.set([...elements][0]!, dragon);
  }
  const opposites: Pair[] = [];
  const oppositeOf = new Map<Dragon, Set<Dragon>>();
  for (const [x, y] of world.snapshot.opposites) {
    const a = primaryOf.get(x);
    const b = primaryOf.get(y);
    if (!a || !b) continue;
    opposites.push([a, b]);
    for (const [from, to] of [[a, b], [b, a]] as const) {
      let set = oppositeOf.get(from);
      if (!set) oppositeOf.set(from, (set = new Set()));
      set.add(to);
    }
  }

  return {
    dragons,
    byName: new Map(dragons.map((d) => [d.name, d])),
    elementsOf,
    carriers,
    opposites,
    oppositeOf,
    oppositeElement: oppositeElements(world),
  };
}

const oppositeCache = new WeakMap<World, ReadonlyMap<string, string>>();

/** The snapshot's opposite Elements, each way. Cached per World. */
function oppositeElements(world: World): ReadonlyMap<string, string> {
  let found = oppositeCache.get(world);
  if (!found) {
    const map = new Map<string, string>();
    for (const [x, y] of world.snapshot.opposites) map.set(x, y).set(y, x);
    oppositeCache.set(world, (found = map));
  }
  return found;
}

/**
 * Whether `other` may be the second parent next to `named` under a
 * `self-or-opposite-hybrid` partner rule: `named` itself, or an opposite
 * hybrid (Elements, ignoring Rift, exactly two opposite ones) that carries
 * every Element of `named` (Module:BreedingSandbox, primary_dragons_rule).
 */
function partnerFits(opposite: ReadonlyMap<string, string>, named: Dragon, other: Dragon): boolean {
  if (other.name === named.name) return true;
  const own = other.elements.filter((e) => e !== RIFT);
  if (own.length !== 2 || opposite.get(own[0]!) !== own[1]) return false;
  return named.elements.every((e) => e === RIFT || own.includes(e));
}

const RIFT = 'Rift';

export const areOpposites = (index: ParentIndex, a: Dragon, b: Dragon): boolean =>
  index.oppositeOf.get(a)?.has(b) ?? false;

/**
 * Whether two pools together meet a Requirement's Element fields: every
 * required Element, `minDistinctElements` and `elementOnBothParents`.
 * Named parents and opposites are checked by the callers.
 */
function poolsMeet(req: Requirement, a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  const both = req.elementOnBothParents;
  if (both !== undefined && !(a.has(both) && b.has(both))) return false;
  for (const element of req.elements ?? []) {
    if (!a.has(element) && !b.has(element)) return false;
  }
  if (req.minDistinctElements !== undefined) {
    let size = a.size;
    for (const element of b) if (!a.has(element)) size++;
    if (size < req.minDistinctElements) return false;
  }
  return true;
}

/** The Requirement's named parents among the parents, or null when one isn't (or there are more than 2). */
function namedParents(index: ParentIndex, req: Requirement): Dragon[] | null {
  const names = req.parents ?? [];
  if (names.length > 2) return null;
  const found: Dragon[] = [];
  for (const name of names) {
    const dragon = index.byName.get(name);
    if (!dragon) return null;
    found.push(dragon);
  }
  return found;
}

/**
 * The parents that could pair with `fixed` as the other parent: narrowed to
 * the carriers of an Element `fixed` lacks, or of `elementOnBothParents`.
 */
function partnersOf(index: ParentIndex, req: Requirement, fixed: Dragon): readonly Dragon[] {
  const own = index.elementsOf.get(fixed)!;
  let best: readonly Dragon[] = index.dragons;
  const narrowing = (req.elements ?? []).filter((e) => !own.has(e));
  if (req.elementOnBothParents !== undefined) narrowing.push(req.elementOnBothParents);
  for (const element of narrowing) {
    const carriers = index.carriers.get(element) ?? [];
    if (carriers.length < best.length) best = carriers;
  }
  return best;
}

type Group = { readonly pool: ReadonlySet<string>; readonly members: Dragon[] };

/**
 * The candidate parents for an unnamed Requirement, grouped so that every
 * member of a group pairs the same way: by which required Elements they
 * carry, or by their whole pool when `minDistinctElements` is set.
 */
function groups(index: ParentIndex, req: Requirement): Group[] {
  const both = req.elementOnBothParents;
  const candidates = both === undefined ? index.dragons : (index.carriers.get(both) ?? []);
  const required = [...new Set(req.elements ?? [])];
  const byKey = new Map<string | number, Group>();
  for (const dragon of candidates) {
    const pool = index.elementsOf.get(dragon)!;
    let key: string | number;
    if (req.minDistinctElements !== undefined) {
      key = [...pool].sort().join('\u0000');
    } else {
      key = 0;
      for (let i = 0; i < required.length; i++) if (pool.has(required[i]!)) key |= 1 << i;
    }
    const group = byKey.get(key);
    if (group) group.members.push(dragon);
    else byKey.set(key, { pool, members: [dragon] });
  }
  return [...byKey.values()];
}

/** Whether `dragon` is among an unnamed Requirement's candidates. */
const isCandidate = (index: ParentIndex, req: Requirement, dragon: Dragon) =>
  req.elementOnBothParents === undefined || index.elementsOf.get(dragon)!.has(req.elementOnBothParents);

/**
 * Whether a pair passes `req.partner`: with a one-name Requirement, `a` is
 * the named parent and `b` must fit next to it. No partner rule passes.
 */
function partnerOk(index: ParentIndex, req: Requirement, a: Dragon, b: Dragon): boolean {
  if (!req.partner) return true;
  const name = req.parents?.length === 1 ? req.parents[0] : undefined;
  return a.name === name && partnerFits(index.oppositeElement, a, b);
}

/**
 * The number of Valid pairs from `index`'s parents that meet `req`.
 * With `allowOpposites`, opposite primaries count too (to explain a miss).
 */
export function countPairs(index: ParentIndex, req: Requirement, allowOpposites = false): number {
  const named = namedParents(index, req);
  if (!named) return 0;
  const valid = (a: Dragon, b: Dragon) =>
    (allowOpposites || !areOpposites(index, a, b)) &&
    partnerOk(index, req, a, b) &&
    poolsMeet(req, index.elementsOf.get(a)!, index.elementsOf.get(b)!);

  if (named.length === 2) return valid(named[0]!, named[1]!) ? 1 : 0;
  if (named.length === 1) {
    const fixed = named[0]!;
    let count = 0;
    for (const other of partnersOf(index, req, fixed)) if (valid(fixed, other)) count++;
    return count;
  }
  if (req.partner) return 0;

  const all = groups(index, req);
  let count = 0;
  for (let i = 0; i < all.length; i++) {
    const a = all[i]!;
    const n = a.members.length;
    if (poolsMeet(req, a.pool, a.pool)) count += (n * (n + 1)) / 2;
    for (let j = i + 1; j < all.length; j++) {
      const b = all[j]!;
      if (poolsMeet(req, a.pool, b.pool)) count += n * b.members.length;
    }
  }
  if (!allowOpposites) {
    for (const [a, b] of index.opposites) {
      if (isCandidate(index, req, a) && isCandidate(index, req, b) && poolsMeet(req, index.elementsOf.get(a)!, index.elementsOf.get(b)!)) {
        count--;
      }
    }
  }
  return count;
}

/** The first opposite-primary pair that would meet `req` if opposites were allowed. */
export function oppositePairMeeting(index: ParentIndex, req: Requirement): Pair | null {
  const named = namedParents(index, req);
  if (!named || req.partner) return null;
  for (const [a, b] of index.opposites) {
    if (named.some((d) => d !== a && d !== b)) continue;
    if (named.length === 2 && named[0] === named[1]) continue;
    if (poolsMeet(req, index.elementsOf.get(a)!, index.elementsOf.get(b)!)) return [a, b];
  }
  return null;
}

/** Every Valid pair from `index`'s parents that meets `req`, generated lazily. */
export function* pairs(index: ParentIndex, req: Requirement): Generator<Pair, void, undefined> {
  const named = namedParents(index, req);
  if (!named) return;
  const valid = (a: Dragon, b: Dragon) =>
    !areOpposites(index, a, b) &&
    partnerOk(index, req, a, b) &&
    poolsMeet(req, index.elementsOf.get(a)!, index.elementsOf.get(b)!);

  if (named.length === 2) {
    if (valid(named[0]!, named[1]!)) yield [named[0]!, named[1]!];
    return;
  }
  if (named.length === 1) {
    const fixed = named[0]!;
    for (const other of partnersOf(index, req, fixed)) if (valid(fixed, other)) yield [fixed, other];
    return;
  }
  if (req.partner) return;

  const all = groups(index, req);
  for (let i = 0; i < all.length; i++) {
    const a = all[i]!;
    for (let j = i; j < all.length; j++) {
      const b = all[j]!;
      if (!poolsMeet(req, a.pool, b.pool)) continue;
      for (let x = 0; x < a.members.length; x++) {
        const first = a.members[x]!;
        for (let y = i === j ? x : 0; y < b.members.length; y++) {
          const second = b.members[y]!;
          if (!areOpposites(index, first, second)) yield [first, second];
        }
      }
    }
  }
}

const poolCache = new WeakMap<Dragon, ReadonlySet<string>>();
const poolOf = (dragon: Dragon): ReadonlySet<string> => {
  let pool = poolCache.get(dragon);
  if (!pool) poolCache.set(dragon, (pool = new Set(dragon.breedingElements)));
  return pool;
};

/** Whether `dragon` is the basic primary of `element`: a Primary Dragon carrying only it. */
const isPrimaryOf = (dragon: Dragon, element: string) =>
  dragon.rarity === 'Primary' && poolOf(dragon).size === 1 && poolOf(dragon).has(element);

/**
 * Whether `a` and `b` would make a Valid pair for `req` if both counted as
 * parents, whoever owns them: both can be parents, they aren't opposite
 * primaries, any named parents are them, the other fits any `partner` rule,
 * and their pools meet the Elements.
 */
export function wouldBeValidPair(world: World, req: Requirement, a: Dragon, b: Dragon): boolean {
  if (!a.canBeParent || !b.canBeParent) return false;
  for (const [x, y] of world.snapshot.opposites) {
    if ((isPrimaryOf(a, x) && isPrimaryOf(b, y)) || (isPrimaryOf(a, y) && isPrimaryOf(b, x))) return false;
  }
  const names = req.parents ?? [];
  if (names.length > 2) return false;
  if (names.length === 2) {
    const [n0, n1] = names as [string, string];
    if (!((a.name === n0 && b.name === n1) || (a.name === n1 && b.name === n0))) return false;
  } else if (names.length === 1 && a.name !== names[0] && b.name !== names[0]) {
    return false;
  }
  if (req.partner) {
    const opposite = oppositeElements(world);
    const fits = (n: Dragon, o: Dragon) => n.name === names[0] && partnerFits(opposite, n, o);
    if (names.length !== 1 || !(fits(a, b) || fits(b, a))) return false;
  }
  return poolsMeet(req, poolOf(a), poolOf(b));
}
