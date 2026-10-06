// The breeding rules every view shares (spec §6): what each Breeding cave
// makes, when a Route is met, Breedable now and the Basic dragon.

import type { BredRoute, CoopRoute, Dragon, Requirement, Route } from '../../snapshot';
import { formsOf, isOwned, type Form } from '../collection';
import type { Breeding, World } from '../world';
import { countPairs, oppositePairMeeting, pairs, parentIndex, type ParentIndex } from './pairs';
import type { Cave, NoBreeding, Pair, RouteReason, RouteStatus } from './types';

/** The Galaxy Dragons the Normal cave still makes (spec §6). */
const NORMAL_CAVE_GALAXY: ReadonlySet<string> = new Set(['Solis', 'Lunis', 'Rigel']);

/**
 * The form `cave` makes `dragon` in, or null when it makes none: the Rift
 * cave makes Rift forms and Rift dragons; the Normal and Co-op caves make
 * normal forms (so never Rift dragons). This is also the form a Dragon opens
 * as in that cave. It doesn't look at Routes; `caveCanMake` does.
 */
export function caveForm(dragon: Dragon, cave: Cave): Form | null {
  const wanted: Form = cave === 'rift' ? 'rift' : 'normal';
  return formsOf(dragon).includes(wanted) ? wanted : null;
}

/**
 * Whether `cave` can make `dragon` at all, whatever the Collection holds: it
 * makes the Dragon's form, the Galaxy rule lets it (Normal: no Galaxy except
 * Solis, Lunis and Rigel), and it uses at least one of the Dragon's Routes.
 */
export function caveCanMake(dragon: Dragon, cave: Cave): boolean {
  return caveRoutes(dragon, cave).length > 0;
}

/** The Routes `cave` uses to make `dragon`, in the Dragon's order. */
function caveRoutes(dragon: Dragon, cave: Cave): Route[] {
  if (caveForm(dragon, cave) === null) return [];
  if (cave === 'normal' && dragon.rarity === 'Galaxy' && !NORMAL_CAVE_GALAXY.has(dragon.name)) return [];
  return dragon.routes.filter((route) => {
    switch (route.kind) {
      case 'bred':
        return cave === 'rift' || route.rift !== 'only';
      case 'coop':
        return cave === 'coop';
      default:
        return false;
    }
  });
}

/**
 * Null when the Dragon has a Bred or Co-op bred Route; otherwise how it's
 * obtained instead. Summoned beats Evolved beats Purchased on mixed Routes.
 */
export function noBreeding(dragon: Dragon): NoBreeding | null {
  const kinds = new Set(dragon.routes.map((route) => route.kind));
  if (kinds.has('bred') || kinds.has('coop')) return null;
  if (kinds.has('summoned')) return 'summoning-only';
  if (kinds.has('evolved')) return 'evolution-only';
  return 'shop-only';
}

/** `form` if the Dragon has it, else its one form (a Rift dragon is always itself). */
export const formFor = (dragon: Dragon, form: Form): Form => {
  const forms = formsOf(dragon);
  return forms.includes(form) ? form : forms[0]!;
};

/** Spec §9: a Rift form, or a `rift: "only"` Route, uses Rift breeding parents. */
export const breedingFor = (route: Route, form: Form): Breeding =>
  form === 'rift' || (route.kind === 'bred' && route.rift === 'only') ? 'rift' : 'normal';

const status = (pairCount: number, reason: RouteReason): RouteStatus => ({
  met: reason.kind === 'met',
  pairCount,
  reason,
});

const MET: RouteReason = { kind: 'met' };

/**
 * Whether one of `dragon`'s Routes is met from the Collection, for `dragon`
 * in `form` (a single-form Dragon always uses its one form).
 *
 * - Bred: some Valid pair from the parents that count meets it. A Rift form,
 *   or a `rift: "only"` Route, counts only Rift breeding parents.
 * - Co-op bred: the Collection holds any Dragon that counts as a Normal
 *   breeding parent (a friend lends the other). Never met for a Rift form.
 * - Evolved: the base Dragon is owned (in `form`, if it has it).
 * - Summoned, Purchased: never.
 *
 * Conditions never block. Purchase only, Available and the cave are not
 * looked at here; `breedableNow` applies them.
 */
export function routeStatus(world: World, dragon: Dragon, route: Route, form: Form): RouteStatus {
  const own = formFor(dragon, form);
  switch (route.kind) {
    case 'summoned':
    case 'purchased':
      return status(0, { kind: 'not-bred' });

    case 'evolved': {
      const base = world.dragons.get(route.from);
      return base && isOwned(world.collection, base, formFor(base, own))
        ? status(1, MET)
        : status(0, { kind: 'missing-parents', dragons: [route.from] });
    }

    case 'coop':
    case 'bred': {
      const count = pairCountFor(world, route, own);
      if (count > 0) return status(count, MET);
      if (route.kind === 'coop') return status(0, own === 'rift' ? { kind: 'normal-form-only' } : { kind: 'no-parents' });
      return status(0, whyNot(parentIndex(world, breedingFor(route, own)), route.requirement));
    }
  }
}

/**
 * A Bred or Co-op bred Route's pair count for a Dragon in `form` (its own
 * form): Valid pairs from the parents that count, or for Co-op bred (normal
 * forms only) the owned Normal breeding parents.
 */
function pairCountFor(world: World, route: BredRoute | CoopRoute, form: Form): number {
  if (route.kind === 'coop') return form === 'normal' ? world.parents.normal.dragons.length : 0;
  return countPairs(parentIndex(world, breedingFor(route, form)), route.requirement);
}

/** Why a Bred Route's Requirement has no Valid pair. */
function whyNot(index: ParentIndex, req: Requirement): RouteReason {
  if (index.dragons.length === 0) return { kind: 'no-parents' };

  const missingParents = (req.parents ?? []).filter((name) => !index.byName.has(name));
  if (missingParents.length > 0) return { kind: 'missing-parents', dragons: missingParents };

  const both = req.elementOnBothParents === undefined ? [] : [req.elementOnBothParents];
  const required = [...new Set([...(req.elements ?? []), ...both])];
  const missingElements = required.filter((element) => !index.carriers.has(element));
  if (missingElements.length > 0) return { kind: 'missing-elements', elements: missingElements };

  if (req.minDistinctElements !== undefined && index.carriers.size < req.minDistinctElements) {
    return { kind: 'too-few-elements', needed: req.minDistinctElements };
  }

  const opposite = oppositePairMeeting(index, req);
  if (opposite) return { kind: 'opposites', pair: [opposite[0].name, opposite[1].name] };

  return { kind: 'no-valid-pair' };
}

/**
 * The pairs that meet `route` for a Dragon in `form`, generated lazily (take
 * what you need, or spread it for all of them).
 *
 * - Bred: every Valid pair from the parents that count; a one-name
 *   Requirement puts the named parent first.
 * - Co-op bred (normal form only): the friend's Dragon with each owned parent.
 * - Anything else: none.
 *
 * `form` here is the Target's: for a Rift dragon pass `'rift'`.
 */
export function* validPairs(world: World, route: Route, form: Form): Generator<Pair, void, undefined> {
  if (route.kind === 'bred') {
    yield* pairs(parentIndex(world, breedingFor(route, form)), route.requirement);
  } else if (route.kind === 'coop' && form === 'normal') {
    const friends = world.dragons.get(route.friendsDragon);
    if (!friends) return;
    for (const parent of world.parents.normal.dragons) yield [friends, parent];
  }
}

const breedableCache = new WeakMap<World, Partial<Record<Cave, ReadonlySet<string>>>>();

/**
 * The names of the Dragons Breedable now in `cave`: in the form the cave
 * makes, not owned in that form, a Route the cave uses is met, not Purchase
 * only, and Available. Evolved and Summoned Routes never count. A met Route's
 * named parents are owned, and owned parents are always usable, so no
 * limited-parent check is needed. Cached per World.
 */
export function breedableNow(world: World, cave: Cave): ReadonlySet<string> {
  let perWorld = breedableCache.get(world);
  if (!perWorld) breedableCache.set(world, (perWorld = {}));
  return (perWorld[cave] ??= computeBreedable(world, cave));
}

function computeBreedable(world: World, cave: Cave): ReadonlySet<string> {
  const result = new Set<string>();
  for (const dragon of world.snapshot.dragons) {
    const form = caveForm(dragon, cave);
    if (form === null) continue;
    if (isOwned(world.collection, dragon, form)) continue;
    if (world.purchaseOnly.has(dragon.name) || !world.available.has(dragon.name)) continue;
    if (caveRoutes(dragon, cave).some((route) => routeIsMet(world, route, form))) result.add(dragon.name);
  }
  return result;
}

/** routeStatus's `met` for a Route a cave uses, without explaining a miss. `form` is the Dragon's own. */
function routeIsMet(world: World, route: Route, form: Form): boolean {
  return (route.kind === 'bred' || route.kind === 'coop') && pairCountFor(world, route, form) > 0;
}

/**
 * The Element's Basic dragon: the Dragon that carries it with the fewest
 * `breedingElements`, ties to the lowest `order`. Dragons that can be
 * parents come first; one that can't is the answer only when nothing else
 * carries the Element. Null when no Dragon carries it.
 */
export function basicDragon(world: World, element: string): Dragon | null {
  const carriers = world.carriers.get(element) ?? [];
  return carriers.find((d) => d.canBeParent) ?? carriers[0] ?? null;
}
