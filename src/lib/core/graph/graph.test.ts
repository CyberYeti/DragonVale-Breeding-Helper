import { describe, expect, it } from 'vitest';
import type { Dragon } from '../../snapshot';
import type { Cave } from '../breeding';
import type { Form } from '../collection';
import {
  bred,
  dragon,
  evolved,
  limited,
  primaries,
  primary,
  purchased,
  realCast,
  riftDragon,
  summoned,
  world,
  type Owned,
  type OverlaySpec,
} from '../testing/fixtures';
import {
  focusTree,
  type BadgeKind,
  type DragonNode,
  type ElementNode,
  type GraphEdge,
  type GraphModel,
  type GraphNode,
  type RouteNode,
} from './index';

// ---- Helpers (read the model only through its public shape) -------------------

type Spec = { dragons: Dragon[]; owned?: Owned; overlay?: OverlaySpec };

function focus(spec: Spec, name: string, form: Form = 'normal', cave: Cave = 'normal'): GraphModel {
  const w = world({ dragons: spec.dragons, owned: spec.owned, overlay: spec.overlay });
  return focusTree(w, { dragon: name, form }, cave);
}

const node = (m: GraphModel, id: string): GraphNode | undefined => m.nodes.find((n) => n.id === id);

function dragonNode(m: GraphModel, name: string, form?: Form): DragonNode {
  const found = m.nodes.filter(
    (n): n is DragonNode => n.kind === 'dragon' && n.dragon === name && (form === undefined || n.form === form),
  );
  expect(found, `one node for ${name}`).toHaveLength(1);
  return found[0]!;
}

const hasDragon = (m: GraphModel, name: string) => m.nodes.some((n) => n.kind === 'dragon' && n.dragon === name);

const routesOf = (m: GraphModel, owner: DragonNode): RouteNode[] =>
  m.nodes.filter((n): n is RouteNode => n.kind === 'route' && n.owner === owner.id);

function onlyRoute(m: GraphModel, owner: DragonNode): RouteNode {
  const routes = routesOf(m, owner);
  expect(routes).toHaveLength(1);
  return routes[0]!;
}

/** The edges into a Route pill, i.e. what it needs. */
const inputs = (m: GraphModel, route: RouteNode): GraphEdge[] => m.edges.filter((e) => e.target === route.id);

const inputNodes = (m: GraphModel, route: RouteNode): GraphNode[] => inputs(m, route).map((e) => node(m, e.source)!);

const outEdge = (m: GraphModel, route: RouteNode): GraphEdge => m.edges.find((e) => e.source === route.id)!;

const kinds = (badges: readonly { kind: BadgeKind }[]) => badges.map((b) => b.kind);

const describeInputs = (m: GraphModel, route: RouteNode) =>
  inputNodes(m, route)
    .map((n) => (n.kind === 'dragon' ? n.dragon : n.kind === 'element' ? `[${n.element}]` : n.kind === 'friend' ? n.label : n.kind === 'rule' ? n.label : n.id))
    .sort();

/** Every edge points into a Route pill or out of one into its Dragon. */
function expectWellFormed(m: GraphModel) {
  const ids = new Set(m.nodes.map((n) => n.id));
  expect(ids.size).toBe(m.nodes.length);
  expect(new Set(m.edges.map((e) => e.id)).size).toBe(m.edges.length);
  for (const e of m.edges) {
    expect(ids.has(e.source) && ids.has(e.target), e.id).toBe(true);
    const target = node(m, e.target)!;
    if (e.kind === 'route') expect(target.kind).toBe('dragon');
    else expect(target.kind).toBe('route');
  }
  // Element, rule and friend nodes are leaves.
  for (const n of m.nodes) {
    if (n.kind === 'element' || n.kind === 'rule' || n.kind === 'friend') {
      expect(m.edges.some((e) => e.target === n.id), `${n.id} is a leaf`).toBe(false);
    }
  }
}

// ---- Cast ---------------------------------------------------------------------

const flower = () => dragon({ name: 'Flower', elements: ['Plant', 'Fire'] });
const lava = () => dragon({ name: 'Lava', elements: ['Fire', 'Earth'] });
const seasonal = () =>
  dragon({
    name: 'Seasonal',
    rarity: 'Epic',
    elements: ['Seasonal'],
    breedingElements: ['Air', 'Fire', 'Plant', 'Seasonal'],
    routes: [bred(['Air', 'Fire', 'Plant'], { conditions: { time: 'Day' } })],
  });

// ---- Rule 1: every Route of the Target is shown ---------------------------------

describe('rule 1: every Route of the Target', () => {
  const twoRoutes = () =>
    dragon({
      name: 'Twin',
      elements: ['Fire', 'Earth'],
      routes: [bred(['Fire', 'Earth']), bred(['Plant', 'Metal']), purchased(), summoned(['Orb'])],
    });

  it('draws a pill per Bred Route and highlights the met ones', () => {
    const m = focus({ dragons: [...primaries(), twoRoutes()], owned: ['Fire', 'Earth', 'Plant', 'Metal'] }, 'Twin');
    expectWellFormed(m);
    const routes = routesOf(m, dragonNode(m, 'Twin'));
    expect(routes.map((r) => r.routeIndex)).toEqual([0, 1]);
    const [fireEarth, plantMetal] = routes as [RouteNode, RouteNode];
    expect(fireEarth.met).toBe(true);
    expect(fireEarth.state).toBe('met');
    expect(outEdge(m, fireEarth).state).toBe('met');
    expect(inputs(m, fireEarth).every((e) => e.state === 'met')).toBe(true);
    // Plant + Metal are opposites: covered, but no Valid pair.
    expect(plantMetal.met).toBe(false);
    expect(plantMetal.state).toBe('normal');
    expect(kinds(outEdge(m, plantMetal).badges)).toContain('no-valid-pair');
  });

  it('puts Purchased and Summoned on the Target as badges, not branches', () => {
    const m = focus({ dragons: [...primaries(), twoRoutes()] }, 'Twin');
    const twin = dragonNode(m, 'Twin');
    expect(kinds(twin.badges)).toEqual(['purchased', 'summoned']);
    expect(twin.badges.find((b) => b.kind === 'summoned')!.label).toBe('Summoned with Orb');
    expect(routesOf(m, twin)).toHaveLength(2);
  });

  it('draws the requirement exactly as written, with rule nodes and condition badges', () => {
    const rainbow = dragon({ name: 'Rainbow', rarity: 'Epic', elements: ['Rainbow'], routes: [bred({ minDistinctElements: 4 })] });
    const motley = dragon({ name: 'Motley', elements: ['Plant'], routes: [bred({ anyPair: true })] });
    const snowflake = dragon({
      name: 'Snowflake',
      rarity: 'Epic',
      elements: ['Snowflake'],
      routes: [bred({ elements: ['Cold'], elementOnBothParents: 'Snowflake' }, { conditions: { weather: 'Snow', prerequisite: 'Own 3' } })],
    });
    const dragons = [...primaries(), rainbow, motley, snowflake];

    const r = focus({ dragons }, 'Rainbow');
    expect(describeInputs(r, onlyRoute(r, dragonNode(r, 'Rainbow')))).toEqual(['Any 4+ elements']);

    const mo = focus({ dragons }, 'Motley');
    expect(describeInputs(mo, onlyRoute(mo, dragonNode(mo, 'Motley')))).toEqual(['Any pair']);

    const s = focus({ dragons }, 'Snowflake');
    const pill = onlyRoute(s, dragonNode(s, 'Snowflake'));
    expect(describeInputs(s, pill)).toEqual(['[Cold]', '[Snowflake]']);
    const both = inputs(s, pill).find((e) => e.source.startsWith('element:Snowflake'))!;
    expect(kinds(both.badges)).toEqual(['both-parents']);
    expect(outEdge(s, pill).badges.filter((b) => b.kind === 'condition').map((b) => b.label)).toEqual([
      'Weather: Snow',
      'Needs: Own 3',
    ]);
  });
});

// ---- Rule 2: a Route is met by a Valid pair -------------------------------------

describe('rule 2: met means a Valid pair', () => {
  it('Seasonal is not met when Air, Fire and Plant are covered only across three Dragons', () => {
    const m = focus({ dragons: [...primaries(), seasonal()], owned: ['Air', 'Fire', 'Plant'] }, 'Seasonal');
    const pill = onlyRoute(m, dragonNode(m, 'Seasonal'));
    expect(pill.met).toBe(false);
    const elements = inputNodes(m, pill) as ElementNode[];
    expect(elements.map((e) => [e.element, e.covered])).toEqual([
      ['Air', true],
      ['Fire', true],
      ['Plant', true],
    ]);
    expect(kinds(outEdge(m, pill).badges)).toEqual(['no-valid-pair', 'condition']);
  });

  it('Seasonal is met by Flower + Air', () => {
    const m = focus({ dragons: [...primaries(), flower(), seasonal()], owned: ['Air', 'Flower'] }, 'Seasonal');
    const pill = onlyRoute(m, dragonNode(m, 'Seasonal'));
    expect(pill.met).toBe(true);
    expect(kinds(outEdge(m, pill).badges)).toEqual(['condition']);
    expect(m.target!.breedableNow).toBe(true);
    expect(m.target!.reasons).toEqual([]);
  });

  it('marks Elements no parent carries as missing, and no "No valid pair yet"', () => {
    const m = focus({ dragons: [...primaries(), seasonal()], owned: ['Air'] }, 'Seasonal');
    const pill = onlyRoute(m, dragonNode(m, 'Seasonal'));
    const covered = (inputNodes(m, pill) as ElementNode[]).map((e) => e.covered);
    expect(covered).toEqual([true, false, false]);
    expect(kinds(outEdge(m, pill).badges)).not.toContain('no-valid-pair');
  });
});

// ---- Rule 3: expansion -----------------------------------------------------------

describe('rule 3: only missing named parents expand', () => {
  const cast = () => [
    ...primaries(),
    flower(),
    lava(),
    dragon({ name: 'Ember', elements: ['Fire'], routes: [bred({ parents: ['Lava'], elements: ['Fire'] })] }),
    dragon({ name: 'Blaze', elements: ['Fire'], routes: [bred({ parents: ['Ember', 'Flower'] })] }),
  ];

  it('expands missing named parents recursively and stops at owned ones', () => {
    const m = focus({ dragons: cast(), owned: ['Flower'] }, 'Blaze');
    expectWellFormed(m);
    const blaze = onlyRoute(m, dragonNode(m, 'Blaze'));
    expect(describeInputs(m, blaze)).toEqual(['Ember', 'Flower']);

    const flowerNode = dragonNode(m, 'Flower');
    expect(flowerNode.owned).toBe(true);
    expect(flowerNode.expanded).toBe(false);
    expect(routesOf(m, flowerNode)).toEqual([]);

    const ember = dragonNode(m, 'Ember');
    expect(ember.owned).toBe(false);
    expect(ember.expanded).toBe(true);
    expect(describeInputs(m, onlyRoute(m, ember))).toEqual(['Lava', '[Fire]']);

    const lavaNode = dragonNode(m, 'Lava');
    expect(lavaNode.expanded).toBe(true);
    expect(describeInputs(m, onlyRoute(m, lavaNode))).toEqual(['[Earth]', '[Fire]']);
  });

  it('keeps Elements as leaves: no basic dragon, pair or suggestion is drawn', () => {
    const m = focus({ dragons: cast() }, 'Lava');
    expect(m.nodes.map((n) => n.kind).sort()).toEqual(['dragon', 'element', 'element', 'route']);
    expect(hasDragon(m, 'Fire')).toBe(false);
    expect(hasDragon(m, 'Earth')).toBe(false);
  });

  it('shares one Element hub between Routes', () => {
    const m = focus({ dragons: cast() }, 'Blaze');
    const fire = m.nodes.filter((n) => n.kind === 'element' && n.element === 'Fire');
    expect(fire).toHaveLength(1);
    expect(m.edges.filter((e) => e.source === fire[0]!.id)).toHaveLength(3); // into Ember's, Flower's and Lava's pills
  });

  it('a parent counts as owned in either form for Normal breeding', () => {
    const m = focus({ dragons: cast(), owned: { Flower: 'rift' } }, 'Blaze');
    expect(dragonNode(m, 'Flower').owned).toBe(true);
  });

  it('stops at a dead end: a parent that can only be Summoned or Purchased', () => {
    const dragons = [
      ...primaries(),
      dragon({ name: 'Kairos', rarity: 'Legendary', elements: ['Time'], routes: [summoned(['Clock'])] }),
      dragon({ name: 'Fire Rift', elements: ['Fire', 'Rift'], traits: { kind: 'fixed', element: 'Fire' }, routes: [purchased()] }),
      dragon({ name: 'Chronos', elements: ['Time'], routes: [bred({ parents: ['Kairos', 'Fire Rift'] })] }),
    ];
    const m = focus({ dragons }, 'Chronos');
    expectWellFormed(m);
    for (const name of ['Kairos', 'Fire Rift']) {
      const n = dragonNode(m, name);
      expect(routesOf(m, n)).toEqual([]);
      expect(kinds(n.badges)).toContain('dead-end');
    }
  });

  it('draws an extra edge to a Dragon already in the view and handles cycles (Chrysalis family)', () => {
    const dragons = [
      ...primaries(),
      dragon({ name: 'Chrysalis', elements: ['Plant'], routes: [bred({ parents: ['Butterfly'] }), bred({ parents: ['Moth'] })] }),
      dragon({ name: 'Butterfly', elements: ['Plant'], routes: [bred({ parents: ['Moth'] })] }),
      dragon({ name: 'Moth', elements: ['Plant'], routes: [bred({ parents: ['Chrysalis'] })] }),
    ];
    const m = focus({ dragons }, 'Chrysalis');
    expectWellFormed(m);
    expect(m.nodes.filter((n) => n.kind === 'dragon').map((n) => (n as DragonNode).dragon)).toEqual([
      'Chrysalis',
      'Butterfly',
      'Moth',
    ]);
    const moth = dragonNode(m, 'Moth');
    // Moth feeds Butterfly's Route and Chrysalis's second Route: one node, two edges.
    expect(m.edges.filter((e) => e.source === moth.id)).toHaveLength(2);
    // The cycle back to the Target is an edge into Moth's Route, not a new node.
    expect(describeInputs(m, onlyRoute(m, moth))).toEqual(['Chrysalis']);
  });
});

// ---- Rule 4: Evolved ---------------------------------------------------------------

describe('rule 4: evolves-from leads to the base Dragon', () => {
  const ghostly = () =>
    dragon({ name: 'Ghostly Lava', elements: ['Fire'], traits: 'none', routes: [evolved('Lava', ['Haunted Shrine'])] });

  it('expands a missing base as normal', () => {
    const m = focus({ dragons: [...primaries(), lava(), ghostly()] }, 'Ghostly Lava');
    expectWellFormed(m);
    const pill = onlyRoute(m, dragonNode(m, 'Ghostly Lava'));
    expect(pill.routeKind).toBe('evolved');
    const [edge] = inputs(m, pill);
    expect(edge!.kind).toBe('evolves-from');
    expect(edge!.badges.map((b) => b.label)).toEqual(['Evolves with Haunted Shrine']);
    const base = dragonNode(m, 'Lava');
    expect(base.expanded).toBe(true);
    expect(describeInputs(m, onlyRoute(m, base))).toEqual(['[Earth]', '[Fire]']);
    expect(m.target!.reasons.map((r) => r.label)).toEqual(['Evolution only']);
  });

  it('stops at an owned base and meets the Route', () => {
    const m = focus({ dragons: [...primaries(), lava(), ghostly()], owned: ['Lava'] }, 'Ghostly Lava');
    const pill = onlyRoute(m, dragonNode(m, 'Ghostly Lava'));
    expect(pill.state).toBe('met');
    expect(dragonNode(m, 'Lava').expanded).toBe(false);
  });
});

// ---- Rule 5: Purchase only --------------------------------------------------------

describe('rule 5: a Purchase only Route shows its parents but does not expand them', () => {
  const dragons = () => [
    ...primaries(),
    lava(),
    flower(),
    limited({ name: 'Haystack', elements: ['Plant', 'Earth'], routes: [bred({ parents: ['Lava', 'Flower'] })] }),
  ];
  const overlay: OverlaySpec = { events: [{ shop: [{ dragon: 'Haystack', breedable: false }] }] };

  it('locks the Route and leaves its parents unexpanded', () => {
    const m = focus({ dragons: dragons(), overlay }, 'Haystack');
    expectWellFormed(m);
    const pill = onlyRoute(m, dragonNode(m, 'Haystack'));
    expect(pill.state).toBe('locked');
    expect(outEdge(m, pill).badges.map((b) => b.label)).toEqual(['🔒 Purchase only']);
    expect(describeInputs(m, pill)).toEqual(['Flower', 'Lava']);
    expect(dragonNode(m, 'Lava').expanded).toBe(false);
    expect(dragonNode(m, 'Flower').expanded).toBe(false);
    expect(m.target!.reasons.map((r) => r.kind)).toEqual(['purchase-only', 'not-met']);
  });

  it('still highlights a met Route as locked, and is never Breedable now', () => {
    const m = focus({ dragons: dragons(), overlay, owned: ['Lava', 'Flower'] }, 'Haystack');
    const pill = onlyRoute(m, dragonNode(m, 'Haystack'));
    expect(pill.met).toBe(true);
    expect(pill.state).toBe('locked');
    expect(m.target!.breedableNow).toBe(false);
  });
});

// ---- Rule 6: missing limited parent that isn't Available ------------------------------

describe('rule 6: a missing limited parent that is not Available', () => {
  const dragons = () => [
    ...primaries(),
    flower(),
    limited({ name: 'Love', elements: ['Plant', 'Light'] }),
    dragon({ name: 'Heart', elements: ['Light'], routes: [bred({ parents: ['Love', 'Flower'] })] }),
  ];

  it('dims the Route with "Not available", locks that Dragon and keeps expanding it', () => {
    const m = focus({ dragons: dragons() }, 'Heart');
    expectWellFormed(m);
    const pill = onlyRoute(m, dragonNode(m, 'Heart'));
    expect(pill.state).toBe('dimmed');
    expect(outEdge(m, pill).badges).toContainEqual({ kind: 'not-available', dragons: ['Love'], label: 'Not available' });
    expect(inputs(m, pill).every((e) => e.state === 'dimmed')).toBe(true);
    const love = dragonNode(m, 'Love');
    expect(love.state).toBe('locked');
    expect(love.expanded).toBe(true);
    expect(describeInputs(m, onlyRoute(m, love))).toEqual(['[Light]', '[Plant]']);
    // Flower isn't limited: a normal missing parent.
    expect(dragonNode(m, 'Flower').state).toBe('normal');
  });

  it('is a normal Route when the limited parent is Available or owned', () => {
    const inRotation = focus({ dragons: dragons(), overlay: { rotation: ['Love'] } }, 'Heart');
    expect(onlyRoute(inRotation, dragonNode(inRotation, 'Heart')).state).toBe('normal');
    expect(dragonNode(inRotation, 'Love').state).toBe('normal');

    const owned = focus({ dragons: dragons(), owned: ['Love', 'Flower'] }, 'Heart');
    expect(onlyRoute(owned, dragonNode(owned, 'Heart')).state).toBe('met');
    expect(dragonNode(owned, 'Love').state).toBe('normal');
  });
});

// ---- Rule 7: Targets that can't be bred -----------------------------------------------

describe("rule 7: Targets that can't be bred", () => {
  it('gives a Summoned Target a dead-end badge and its reason', () => {
    const kairos = dragon({ name: 'Kairos', rarity: 'Legendary', elements: ['Time'], traits: 'none', routes: [summoned(['Clock'])] });
    const m = focus({ dragons: [...primaries(), kairos] }, 'Kairos');
    expect(m.nodes).toHaveLength(1);
    expect(kinds(dragonNode(m, 'Kairos').badges)).toEqual(['summoned', 'dead-end']);
    expect(m.target!.reasons.map((r) => r.label)).toEqual(['Summoning only']);
  });

  it('words the reason as the tile banner does on mixed Routes', () => {
    const odd = dragon({ name: 'Odd', elements: ['Fire'], traits: 'none', routes: [evolved('Fire'), purchased()] });
    const m = focus({ dragons: [...primaries(), odd] }, 'Odd');
    expect(m.target!.reasons.map((r) => r.label)).toEqual(['Evolution only']);
  });

  it('dims a Target that is not Available and says so', () => {
    const love = limited({ name: 'Love', elements: ['Plant', 'Light'] });
    const m = focus({ dragons: [...primaries(), love], owned: ['Plant', 'Light'] }, 'Love');
    expect(dragonNode(m, 'Love').state).toBe('dimmed');
    expect(onlyRoute(m, dragonNode(m, 'Love')).state).toBe('met');
    expect(m.target!.reasons.map((r) => r.label)).toEqual(['Not available']);

    const available = focus({ dragons: [...primaries(), love], owned: ['Plant', 'Light'], overlay: { rotation: ['Love'] } }, 'Love');
    expect(dragonNode(available, 'Love').state).toBe('normal');
    expect(available.target!.breedableNow).toBe(true);
  });

  it('says why the chosen cave can not make it, and badges Routes the cave does not use', () => {
    const nebula = realCast().find((d) => d.name === 'Nebula')!;
    const m = focus({ dragons: [...primaries(), nebula], owned: ['Fire'] }, 'Nebula', 'normal', 'normal');
    const pill = onlyRoute(m, dragonNode(m, 'Nebula'));
    expect(pill.met).toBe(true);
    expect(outEdge(m, pill).badges.map((b) => b.label)).toEqual(['Co-op cave only']);
    expect(m.target!.reasons.map((r) => r.label)).toEqual(['Not breedable in Normal cave']);

    const inCoop = focus({ dragons: [...primaries(), nebula], owned: ['Fire'] }, 'Nebula', 'normal', 'coop');
    expect(outEdge(inCoop, onlyRoute(inCoop, dragonNode(inCoop, 'Nebula'))).badges).toEqual([]);
    expect(inCoop.target!.breedableNow).toBe(true);
  });

  it('says when no Route is met yet', () => {
    const m = focus({ dragons: [...primaries(), lava()] }, 'Lava');
    expect(m.target!.reasons).toEqual([{ kind: 'not-met', label: 'No Route is met from your Collection yet' }]);
    expect(m.target!.breedableNow).toBe(false);
  });
});

// ---- Rule 8: Owned Target -------------------------------------------------------------

describe('rule 8: an owned Target', () => {
  it('is shown the same way, with an Owned banner', () => {
    const cast = [...primaries(), lava()];
    const owned = focus({ dragons: cast, owned: ['Lava'] }, 'Lava');
    const missing = focus({ dragons: cast }, 'Lava');
    const target = dragonNode(owned, 'Lava');
    expect(target.owned).toBe(true);
    expect(target.expanded).toBe(true);
    expect(kinds(target.badges)).toEqual(['owned']);
    expect(owned.nodes.map((n) => n.id)).toEqual(missing.nodes.map((n) => n.id));
    expect(owned.target!.reasons.map((r) => r.kind)).toEqual(['owned']); // Lava + Lava meets its own Route
  });
});

// ---- Rule 9: the friend's node, and Dragons that can't be parents ------------------------

describe("rule 9: the friend's node", () => {
  it('is a separate node, never checked against the Collection or expanded', () => {
    const nebula = realCast().find((d) => d.name === 'Nebula')!;
    const m = focus({ dragons: [...primaries(), nebula], owned: ['Nebula'] }, 'Nebula', 'normal', 'coop');
    expectWellFormed(m);
    const pill = onlyRoute(m, dragonNode(m, 'Nebula'));
    expect(pill.routeKind).toBe('coop');
    const [edge] = inputs(m, pill);
    expect(edge!.kind).toBe('coop-only');
    expect(edge!.badges.map((b) => b.label)).toEqual(['+ any dragon']);
    const friend = node(m, edge!.source)!;
    expect(friend).toMatchObject({ kind: 'friend', dragon: 'Nebula', label: "Nebula (friend's)" });
    expect(m.edges.some((e) => e.target === friend.id)).toBe(false);
  });

  it('never draws a Dragon that cannot be a parent as one, and never meets its Route (rule 9)', () => {
    const gem = dragon({ name: 'Ruby', rarity: 'Gemstone', elements: ['Fire'], canBeParent: false, routes: [bred(['Fire'])] });
    const odd = dragon({ name: 'Odd', elements: ['Fire'], routes: [bred({ elements: ['Fire'], parents: ['Ruby'] })] });
    // Owning Ruby doesn't help: it still can't be a parent.
    const m = focus({ dragons: [...primaries(), gem, odd], owned: ['Fire', 'Ruby'] }, 'Odd');
    expectWellFormed(m);
    expect(hasDragon(m, 'Ruby')).toBe(false);
    const pill = onlyRoute(m, dragonNode(m, 'Odd'));
    expect(pill.met).toBe(false);
    expect(pill.state).not.toBe('met');
    expect(describeInputs(m, pill)).toEqual(['[Fire]']);
    const out = outEdge(m, pill);
    expect(kinds(out.badges)).toContain('cannot-be-parent');
    expect(out.badges.map((b) => b.label)).toContain("Needs Ruby, which can't be a parent");
  });
});

// ---- Rift form Targets ---------------------------------------------------------------

describe('a Rift form Target', () => {
  const cast = () => [
    ...primaries(),
    lava(),
    dragon({ name: 'Magma', elements: ['Fire', 'Earth'], routes: [bred({ parents: ['Lava'], elements: ['Fire'] })] }),
  ];

  it('counts only Rift breeding parents and expands parents in their Rift form', () => {
    const m = focus({ dragons: cast(), owned: { Lava: 'normal', Fire: true } }, 'Magma', 'rift', 'rift');
    expectWellFormed(m);
    const target = dragonNode(m, 'Magma', 'rift');
    expect(m.target).toMatchObject({ node: target.id, form: 'rift', owned: false });
    const pill = onlyRoute(m, target);
    expect(pill.met).toBe(false);
    // Lava is owned only in normal form, so as a Rift breeding parent it is missing.
    const lavaNode = dragonNode(m, 'Lava', 'rift');
    expect(lavaNode.owned).toBe(false);
    expect(lavaNode.expanded).toBe(true);
    // Fire (a primary) has no Rift form: it never counts for Rift breeding.
    const fire = inputNodes(m, pill).find((n): n is ElementNode => n.kind === 'element')!;
    expect(fire).toMatchObject({ element: 'Fire', breeding: 'rift', covered: false });
    expect(m.target!.reasons.map((r) => r.kind)).toEqual(['not-met']);
  });

  it('stops at a parent owned in Rift form', () => {
    const m = focus({ dragons: cast(), owned: { Lava: 'rift' } }, 'Magma', 'rift', 'rift');
    expect(dragonNode(m, 'Lava', 'rift').owned).toBe(true);
    expect(onlyRoute(m, dragonNode(m, 'Magma', 'rift')).met).toBe(true);
  });

  it('a Rift dragon is targeted as itself, with Rift form parents', () => {
    const m = focus({ dragons: realCast(), owned: { 'Blue Fire': 'normal', Plasma: 'rift' } }, 'Zaffer', 'normal', 'normal');
    const zaffer = dragonNode(m, 'Zaffer');
    expect(zaffer.form).toBe('rift');
    const pill = onlyRoute(m, zaffer);
    expect(describeInputs(m, pill)).toEqual(['Blue Fire', 'Plasma']);
    expect(dragonNode(m, 'Blue Fire')).toMatchObject({ form: 'rift', owned: false, expanded: true });
    expect(dragonNode(m, 'Plasma')).toMatchObject({ form: 'rift', owned: true, expanded: false });
    expect(outEdge(m, pill).badges.map((b) => b.label)).toEqual(['Rift cave only']);
    expect(m.target!.reasons.map((r) => r.label)).toEqual(['Not breedable in Normal cave']);
  });

  it('a normal-form tree draws a Rift dragon parent with its Rift breeding Route', () => {
    const kampos = riftDragon({ name: 'Kampos', elements: ['Water'], trait: 'Water' });
    const child = dragon({ name: 'Tide', elements: ['Water'], routes: [bred({ parents: ['Kampos'], elements: ['Water'] })] });
    const m = focus({ dragons: [...primaries(), kampos, child], owned: ['Water'] }, 'Tide');
    const k = dragonNode(m, 'Kampos', 'rift');
    expect(k.expanded).toBe(true);
    const el = inputNodes(m, onlyRoute(m, k)).find((n): n is ElementNode => n.kind === 'element')!;
    expect(el).toMatchObject({ element: 'Water', breeding: 'rift', covered: false });
    // The Target's own Route uses Normal breeding: a different hub.
    const own = inputNodes(m, onlyRoute(m, dragonNode(m, 'Tide'))).find((n): n is ElementNode => n.kind === 'element')!;
    expect(own).toMatchObject({ element: 'Water', breeding: 'normal', covered: true });
  });
});

describe('focusTree', () => {
  it('throws for a Dragon the snapshot does not have', () => {
    expect(() => focusTree(world(), { dragon: 'Nope', form: 'normal' }, 'normal')).toThrow(/Nope/);
  });

  it('uses the one form of a single-form Dragon whatever form is asked for', () => {
    const m = focusTree(world({ dragons: [primary('Fire')] }), { dragon: 'Fire', form: 'rift' }, 'rift');
    expect(m.target!.form).toBe('normal');
    expect(m.target!.reasons.map((r) => r.label)).toEqual(['Not breedable in Rift cave']);
  });
});
