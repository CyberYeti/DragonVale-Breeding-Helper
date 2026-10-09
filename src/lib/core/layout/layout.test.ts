import { describe, expect, it } from 'vitest';
import type { Dragon } from '../../snapshot';
import type { Form } from '../collection';
import { focusTree, tabGraph, type GraphModel, type GraphNodeKind } from '../graph';
import { bred, dragon, primaries, realCast, world, type Owned } from '../testing/fixtures';
import { BIG_GRAPH_NODES, layout, type Layout, type LayoutInput } from './index';

// ---- Helpers ------------------------------------------------------------------

// Rough drawn sizes per node kind: a full tile, an Element, a Route pill, a rule, a friend.
const SIZES: Record<GraphNodeKind, { width: number; height: number }> = {
  dragon: { width: 96, height: 136 },
  element: { width: 40, height: 40 },
  route: { width: 24, height: 24 },
  rule: { width: 90, height: 28 },
  friend: { width: 90, height: 40 },
};

/** What the UI adapter does: a GraphModel's ids, sizes and edges. */
const toInput = (m: GraphModel, sizes = SIZES): LayoutInput => ({
  nodes: m.nodes.map((n) => ({ id: n.id, ...sizes[n.kind] })),
  edges: m.edges.map((e) => ({ source: e.source, target: e.target })),
  top: m.target?.node ?? null,
});

function focus(dragons: Dragon[], name: string, owned: Owned = [], form: Form = 'normal'): GraphModel {
  return focusTree(world({ dragons, owned }), { dragon: name, form }, 'normal');
}

/** The vertical centre of a node: smaller is higher. */
function centreY(input: LayoutInput, placed: Layout, id: string): number {
  const node = input.nodes.find((n) => n.id === id)!;
  return placed.positions.get(id)!.y + node.height / 2;
}

const downwardEdges = (input: LayoutInput, placed: Layout) =>
  input.edges.filter((e) => centreY(input, placed, e.source) <= centreY(input, placed, e.target));

function expectTopHighest(input: LayoutInput, placed: Layout) {
  const top = centreY(input, placed, input.top!);
  for (const n of input.nodes) {
    if (n.id !== input.top) expect(centreY(input, placed, n.id), n.id).toBeGreaterThan(top);
  }
}

function expectNoOverlap(input: LayoutInput, placed: Layout) {
  const boxes = input.nodes.map((n) => ({ id: n.id, ...placed.positions.get(n.id)!, w: n.width, h: n.height }));
  for (const [i, a] of boxes.entries()) {
    for (const b of boxes.slice(i + 1)) {
      const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
      expect(apart, `${a.id} overlaps ${b.id}`).toBe(true);
    }
  }
}

const flower = () => dragon({ name: 'Flower', elements: ['Plant', 'Fire'] });
const lava = () => dragon({ name: 'Lava', elements: ['Fire', 'Earth'], routes: [bred(['Earth', 'Fire'])] });
const blazeCast = () => [
  ...primaries(),
  flower(),
  lava(),
  dragon({ name: 'Ember', elements: ['Fire'], routes: [bred({ parents: ['Lava'], elements: ['Fire'] })] }),
  dragon({ name: 'Blaze', elements: ['Fire'], routes: [bred({ parents: ['Ember', 'Flower'] })] }),
];

// ---- Bottom-up ---------------------------------------------------------------------

describe('layout of a Focus tree', () => {
  const trees: [string, GraphModel][] = [
    ['Blaze, three generations deep', focus(blazeCast(), 'Blaze', ['Flower'])],
    ['Rainbow, with a rule node', focus(realCast(), 'Rainbow')],
    ['Nebula, with a friend node', focus(realCast(), 'Nebula')],
    ['Zaffer in Rift form', focus(realCast(), 'Zaffer', [], 'rift')],
    ['Fire, a primary whose Route pill needs nothing drawn', focus(realCast(), 'Fire')],
    ['Air, whose primary parents breed only from themselves', focus(realCast(), 'Air')],
  ];

  it.each(trees)('%s: every edge points up and the Target is highest', (_, m) => {
    expect(m.edges.length).toBeGreaterThan(0);
    const input = toInput(m);
    const placed = layout(input);
    expect([...placed.positions.keys()].sort()).toEqual(input.nodes.map((n) => n.id).sort());
    expect(downwardEdges(input, placed)).toEqual([]);
    expectTopHighest(input, placed);
    expectNoOverlap(input, placed);
  });

  it('stays bottom-up with lite (square) tiles', () => {
    const input = toInput(focus(blazeCast(), 'Blaze', ['Flower']), { ...SIZES, dragon: { width: 64, height: 64 } });
    const placed = layout(input);
    expect(downwardEdges(input, placed)).toEqual([]);
    expectTopHighest(input, placed);
  });
});

describe('layout without a top node', () => {
  it('keeps a cycle in a tab graph; only the edge closing it points down (Chrysalis family)', () => {
    const w = world({
      dragons: [
        ...primaries(),
        dragon({ name: 'Chrysalis', elements: ['Plant'], routes: [bred({ parents: ['Butterfly'] }), bred({ parents: ['Moth'] })] }),
        dragon({ name: 'Butterfly', elements: ['Plant'], routes: [bred({ parents: ['Moth'] })] }),
        dragon({ name: 'Moth', elements: ['Plant'], routes: [bred({ parents: ['Chrysalis'] })] }),
      ],
    });
    const m = tabGraph(w, ['Chrysalis', 'Butterfly', 'Moth'], 'normal');
    const input = toInput(m);
    const placed = layout(input);
    expect(downwardEdges(input, placed)).toHaveLength(1);
    expectNoOverlap(input, placed);
  });

  it('places an acyclic graph bottom-up, newest on top', () => {
    const input: LayoutInput = {
      nodes: ['Fire', 'Earth', 'r1', 'Lava', 'r2', 'Ember'].map((id) => ({ id, width: 50, height: 30 })),
      edges: [
        { source: 'Fire', target: 'r1' },
        { source: 'Earth', target: 'r1' },
        { source: 'r1', target: 'Lava' },
        { source: 'Lava', target: 'r2' },
        { source: 'Fire', target: 'r2' },
        { source: 'r2', target: 'Ember' },
      ],
    };
    const placed = layout(input);
    expect(downwardEdges(input, placed)).toEqual([]);
    expectTopHighest({ ...input, top: 'Ember' }, placed);
    expect(placed.width).toBeGreaterThan(0);
    expect(placed.height).toBeGreaterThan(0);
  });

  it(`stays bottom-up for a graph over ${BIG_GRAPH_NODES} nodes (the faster ranking)`, () => {
    // 10 Element hubs; each Dragon has a Route pill fed by two hubs and, after
    // the first few, by an older Dragon: like the All Dragons tab graph.
    const nodes: LayoutInput['nodes'][number][] = [];
    const edges: LayoutInput['edges'][number][] = [];
    for (let e = 0; e < 10; e++) nodes.push({ id: `e${e}`, width: 40, height: 40 });
    for (let d = 0; d < 600; d++) {
      nodes.push({ id: `r${d}`, width: 50, height: 20 }, { id: `d${d}`, width: 120, height: 150 });
      edges.push({ source: `e${d % 10}`, target: `r${d}` }, { source: `e${(d * 3 + 1) % 10}`, target: `r${d}` });
      if (d >= 20) edges.push({ source: `d${(d * 7) % d}`, target: `r${d}` });
      edges.push({ source: `r${d}`, target: `d${d}` });
    }
    expect(nodes.length).toBeGreaterThan(BIG_GRAPH_NODES);
    const input: LayoutInput = { nodes, edges };
    const placed = layout(input);
    expect(placed.positions.size).toBe(nodes.length);
    expect(downwardEdges(input, placed)).toEqual([]);
    // A big graph: past the 5s default when the whole suite runs at once.
  }, 30_000);

  it('throws for an edge to a node it was not given', () => {
    expect(() =>
      layout({ nodes: [{ id: 'a', width: 1, height: 1 }], edges: [{ source: 'a', target: 'b' }] }),
    ).toThrow(/unknown node b/);
  });
});
