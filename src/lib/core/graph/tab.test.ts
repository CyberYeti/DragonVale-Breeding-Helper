import { describe, expect, it } from 'vitest';
import type { Dragon, Rarity } from '../../snapshot';
import type { Cave } from '../breeding';
import { applyView, tabContents, type Tab } from '../menu';
import { bred, dragon, evolved, primaries, riftDragon, snapshot, world, type Owned, type OverlaySpec } from '../testing/fixtures';
import {
  focusTree,
  pullTree,
  tabGraph,
  type DragonNode,
  type GraphModel,
  type GraphNode,
  type RouteNode,
  type TabGraph,
} from './index';

// ---- Helpers ------------------------------------------------------------------

const PAGE = 'Test page';

type Spec = { dragons: Dragon[]; owned?: Owned; overlay?: OverlaySpec; page?: string[] };

function worldFor(spec: Spec) {
  const snap = snapshot(spec.dragons, {
    pages: [{ name: PAGE, group: 'epic', dragons: spec.page ?? [], icon: null }],
  });
  return world({ snapshot: snap, owned: spec.owned, overlay: spec.overlay });
}

const namesOf = (w: ReturnType<typeof worldFor>, tab: Tab, cave: Cave) =>
  tabContents(w, tab, cave).sections.flatMap((s) => s.items.map((i) => i.dragon.name));

const dragonNodes = (m: GraphModel) => m.nodes.filter((n): n is DragonNode => n.kind === 'dragon');

function dragonNode(m: GraphModel, name: string): DragonNode {
  const found = dragonNodes(m).filter((n) => n.dragon === name);
  expect(found, `one node for ${name}`).toHaveLength(1);
  return found[0]!;
}

const byId = (m: GraphModel) => new Map<string, GraphNode>(m.nodes.map((n) => [n.id, n]));

/** For every edge into a Route pill from a Dragon: [parent, Dragon the pill makes]. */
function parentEdges(m: GraphModel): [DragonNode, DragonNode][] {
  const nodes = byId(m);
  return m.edges.flatMap((e) => {
    const source = nodes.get(e.source);
    const pill = nodes.get(e.target);
    if (source?.kind !== 'dragon' || pill?.kind !== 'route') return [];
    return [[source, nodes.get((pill as RouteNode).owner) as DragonNode]];
  });
}

function expectWellFormed(m: GraphModel) {
  const ids = new Set(m.nodes.map((n) => n.id));
  expect(ids.size).toBe(m.nodes.length);
  expect(new Set(m.edges.map((e) => e.id)).size).toBe(m.edges.length);
  for (const e of m.edges) expect(ids.has(e.source) && ids.has(e.target), e.id).toBe(true);
}

/** Items with pullTree's additions (`pull`, `outside`) reset, to compare against `focusTree`'s. */
const strip = <T extends object>(items: readonly T[]) =>
  items.map((item) => ({ ...item, pull: undefined, ...('outside' in item ? { outside: false } : {}) }));

// ---- Cast ---------------------------------------------------------------------
//
// Generation 1: the primaries, Flower (Plant + Fire), Lava (Fire + Earth).
// Generation 2: Bloom (Flower + Water), Ember (Lava by name).
// Generation 3: Blossom (Bloom + Flower by name).
// Generation 4: Petal (evolved from Blossom).

const flower = () => dragon({ name: 'Flower', elements: ['Plant', 'Fire'] });
const lava = () => dragon({ name: 'Lava', elements: ['Fire', 'Earth'] });
const bloom = () =>
  dragon({ name: 'Bloom', elements: ['Plant', 'Fire', 'Water'], routes: [bred({ parents: ['Flower'], elements: ['Water'] })] });
const ember = () => dragon({ name: 'Ember', elements: ['Fire', 'Earth'], routes: [bred({ parents: ['Lava'] })] });
const blossom = () =>
  dragon({ name: 'Blossom', elements: ['Plant', 'Fire', 'Water'], routes: [bred({ parents: ['Bloom', 'Flower'] })] });
const petal = () => dragon({ name: 'Petal', elements: ['Plant'], routes: [evolved('Blossom', ['Vase'])] });

const cast = () => [...primaries(), flower(), lava(), bloom(), ember(), blossom(), petal()];

// ---- tabGraph -----------------------------------------------------------------

describe('tabGraph', () => {
  it("draws the tab's Dragons with all their Routes, plus the named parents they need from outside the tab", () => {
    const w = worldFor({ dragons: cast(), owned: ['Lava'], page: ['Blossom', 'Ember'] });
    const m = tabGraph(w, namesOf(w, { kind: 'page', page: PAGE }, 'normal'), 'normal');
    expectWellFormed(m);
    expect(m.target).toBeNull();
    expect(m.members).toEqual(['dragon:Blossom:normal', 'dragon:Ember:normal']);

    expect(dragonNode(m, 'Blossom')).toMatchObject({ outside: false, expanded: true });
    expect(dragonNode(m, 'Ember')).toMatchObject({ outside: false, expanded: true });
    // Missing parents from elsewhere expand, owned ones stay leaves; all are outside.
    expect(dragonNode(m, 'Bloom')).toMatchObject({ outside: true, expanded: true, owned: false });
    expect(dragonNode(m, 'Flower')).toMatchObject({ outside: true, expanded: true });
    expect(dragonNode(m, 'Lava')).toMatchObject({ outside: true, expanded: false, owned: true });
    // The Elements they need, as shared hubs.
    const elements = m.nodes.filter((n) => n.kind === 'element').map((n) => n.id).sort();
    expect(elements).toEqual(['element:Fire:normal', 'element:Plant:normal', 'element:Water:normal']);
    // Nothing the tab doesn't need.
    expect(m.nodes.some((n) => n.kind === 'dragon' && (n.dragon === 'Petal' || n.dragon === 'Metal'))).toBe(false);
  });

  it('expands an owned tab Dragon, and keeps a tab Dragon a member when another one names it', () => {
    const w = worldFor({ dragons: cast(), owned: ['Flower', 'Bloom'] });
    const m = tabGraph(w, ['Blossom', 'Bloom', 'Flower'], 'normal');
    expectWellFormed(m);
    for (const name of ['Blossom', 'Bloom', 'Flower']) {
      expect(dragonNode(m, name), name).toMatchObject({ outside: false, expanded: true });
    }
    expect(dragonNode(m, 'Bloom').badges.map((b) => b.kind)).toEqual(['owned']);
    // Blossom's parents are the member nodes themselves.
    const parents = parentEdges(m).filter(([, child]) => child.dragon === 'Blossom').map(([p]) => p.id);
    expect(parents.sort()).toEqual(['dragon:Bloom:normal', 'dragon:Flower:normal']);
  });

  it('gives every Dragon its generation, increasing upward along every edge', () => {
    const w = worldFor({ dragons: cast() });
    const all = cast().map((d) => d.name);
    const m = tabGraph(w, all, 'normal');
    expectWellFormed(m);
    const generation = Object.fromEntries(dragonNodes(m).map((n) => [n.dragon, n.generation]));
    expect(generation).toMatchObject({ Fire: 1, Flower: 1, Lava: 1, Bloom: 2, Ember: 2, Blossom: 3, Petal: 4 });
    const edges = parentEdges(m);
    expect(edges.length).toBeGreaterThan(0);
    for (const [parent, child] of edges) {
      expect(parent.generation, `${parent.dragon} under ${child.dragon}`).toBeLessThan(child.generation);
    }
  });

  it('gives the same generation in a Focus view, and survives a cycle', () => {
    const a = dragon({ name: 'Chrysalis', elements: ['Plant'], routes: [bred({ parents: ['Moth'] })] });
    const b = dragon({ name: 'Moth', elements: ['Plant'], routes: [bred({ parents: ['Chrysalis'] }), bred(['Plant'])] });
    const w = worldFor({ dragons: [...primaries(), a, b, ...cast().slice(10)] });
    const m = tabGraph(w, ['Chrysalis', 'Moth', 'Petal'], 'normal');
    expectWellFormed(m);
    const gens = dragonNodes(m).map((n) => n.generation);
    expect(gens.every((g) => Number.isInteger(g) && g >= 1)).toBe(true);
    // Only the edge that closes the cycle may fail to increase.
    const flat = parentEdges(m).filter(([p, c]) => p.generation >= c.generation);
    expect(flat.map(([p, c]) => `${p.dragon}>${c.dragon}`)).toHaveLength(1);
    const f = focusTree(w, { dragon: 'Petal', form: 'normal' }, 'normal');
    expect(dragonNode(f, 'Petal').generation).toBe(dragonNode(m, 'Petal').generation);
    expect(dragonNodes(f).every((n) => !n.outside)).toBe(true);
  });

  it('follows the cave: Rift forms with Rift breeding hubs in the Rift cave', () => {
    const kampos = riftDragon({ name: 'Kampos', elements: ['Water'], trait: 'Water' });
    const w = worldFor({ dragons: [...cast(), kampos] });
    const m = tabGraph(w, ['Bloom', 'Kampos'], 'rift');
    expectWellFormed(m);
    expect(m.members).toEqual(['dragon:Bloom:rift', 'dragon:Kampos:rift']);
    expect(dragonNode(m, 'Flower').form).toBe('rift');
    expect(m.nodes.filter((n) => n.kind === 'element').every((n) => n.kind === 'element' && n.breeding === 'rift')).toBe(true);
  });

  it('draws the Event tab as one graph, each Dragon once', () => {
    const overlay: OverlaySpec = {
      events: [
        { name: 'Spring', shop: ['Bloom', 'Ember'] },
        { name: 'Fall', shop: ['Ember', 'Petal'] },
      ],
    };
    const w = worldFor({ dragons: cast(), overlay });
    const m = tabGraph(w, namesOf(w, { kind: 'event' }, 'normal'), 'normal');
    expectWellFormed(m);
    expect(m.members).toEqual(['dragon:Bloom:normal', 'dragon:Ember:normal', 'dragon:Petal:normal']);
  });

  it("ignores the Show, Rarity and Breedable now filters: it's built from the whole tab", () => {
    const owned = ['Lava', 'Ember', 'Fire', 'Plant'];
    const dragons = cast().map((d) => (d.name === 'Bloom' ? { ...d, rarity: 'Epic' as Rarity } : d));
    const w = worldFor({ dragons, owned, page: ['Flower', 'Bloom', 'Ember', 'Blossom', 'Petal'] });
    const tab: Tab = { kind: 'page', page: PAGE };
    const sections = tabContents(w, tab, 'normal').sections;
    const filtered = applyView(
      sections,
      '',
      { breedableNow: true, show: 'not-owned', rarities: new Set<Rarity>(['Hybrid']) },
      { ownedForms: 'either' },
      w,
      'normal',
    );
    const shown = filtered.sections.flatMap((s) => s.items.map((i) => i.dragon.name));
    expect(shown).toEqual(['Flower']); // the filters hide most of the tab...

    const m = tabGraph(w, namesOf(w, tab, 'normal'), 'normal');
    // ...but the graph has every Dragon of the tab, the same whatever the filters.
    expect(m.members).toEqual(['Flower', 'Bloom', 'Ember', 'Blossom', 'Petal'].map((n) => `dragon:${n}:normal`));
    expect(tabGraph(w, namesOf(w, tab, 'normal'), 'normal')).toEqual(m);
  });

  it('throws for a Dragon the snapshot does not have', () => {
    expect(() => tabGraph(worldFor({ dragons: cast() }), ['Nope'], 'normal')).toThrow(/Nope/);
  });
});

// ---- pullTree -----------------------------------------------------------------

describe('a basic primary in a tab graph', () => {
  it('draws no self-loop: no edge from a Dragon into its own Route pill, in the tab graph or a pulled tree', () => {
    const w = worldFor({ dragons: cast(), owned: ['Flower'] });
    const graph = tabGraph(w, ['Fire', 'Lava', 'Flower'], 'normal');
    const pulled = pullTree(graph, { dragon: 'Fire', form: 'normal' });
    for (const m of [graph, pulled]) {
      expectWellFormed(m);
      expect(parentEdges(m).filter(([parent, made]) => parent.id === made.id)).toEqual([]);
    }
    const fire = dragonNode(pulled, 'Fire');
    const pill = pulled.nodes.find((n): n is RouteNode => n.kind === 'route' && n.owner === fire.id)!;
    expect(pill.pull).toBe('lit');
    expect(pulled.edges.filter((e) => e.target === pill.id)).toEqual([]);
  });
});

describe('pullTree', () => {
  const setup = () => {
    const w = worldFor({ dragons: cast(), owned: ['Flower'] });
    const graph: TabGraph = tabGraph(w, ['Blossom', 'Ember', 'Petal', 'Bloom'], 'normal');
    return { w, graph };
  };

  it('lights exactly the Focus path and fades the rest of the tab graph', () => {
    const { w, graph } = setup();
    const target = { dragon: 'Petal', form: 'normal' } as const;
    const pulled = pullTree(graph, target);
    const focus = focusTree(w, target, 'normal');
    expectWellFormed(pulled);

    const lit = pulled.nodes.filter((n) => n.pull === 'lit');
    const litEdges = pulled.edges.filter((e) => e.pull === 'lit');
    expect(new Set(lit.map((n) => n.id))).toEqual(new Set(focus.nodes.map((n) => n.id)));
    expect(new Set(litEdges.map((e) => e.id))).toEqual(new Set(focus.edges.map((e) => e.id)));
    // The lit items are the Focus view's own nodes and edges (Target on top, shared hubs).
    expect(strip(lit)).toEqual(expect.arrayContaining(strip(focus.nodes)));
    expect(strip(litEdges)).toEqual(expect.arrayContaining(strip(focus.edges)));
    expect(pulled.target).toEqual(focus.target);

    // Everything else in the tab graph is still there, faded.
    const litIds = new Set(lit.map((n) => n.id));
    for (const n of graph.nodes) {
      const there = pulled.nodes.find((p) => p.id === n.id)!;
      expect(there.pull, n.id).toBe(litIds.has(n.id) ? 'lit' : 'faded');
    }
    expect(pulled.nodes.every((n) => n.pull !== undefined)).toBe(true);
    expect(pulled.edges.every((e) => e.pull !== undefined)).toBe(true);
    // Ember's branch isn't on Petal's path.
    expect(dragonNode(pulled, 'Ember').pull).toBe('faded');
    expect(dragonNode(pulled, 'Blossom').pull).toBe('lit');
  });

  it("draws the tree by the Focus view rules, not the tab graph's", () => {
    const { graph } = setup();
    // Flower is owned, so it's a lit leaf in Bloom's tree, still marked outside the tab.
    const pulled = pullTree(graph, { dragon: 'Bloom', form: 'normal' });
    expect(dragonNode(pulled, 'Bloom')).toMatchObject({ pull: 'lit', outside: false });
    expect(dragonNode(pulled, 'Flower')).toMatchObject({ pull: 'lit', outside: true, owned: true });
    // Blossom's Route is not on Bloom's path.
    expect(pulled.nodes.find((n) => n.id === 'route:dragon:Blossom:normal:0')!.pull).toBe('faded');
  });

  it('adds Focus nodes the tab graph lacks, lit, after the tab graph', () => {
    // An owned parent is a leaf in the tab graph but expands as a Target.
    const w = worldFor({ dragons: cast(), owned: ['Flower', 'Lava'] });
    const g = tabGraph(w, ['Ember'], 'normal');
    expect(dragonNode(g, 'Lava').expanded).toBe(false);
    const pulled = pullTree(g, { dragon: 'Lava', form: 'normal' });
    expectWellFormed(pulled);
    const added = pulled.nodes.slice(g.nodes.length);
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((n) => n.pull === 'lit')).toBe(true);
    expect(dragonNode(pulled, 'Lava')).toMatchObject({ expanded: true, outside: true, pull: 'lit' });
  });

  it('leaves the tab graph unchanged and throws for an unknown Target', () => {
    const { graph } = setup();
    const before = structuredClone(graph.nodes);
    pullTree(graph, { dragon: 'Blossom', form: 'normal' });
    expect(graph.nodes).toEqual(before);
    expect(graph.nodes.every((n) => n.pull === undefined)).toBe(true);
    expect(() => pullTree(graph, { dragon: 'Nope', form: 'normal' })).toThrow(/Nope/);
  });
});
