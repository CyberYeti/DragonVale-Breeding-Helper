// The pure parts of flow.ts a move and a drag use: the fit box from where
// nodes are going, and the background edges split around a dragged node.
import { describe, expect, it } from 'vitest';
import type { GraphModel } from '../../lib/core/graph';
import type { Position } from '../../lib/core/layout';
import { backgroundPaths, loopEdges, loopPath, nodesBounds } from './flow';

const element = (id: string, pull?: 'lit' | 'faded') => ({ id, kind: 'element', pull }) as const;
const edge = (id: string, source: string, target: string, pull?: 'lit' | 'faded') =>
  ({ id, source, target, pull, state: 'normal', kind: 'needs', badges: [] }) as const;

const model = {
  nodes: [element('a', 'lit'), element('b', 'lit'), element('c', 'faded')],
  edges: [edge('ab', 'a', 'b', 'lit'), edge('bc', 'b', 'c', 'faded'), edge('ac', 'a', 'c', 'faded')],
  target: null,
} as unknown as GraphModel;

const positions = new Map<string, Position>([
  ['a', { x: 0, y: 0 }],
  ['b', { x: 100, y: 200 }],
  ['c', { x: 1000, y: -50 }],
]);

describe('nodesBounds', () => {
  it('boxes the picked nodes at their laid-out sizes (an Element is 56 x 64)', () => {
    expect(nodesBounds(model, positions)).toEqual({ x: 0, y: -50, width: 1056, height: 314 });
    expect(nodesBounds(model, positions, (n) => n.pull === 'lit')).toEqual({ x: 0, y: 0, width: 156, height: 264 });
    expect(nodesBounds(model, positions, () => false)).toBeNull();
  });
});

describe('backgroundPaths', () => {
  it('draws only edges that are not lit, and can split them by a filter', () => {
    const all = backgroundPaths(model, positions);
    expect(all.other.match(/M/g)).toHaveLength(2);
    const touchesA = (e: { source: string; target: string }) => e.source === 'a' || e.target === 'a';
    const still = backgroundPaths(model, positions, (e) => !touchesA(e));
    const live = backgroundPaths(model, positions, touchesA);
    expect(still.other.match(/M/g)).toHaveLength(1);
    expect(live.other.match(/M/g)).toHaveLength(1);
    expect(still.other + live.other).toHaveLength(all.other.length);
  });

  it('follows a node to its new position', () => {
    const touchesC = (e: { source: string; target: string }) => e.source === 'c' || e.target === 'c';
    const before = backgroundPaths(model, positions, touchesC).other;
    const after = backgroundPaths(model, new Map(positions).set('c', { x: 0, y: 500 }), touchesC).other;
    expect(after).not.toBe(before);
    // Both edges now end at the bottom middle of c's new box.
    expect(after.match(/28 564/g)).toHaveLength(2);
  });
});

describe('loop edges', () => {
  // a -> b -> c -> a: one edge closes the cycle.
  const cycle = {
    nodes: [element('a'), element('b'), element('c')],
    edges: [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('ca', 'c', 'a')],
    target: null,
  } as unknown as GraphModel;

  it('finds exactly the edge that closes a cycle, and none in an acyclic graph', () => {
    expect([...loopEdges(cycle)]).toHaveLength(1);
    expect(loopEdges(model).size).toBe(0);
  });

  it('draws loop edges as their own background path, curved out past the source', () => {
    const at = new Map<string, Position>([
      ['a', { x: 0, y: 400 }],
      ['b', { x: 0, y: 200 }],
      ['c', { x: 0, y: 0 }],
    ]);
    const paths = backgroundPaths(cycle, at);
    expect(paths.loop.match(/M/g)).toHaveLength(1);
    expect(paths.other.match(/M/g)).toHaveLength(2);
  });

  it('loopPath leaves the source upward and ends at the target', () => {
    const { d, mx } = loopPath(100, 50, 100, 300);
    expect(d.startsWith('M100 50C')).toBe(true);
    expect(d.endsWith(' 100 300')).toBe(true);
    expect(mx).toBeGreaterThan(100);
    expect(loopPath(100, 50, 300, 300).mx).toBeLessThan(100);
  });
});
