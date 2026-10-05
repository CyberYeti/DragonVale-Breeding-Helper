// core/layout: places a graph bottom-up with dagre (spec §9). Elements at the
// bottom, the Target or newest generation on top. It knows nothing about
// GraphModel, tiles or Svelte Flow: the caller maps its nodes to ids and
// sizes, and gets top-left positions back.

import dagre from '@dagrejs/dagre';

/** A node to place. Sizes are the drawn box in px (a tile, a lite tile, an Element, a pill). */
export type LayoutNode = { readonly id: string; readonly width: number; readonly height: number };

/** An edge pointing up: from what is needed (`source`, drawn lower) to what it makes (`target`, drawn higher). */
export type LayoutEdge = { readonly source: string; readonly target: string };

export type LayoutInput = {
  readonly nodes: readonly LayoutNode[];
  readonly edges: readonly LayoutEdge[];
  /**
   * The node that must be highest, such as the Focus view's Target. Every
   * node it reaches through the edges (walking down) is drawn below it.
   */
  readonly top?: string | null;
};

export type LayoutOptions = {
  /** Horizontal gap between nodes in a row. Default 24. */
  readonly nodeSep?: number;
  /** Vertical gap between rows. Default 60. */
  readonly rankSep?: number;
  /** Space around the whole graph. Default 0. */
  readonly margin?: number;
};

/** A node's top-left corner, the way Svelte Flow positions nodes. y grows downward. */
export type Position = { readonly x: number; readonly y: number };

export type Layout = {
  /** One entry per input node. */
  readonly positions: ReadonlyMap<string, Position>;
  /** The size of the laid-out graph, margins included. */
  readonly width: number;
  readonly height: number;
};

/**
 * Lays a graph out bottom-up: every edge goes from a lower node to a higher
 * one, and `top` (when given) is the highest node.
 *
 * A cycle can't point up all the way round. The edges that close a cycle
 * (found walking down from `top`, then from the other sinks, in input order)
 * are the only ones drawn pointing down; in a Focus tree that's the extra
 * edge back to a Dragon already in the view.
 *
 * Throws if an edge names a node that isn't in `nodes`, or `top` isn't one.
 */
export function layout(input: LayoutInput, options: LayoutOptions = {}): Layout {
  const { nodeSep = 24, rankSep = 60, margin = 0 } = options;
  const ids = new Set(input.nodes.map((n) => n.id));
  for (const e of input.edges) {
    for (const id of [e.source, e.target]) {
      if (!ids.has(id)) throw new Error(`layout: edge ${e.source} → ${e.target} names unknown node ${id}`);
    }
  }
  if (input.top != null && !ids.has(input.top)) throw new Error(`layout: unknown top node ${input.top}`);

  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: 'BT', nodesep: nodeSep, ranksep: rankSep, marginx: margin, marginy: margin });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of input.nodes) g.setNode(n.id, { width: n.width, height: n.height });

  const closing = cycleClosingEdges(input);
  input.edges.forEach((e, i) => {
    // dagre needs an acyclic graph; we choose which edges turn round so the
    // top node stays on top, rather than leaving it to dagre's acyclicer.
    if (closing.has(i)) g.setEdge(e.target, e.source, {}, String(i));
    else g.setEdge(e.source, e.target, {}, String(i));
  });

  dagre.layout(g);

  const positions = new Map<string, Position>();
  for (const n of input.nodes) {
    const placed = g.node(n.id);
    positions.set(n.id, { x: (placed.x ?? 0) - n.width / 2, y: (placed.y ?? 0) - n.height / 2 });
  }
  const size = g.graph();
  return { positions, width: size.width ?? 0, height: size.height ?? 0 };
}

/**
 * Indexes of the edges that close a cycle. A depth-first walk goes down
 * (target → source) from `top`, then from each sink, then from anything left;
 * an edge leading back to a node still on the walk's path closes a cycle.
 */
function cycleClosingEdges(input: LayoutInput): Set<number> {
  const below = new Map<string, number[]>(input.nodes.map((n) => [n.id, []]));
  const hasOut = new Set<string>();
  input.edges.forEach((e, i) => {
    below.get(e.target)!.push(i);
    hasOut.add(e.source);
  });

  const roots = [
    ...(input.top != null ? [input.top] : []),
    ...input.nodes.filter((n) => !hasOut.has(n.id)).map((n) => n.id),
    ...input.nodes.map((n) => n.id),
  ];

  const closing = new Set<number>();
  const done = new Set<string>();
  const onPath = new Set<string>();
  for (const root of roots) {
    if (done.has(root)) continue;
    // Iterative, so a large tab graph can't overflow the stack.
    const stack: { id: string; next: number }[] = [{ id: root, next: 0 }];
    onPath.add(root);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const edges = below.get(frame.id)!;
      if (frame.next === edges.length) {
        stack.pop();
        onPath.delete(frame.id);
        done.add(frame.id);
        continue;
      }
      const i = edges[frame.next++]!;
      const source = input.edges[i]!.source;
      if (onPath.has(source)) closing.add(i);
      else if (!done.has(source)) {
        onPath.add(source);
        stack.push({ id: source, next: 0 });
      }
    }
  }
  return closing;
}
