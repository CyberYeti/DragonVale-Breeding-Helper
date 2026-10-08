// Turns a core/graph GraphModel into Svelte Flow nodes and edges: sizes each
// node, places them with core/layout, and carries the model's node or edge
// as `data` for the node and edge components to draw.

import { MarkerType, type Edge, type Node } from '@xyflow/svelte';
import type { GraphEdge, GraphModel, GraphNode, GraphNodeKind, NodeId } from '../../lib/core/graph';
import { cycleClosingEdges, layout, type Layout, type Position } from '../../lib/core/layout';

/** Svelte Flow's `type` for each kind of node is the GraphNode kind. */
export type FlowNodeData = { node: GraphNode; target: boolean };
/** `lit`: on the selected Route's path, drawn at full brightness. `loop`: closes a cycle, drawn curved and coloured. */
export type FlowEdgeData = { edge: GraphEdge; lit: boolean; loop: boolean };
export type FlowNode = Node<FlowNodeData, GraphNodeKind>;
export type FlowEdge = Edge<FlowEdgeData, 'badge'>;

/** Drawn tile widths. The Target is drawn larger, a tab graph's parents from outside the tab smaller. */
export const TILE_WIDTH = 96;
export const TARGET_TILE_WIDTH = 120;
export const OUTSIDE_TILE_WIDTH = 72;

/** The width a Dragon node's tile is drawn at. */
export function tileWidth(node: GraphNode, target: boolean): number {
  if (target) return TARGET_TILE_WIDTH;
  return node.kind === 'dragon' && node.outside ? OUTSIDE_TILE_WIDTH : TILE_WIDTH;
}

/** A node badge chip row under a Dragon tile. */
const BADGE_ROW = 20;

/**
 * The box each node is laid out with, in px. A tile is its width plus the
 * name and tick rows; the node components draw at these sizes.
 */
export function nodeSize(node: GraphNode, target: boolean): { width: number; height: number } {
  switch (node.kind) {
    case 'dragon': {
      const width = tileWidth(node, target);
      return { width, height: width + 40 + (node.badges.length > 0 ? BADGE_ROW * node.badges.length : 0) };
    }
    case 'element':
      return { width: 56, height: 64 };
    case 'route':
      return { width: 26, height: 26 };
    case 'rule':
      return { width: 104, height: 28 };
    case 'friend':
      return { width: 104, height: 44 };
  }
}

/** Top-left positions for every node, bottom-up, the Target on top. */
export function place(model: GraphModel): ReadonlyMap<NodeId, Position> {
  return placeAll(model.nodes, model.edges, model.target?.node ?? null).positions;
}

/**
 * A pulled tree laid out on its own: only the `lit` nodes and edges, the
 * Target on top, with positions relative to the tree's top-left corner.
 * Null when nothing is lit (a plain tab graph or a Focus view).
 */
export function placeTree(model: GraphModel): Layout | null {
  const nodes = model.nodes.filter((n) => n.pull === 'lit');
  if (nodes.length === 0) return null;
  return placeAll(
    nodes,
    model.edges.filter((e) => e.pull === 'lit'),
    model.target?.node ?? null,
  );
}

/** `base` with each of the tree's nodes at `corner` plus its place in the tree. */
export function withTree(
  base: ReadonlyMap<NodeId, Position>,
  tree: Layout | null,
  corner: Position,
): ReadonlyMap<NodeId, Position> {
  const out = new Map(base);
  for (const [id, p] of tree?.positions ?? []) out.set(id, { x: corner.x + p.x, y: corner.y + p.y });
  return out;
}

/** The nodes `from` has somewhere else than `to` puts them: the ones that move. */
export function moved(from: ReadonlyMap<NodeId, Position>, to: ReadonlyMap<NodeId, Position>): ReadonlySet<NodeId> {
  const ids = new Set<NodeId>();
  for (const [id, p] of to) {
    const was = from.get(id);
    if (was && (was.x !== p.x || was.y !== p.y)) ids.add(id);
  }
  return ids;
}

/** `to`, with each of `ids` still where `from` has it: the start of a move. */
export function moveStart(
  from: ReadonlyMap<NodeId, Position>,
  to: ReadonlyMap<NodeId, Position>,
  ids: ReadonlySet<NodeId>,
): ReadonlyMap<NodeId, Position> {
  const out = new Map(to);
  for (const id of ids) out.set(id, from.get(id) ?? to.get(id)!);
  return out;
}

function placeAll(nodes: readonly GraphNode[], edges: readonly GraphEdge[], top: NodeId | null): Layout {
  return layout(
    {
      nodes: nodes.map((n) => ({ id: n.id, ...nodeSize(n, n.id === top) })),
      edges: edges.map((e) => ({ source: e.source, target: e.target })),
      top,
    },
    { nodeSep: 28, rankSep: 56 },
  );
}

const loopCache = new WeakMap<GraphModel, ReadonlySet<string>>();

/**
 * The ids of the edges that close a cycle: the ones the layout turns round, so
 * they point down the page. A pulled tree is a Focus view, which has no loops,
 * so only the faded tab graph behind it counts.
 */
export function loopEdges(model: GraphModel): ReadonlySet<string> {
  let found = loopCache.get(model);
  if (!found) {
    const pulled = model.nodes.some((n) => n.pull !== undefined);
    const edges = model.edges.filter((e) => e.pull !== 'lit');
    const closing = cycleClosingEdges({
      nodes: model.nodes.map((n) => ({ id: n.id, width: 0, height: 0 })),
      edges: edges.map((e) => ({ source: e.source, target: e.target })),
      top: pulled ? null : (model.target?.node ?? null),
    });
    loopCache.set(model, (found = new Set([...closing].map((i) => edges[i]!.id))));
  }
  return found;
}

/**
 * A loop edge's curve, from the top of what is needed (x1, y1) down to the
 * bottom of what it makes (x2, y2): it leaves upward, swings out past the
 * source's side so it clears the nodes between, and comes back up into the
 * target. `mx`, `my` is the middle, for the label.
 */
export function loopPath(x1: number, y1: number, x2: number, y2: number): { d: string; mx: number; my: number } {
  const reach = 70 + Math.min(Math.abs(y2 - y1) * 0.1, 120);
  const xo = Math.round(x1 >= x2 ? Math.max(x1, x2) + reach : Math.min(x1, x2) - reach);
  const ya = Math.round(y1 - 60);
  const yb = Math.round(y2 + 60);
  return {
    d: `M${Math.round(x1)} ${Math.round(y1)}C${xo} ${ya} ${xo} ${yb} ${Math.round(x2)} ${Math.round(y2)}`,
    mx: (x1 + 6 * xo + x2) / 8,
    my: (y1 + 3 * ya + 3 * yb + y2) / 8,
  };
}

/**
 * Large graphs (spec §9 Performance rules) draw every edge that isn't lit as
 * part of a merged SVG path behind the nodes instead of as a Svelte Flow edge:
 * one path for met edges, one for loop edges and one for the rest. Each runs from the top middle
 * of what is needed to the bottom middle of what it makes, as the real edges
 * do. Positions are where the nodes sit in the tab graph. `include` picks
 * some of the edges, so a drag can redraw just the ones touching the
 * dragged node.
 */
export function backgroundPaths(
  model: GraphModel,
  positions: ReadonlyMap<NodeId, Position>,
  include: (edge: GraphEdge) => boolean = () => true,
): { readonly met: string; readonly loop: string; readonly other: string } {
  const loops = loopEdges(model);
  const boxes = new Map(model.nodes.map((n) => [n.id, nodeSize(n, false)]));
  let met = '';
  let loop = '';
  let other = '';
  for (const e of model.edges) {
    if (e.pull === 'lit' || !include(e)) continue;
    const a = positions.get(e.source);
    const b = positions.get(e.target);
    const sa = boxes.get(e.source);
    const sb = boxes.get(e.target);
    if (!a || !b || !sa || !sb) continue;
    const x1 = Math.round(a.x + sa.width / 2);
    const y1 = Math.round(a.y);
    const x2 = Math.round(b.x + sb.width / 2);
    const y2 = Math.round(b.y + sb.height);
    const my = Math.round((y1 + y2) / 2);
    if (loops.has(e.id)) {
      loop += loopPath(x1, y1, x2, y2).d;
      continue;
    }
    const d = `M${x1} ${y1}C${x1} ${my} ${x2} ${my} ${x2} ${y2}`;
    if (e.state === 'met') met += d;
    else other += d;
  }
  return { met, loop, other };
}

/** The box around the nodes `include` picks at `positions`, in flow px; null when it picks none. */
export function nodesBounds(
  model: GraphModel,
  positions: ReadonlyMap<NodeId, Position>,
  include: (node: GraphNode) => boolean = () => true,
): { x: number; y: number; width: number; height: number } | null {
  const top = model.target?.node ?? null;
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const n of model.nodes) {
    const p = positions.get(n.id);
    if (!p || !include(n)) continue;
    const size = nodeSize(n, n.id === top);
    x1 = Math.min(x1, p.x);
    y1 = Math.min(y1, p.y);
    x2 = Math.max(x2, p.x + size.width);
    y2 = Math.max(y2, p.y + size.height);
  }
  return x1 === Infinity ? null : { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

/** Edge colours by state, matching the CSS in GraphCanvas. */
const LOOP_COLOUR = '#ef6c00';
const MARKER_COLOURS: Record<GraphEdge['state'], string> = {
  normal: '#8a8a92',
  met: '#2e7d32',
  dimmed: '#8a8a92',
  locked: '#c62828',
};

export type ToFlowOptions = {
  /** Positions from `place` (or moved ones, for an animation). */
  readonly positions: ReadonlyMap<NodeId, Position>;
  /** The node the player tapped (a Route, Element or Dragon), or null. */
  readonly selected?: NodeId | null;
  /**
   * Give every node its laid-out size up front, so Svelte Flow can cull and
   * fit nodes it hasn't drawn yet (large graphs with `onlyRenderVisibleElements`).
   */
  readonly sized?: boolean;
  /** Nodes moving to a new position with the CSS transform transition. */
  readonly moving?: ReadonlySet<NodeId>;
};

/**
 * The selected node, plus, for a Route pill, its edges and the nodes at their
 * ends: drawn at full brightness even when the Route is dimmed (rule 6).
 */
export function selectedPath(model: GraphModel, selected: NodeId | null | undefined): ReadonlySet<string> {
  const lit = new Set<string>();
  if (selected == null) return lit;
  lit.add(selected);
  for (const e of model.edges) {
    if (e.route !== selected) continue;
    lit.add(e.id).add(e.source).add(e.target);
  }
  return lit;
}

export function toFlowNodes(model: GraphModel, { positions, selected, sized, moving }: ToFlowOptions): FlowNode[] {
  const top = model.target?.node ?? null;
  const lit = selectedPath(model, selected);
  return model.nodes.map((node) => {
    const target = node.id === top;
    const size = sized ? nodeSize(node, target) : null;
    return {
      id: node.id,
      type: node.kind,
      position: positions.get(node.id) ?? { x: 0, y: 0 },
      data: { node, target },
      connectable: false,
      // Dragon tiles carry their own button; Svelte Flow's focus ring would double it.
      focusable: node.kind !== 'dragon',
      class: classes(
        `gn-${node.kind} st-${node.state}`,
        node.pull && `pull-${node.pull}`,
        target && 'target',
        lit.has(node.id) && 'lit',
        node.id === selected && 'picked',
        moving?.has(node.id) && 'moving',
      ),
      zIndex: node.pull === 'faded' ? 0 : 1,
      ...(size && { width: size.width, height: size.height, measured: size }),
    };
  });
}

export function toFlowEdges(model: GraphModel, { selected }: Pick<ToFlowOptions, 'selected'> = {}): FlowEdge[] {
  const lit = selectedPath(model, selected);
  const loops = loopEdges(model);
  return model.edges.map((edge) => ({
    id: edge.id,
    type: 'badge',
    source: edge.source,
    target: edge.target,
    data: { edge, lit: lit.has(edge.id), loop: loops.has(edge.id) },
    selectable: false,
    focusable: false,
    class: classes(`ge-${edge.kind} st-${edge.state}`, edge.pull && `pull-${edge.pull}`, lit.has(edge.id) && 'lit', loops.has(edge.id) && 'is-loop'),
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 14,
      height: 14,
      color: loops.has(edge.id) ? LOOP_COLOUR : MARKER_COLOURS[edge.state],
    },
    zIndex: edge.pull === 'faded' ? 0 : 1,
  }));
}

const classes = (...names: (string | false | undefined)[]): string => names.filter(Boolean).join(' ');
