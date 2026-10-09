// The click panel's data (spec §9 Click panel).

import type { Dragon, Route } from '../../snapshot';
import {
  basicDragon,
  breedableNow,
  breedingFor,
  caveCanMake,
  caveName,
  formFor,
  noBreeding,
  noBreedingText,
  NOT_AVAILABLE,
  partnerText,
  routeStatus,
  validPairs,
  wouldBeValidPair,
  type Cave,
  type RouteReason,
  type RouteStatus,
} from '../breeding';
import { formsOf, isOwned, ticks, type Form } from '../collection';
import type { Breeding, World } from '../world';
import type {
  Candidate,
  Clicked,
  DragonPanel,
  ElementPanel,
  Listed,
  PairGroup,
  PanelData,
  RoutePanel,
  Suggestion,
  Target,
  Tone,
} from './types';

/**
 * What the click panel shows for the `clicked` node of `target`'s graph in
 * `cave`: the headline, the reason and the full sorted lists. The popover
 * takes the top 3 of them.
 */
export function panelFor(world: World, cave: Cave, target: Target, clicked: Clicked): PanelData {
  switch (clicked.kind) {
    case 'route': {
      const dragon = dragonNamed(world, clicked.dragon);
      const route = dragon.routes[clicked.route];
      if (!route) throw new Error(`panelFor: ${dragon.name} has no Route ${clicked.route}`);
      return routePanel(world, cave, target, dragon, formFor(dragon, clicked.form), route);
    }
    case 'element':
      return elementPanel(world, cave, target, clicked.element, clicked.breeding ?? (cave === 'rift' ? 'rift' : 'normal'));
    case 'dragon':
      return dragonPanel(world, cave, target, dragonNamed(world, clicked.dragon), clicked.form);
  }
}

// ---- Route --------------------------------------------------------------------

function routePanel(world: World, cave: Cave, target: Target, dragon: Dragon, form: Form, route: Route): RoutePanel {
  const status = routeStatus(world, dragon, route, form);
  const breeding = breedingFor(route, form);
  const { headline, tone } = routeHeadline(route, status);
  return {
    kind: 'route',
    dragon,
    form,
    route,
    status,
    headline,
    tone,
    reason: reasonText(world, route, status.reason, breeding),
    pairs: status.met ? pairGroups(world, route, form, breeding) : [],
    suggestions:
      !status.met && route.kind === 'bred' ? suggestions(world, cave, target, dragon, route, breeding) : [],
  };
}

function routeHeadline(route: Route, status: RouteStatus): { headline: string; tone: Tone } {
  switch (status.reason.kind) {
    case 'met': {
      if (route.kind === 'evolved') return { headline: '✔ Met', tone: 'ok' };
      const n = status.pairCount;
      return { headline: `✔ Met · ${n.toLocaleString('en-US')} Valid pair${n === 1 ? '' : 's'}`, tone: 'ok' };
    }
    case 'not-bred':
      return { headline: route.kind === 'summoned' ? 'Summoned' : 'Purchased', tone: 'muted' };
    case 'opposites':
    case 'no-valid-pair':
      return { headline: 'No Valid pair yet', tone: 'warn' };
    default:
      return { headline: 'Not met', tone: 'bad' };
  }
}

function reasonText(world: World, route: Route, reason: RouteReason, breeding: Breeding): string | null {
  const name = (n: string) => world.dragons.get(n)?.wikiPage ?? n;
  switch (reason.kind) {
    case 'met':
      if (route.kind === 'evolved') {
        const decorations = route.decorations.length > 0 ? ` with ${joinAnd(route.decorations)}` : '';
        return `Evolves from ${name(route.from)}${decorations}`;
      }
      if (route.kind === 'coop') return `A friend lends ${name(route.friendsDragon)}; any Dragon you own is the other parent`;
      return partnerParent(route) ? partnerText(world, partnerParent(route)!, name) : null;
    case 'not-bred':
      if (route.kind === 'summoned') {
        return route.artifacts.length > 0 ? `Summoned with ${joinAnd(route.artifacts)}` : 'Summoned, not bred';
      }
      return 'Bought, not bred';
    case 'normal-form-only':
      return 'Co-op breeding makes only normal forms';
    case 'no-parents':
      return breeding === 'rift'
        ? 'You own no Rift form or Rift dragon that can be a parent'
        : 'You own no Dragon that can be a parent';
    case 'missing-parents':
      return `Needs ${joinAnd(reason.dragons.map(name))}${breeding === 'rift' && route.kind === 'bred' ? ' in Rift breeding' : ''}`;
    case 'needs-owned':
      return `Needs a ${name(reason.dragon)} you already own${breeding === 'rift' ? ' in Rift breeding' : ''}: ${lowerFirst(partnerText(world, reason.dragon, name))}`;
    case 'missing-elements':
      return `Nothing you own${breeding === 'rift' ? ' in Rift form' : ''} carries ${joinAnd(reason.elements)}`;
    case 'too-few-elements':
      return `Your Dragons hold fewer than ${reason.needed} Elements between them`;
    case 'opposites':
      return `${name(reason.pair[0])} + ${name(reason.pair[1])} are opposites`;
    case 'no-valid-pair':
      return 'Every Element is covered, but no two of your Dragons meet it together';
  }
}

/**
 * Every owned Valid pair, grouped by parent. A named parent (or the friend's
 * Dragon) heads its group; otherwise a pair goes under its simpler parent.
 */
function pairGroups(world: World, route: Route, form: Form, breeding: Breeding): PairGroup[] {
  const named = route.kind === 'coop' || (route.kind === 'bred' && (route.requirement.parents?.length ?? 0) > 0);
  const groups = new Map<Dragon, Dragon[]>();
  for (const [a, b] of validPairs(world, route, form)) {
    const [head, other] = named || simplerFirst(a, b) <= 0 ? [a, b] : [b, a];
    let list = groups.get(head);
    if (!list) groups.set(head, (list = []));
    list.push(other);
  }
  return [...groups]
    .sort(([a], [b]) => simplerFirst(a, b))
    .map(([head, others]) => ({
      parent: listed(world, head, breeding),
      with: others.sort(simplerFirst).map((d) => listed(world, d, breeding)),
    }));
}

/**
 * Dragons that would make a Valid pair for `route` with an owned parent:
 * any Dragon that can be a parent here but doesn't count as one yet, never
 * the Target or the Route's own Dragon.
 */
function suggestions(
  world: World,
  cave: Cave,
  target: Target,
  owner: Dragon,
  route: Route & { kind: 'bred' },
  breeding: Breeding,
): Suggestion[] {
  const parents = world.parents[breeding];
  const partners = [...parents.dragons].sort(simplerFirst);
  const out: Suggestion[] = [];
  for (const dragon of world.snapshot.dragons) {
    if (dragon.name === target.dragon || dragon.name === owner.name) continue;
    if (parents.names.has(dragon.name) || !canParentIn(dragon, breeding)) continue;
    const partner = partners.find((p) => wouldBeValidPair(world, route.requirement, dragon, p));
    if (partner) out.push({ ...candidate(world, cave, dragon, breeding), with: listed(world, partner, breeding) });
  }
  return out.sort(byCandidateOrder);
}

// ---- Element ------------------------------------------------------------------

function elementPanel(world: World, cave: Cave, target: Target, element: string, breeding: Breeding): ElementPanel {
  const all = world.carriers.get(element) ?? [];
  const parents = world.parents[breeding].names;
  const carriers = all.filter((d) => parents.has(d.name));
  const eligible = all.filter((d) => canParentIn(d, breeding));
  const basic =
    eligible[0] ??
    (breeding === 'normal' ? basicDragon(world, element) : all.find((d) => formsOf(d).includes('rift'))) ??
    null;
  const alternatives = eligible
    .filter((d) => d !== basic && !parents.has(d.name) && d.name !== target.dragon)
    .map((d) => candidate(world, cave, d, breeding))
    .sort(byCandidateOrder);
  const n = carriers.length;
  return {
    kind: 'element',
    element,
    breeding,
    headline: n > 0 ? `You own ${n.toLocaleString('en-US')} carrying it` : 'You own nothing that carries it',
    tone: n > 0 ? 'ok' : 'bad',
    carriers: carriers.map((d) => listed(world, d, breeding)),
    basic: basic ? candidate(world, cave, basic, breeding) : null,
    alternatives,
  };
}

// ---- Dragon -------------------------------------------------------------------

function dragonPanel(world: World, cave: Cave, target: Target, dragon: Dragon, asked: Form): DragonPanel {
  const form = formFor(dragon, asked);
  const making = cavesFor(form, cave);
  const owned = isOwned(world.collection, dragon, form);
  const breedable = !owned && breedableNow(world, making).has(dragon.name);

  // A Dragon no cave ever breeds is headed by how it's obtained instead.
  const only = noBreeding(dragon);
  const reasons: string[] = [];
  if (!owned && !breedable) {
    if (!only && !caveCanMake(dragon, making)) reasons.push(`The ${caveName(making)} cave can't make it`);
    if (!world.available.has(dragon.name)) reasons.push(`${NOT_AVAILABLE} right now`);
    if (world.purchaseOnly.has(dragon.name)) reasons.push('Purchase only right now');
    if (!only && reasons.length === 0) reasons.push('No Route is met yet');
  }

  const riftForm = form === 'rift' && formsOf(dragon).length > 1;
  return {
    kind: 'dragon',
    dragon,
    form,
    isTarget: dragon.name === target.dragon && formFor(dragon, target.form) === form,
    status: owned ? 'owned' : breedable ? 'breedable-now' : 'not-breedable',
    headline: owned
      ? `Owned${riftForm ? ' (Rift form)' : ''}`
      : breedable
        ? 'Breedable now'
        : only
          ? noBreedingText(only)
          : "Can't breed now",
    tone: owned || breedable ? 'ok' : only ? 'muted' : 'bad',
    reasons,
    ticks: ticks(world.collection, dragon),
    routes: dragon.routes.map((route, index) => {
      const status = routeStatus(world, dragon, route, form);
      return { index, route, status, ...routeHeadline(route, status) };
    }),
  };
}

// ---- Shared -------------------------------------------------------------------

function dragonNamed(world: World, name: string): Dragon {
  const dragon = world.dragons.get(name);
  if (!dragon) throw new Error(`panelFor: no Dragon named ${name}`);
  return dragon;
}

/** The cave that makes a Dragon in `form`: the Rift cave for Rift forms, else the chosen cave (Normal if it's Rift). */
const cavesFor = (form: Form, cave: Cave): Cave => (form === 'rift' ? 'rift' : cave === 'rift' ? 'normal' : cave);

/** Whether `dragon` could ever count as a parent for this kind of breeding. */
const canParentIn = (dragon: Dragon, breeding: Breeding) =>
  dragon.canBeParent && (breeding === 'normal' || formsOf(dragon).includes('rift'));

/**
 * The form a Dragon is listed in. Rift breeding: its Rift form (or itself).
 * Normal breeding: normal form, unless it's owned only in Rift form.
 */
function listedForm(world: World, dragon: Dragon, breeding: Breeding): Form {
  if (breeding === 'rift') return formFor(dragon, 'rift');
  const normal = formFor(dragon, 'normal');
  return isOwned(world.collection, dragon, normal) || !isOwned(world.collection, dragon) ? normal : formFor(dragon, 'rift');
}

function listed(world: World, dragon: Dragon, breeding: Breeding): Listed {
  return { dragon, form: listedForm(world, dragon, breeding), ticks: ticks(world.collection, dragon) };
}

/** A Dragon the player could get, in the form that would count here. */
function candidate(world: World, cave: Cave, dragon: Dragon, breeding: Breeding): Candidate {
  const form = formFor(dragon, breeding);
  return {
    dragon,
    form,
    ticks: ticks(world.collection, dragon),
    breedableNow: breedableNow(world, cavesFor(form, cave)).has(dragon.name),
    available: world.available.has(dragon.name),
  };
}

/** The basic-dragon order: fewest `breedingElements`, ties to the lowest `order`. */
const simplerFirst = (a: Dragon, b: Dragon) =>
  a.breedingElements.length - b.breedingElements.length || a.order - b.order;

/** Breedable now first, then Available, then not Available; then the basic-dragon order. */
const byCandidateOrder = (a: Candidate, b: Candidate) =>
  Number(b.breedableNow) - Number(a.breedableNow) ||
  Number(b.available) - Number(a.available) ||
  simplerFirst(a.dragon, b.dragon);

/** A `self-or-opposite-hybrid` Bred Route's named parent, else undefined. */
const partnerParent = (route: Route): string | undefined =>
  route.kind === 'bred' && route.requirement.partner ? route.requirement.parents?.[0] : undefined;

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

function joinAnd(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
