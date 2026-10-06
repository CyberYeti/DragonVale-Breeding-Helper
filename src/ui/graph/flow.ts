// Turns a core/graph GraphModel into Svelte Flow nodes and edges: sizes each
// node, places them with core/layout, and carries the model's node or edge
// as `data` for the node and edge components to draw.

import { MarkerType, type Edge, type Node } from '@xyflow/svelte';
import type { GraphEdge, GraphModel, GraphNode, GraphNodeKind, NodeId } from '../../lib/core/graph';
import { layout, type Position } from '../../lib/core/layout';

/** Svelte Flow's `type` for each kind of node is the GraphNode kind. */
export type FlowNodeData = { node: GraphNode; target: boolean };
/** `lit`: on the selected Route's path, drawn at full brightness. */
export type FlowEdgeData = { edge: GraphEdge; lit: boolean };
export type FlowNode = Node<FlowNodeData, GraphNodeKind>;
export type FlowEdge = Edge<FlowEdgeData, 'badge'>;

/** Drawn tile widths. The Target is drawn larger. */
export const TILE_WIDTH = 96;
export const TARGET_TILE_WIDTH = 120;

/** A node badge chip row under a Dragon tile. */
const BADGE_ROW = 20;

/**
 * The box each node is laid out with, in px. A tile is its width plus the
 * name and tick rows; the node components draw at these sizes.
 */
export function nodeSize(node: GraphNode, target: boolean): { width: number; height: number } {
  switch (node.kind) {
    case 'dragon': {
      const width = target ? TARGET_TILE_WIDTH : TILE_WIDTH;
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
  const top = model.target?.node ?? null;
  return layout(
    {
      nodes: model.nodes.map((n) => ({ id: n.id, ...nodeSize(n, n.id === top) })),
      edges: model.edges.map((e) => ({ source: e.source, target: e.target })),
      top,
    },
    { nodeSep: 28, rankSep: 56 },
  ).positions;
}

/** Edge colours by state, matching the CSS in GraphCanvas. */
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

export function toFlowNodes(model: GraphModel, { positions, selected }: ToFlowOptions): FlowNode[] {
  const top = model.target?.node ?? null;
  const lit = selectedPath(model, selected);
  return model.nodes.map((node) => {
    const target = node.id === top;
    return {
      id: node.id,
      type: node.kind,
      position: positions.get(node.id) ?? { x: 0, y: 0 },
      data: { node, target },
      draggable: false,
      connectable: false,
      // Dragon tiles carry their own button; Svelte Flow's focus ring would double it.
      focusable: node.kind !== 'dragon',
      class: classes(`gn-${node.kind} st-${node.state}`, node.pull && `pull-${node.pull}`, target && 'target', lit.has(node.id) && 'lit', node.id === selected && 'picked'),
      zIndex: node.pull === 'faded' ? 0 : 1,
    };
  });
}

export function toFlowEdges(model: GraphModel, { selected }: Pick<ToFlowOptions, 'selected'> = {}): FlowEdge[] {
  const lit = selectedPath(model, selected);
  return model.edges.map((edge) => ({
    id: edge.id,
    type: 'badge',
    source: edge.source,
    target: edge.target,
    data: { edge, lit: lit.has(edge.id) },
    selectable: false,
    focusable: false,
    class: classes(`ge-${edge.kind} st-${edge.state}`, edge.pull && `pull-${edge.pull}`, lit.has(edge.id) && 'lit'),
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: MARKER_COLOURS[edge.state] },
    zIndex: edge.pull === 'faded' ? 0 : 1,
  }));
}

const classes = (...names: (string | false | undefined)[]): string => names.filter(Boolean).join(' ');
