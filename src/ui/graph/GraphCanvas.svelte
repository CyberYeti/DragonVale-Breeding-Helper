<!--
  The Svelte Flow surface for one GraphModel. Lays the model out, draws it
  with the node and edge components, and fits the view when `fitKey`
  changes (opening a graph, a new Target). Must sit inside a
  SvelteFlowProvider; use GraphView, which adds one.
-->
<script lang="ts">
  import '@xyflow/svelte/dist/style.css';
  import { Controls, SvelteFlow, useSvelteFlow, type ColorMode, type EdgeTypes, type NodeTypes } from '@xyflow/svelte';
  import type { GraphModel, GraphNode, NodeId } from '../../lib/core/graph';
  import BadgeEdge from './BadgeEdge.svelte';
  import { place, toFlowEdges, toFlowNodes, type FlowEdge, type FlowNode } from './flow';
  import DragonNode from './nodes/DragonNode.svelte';
  import ElementNode from './nodes/ElementNode.svelte';
  import FriendNode from './nodes/FriendNode.svelte';
  import RouteNode from './nodes/RouteNode.svelte';
  import RuleNode from './nodes/RuleNode.svelte';

  type Props = {
    model: GraphModel;
    /** The tapped node, drawn picked; a selected Route shows its path at full brightness. */
    selected?: NodeId | null;
    /** The view fits the graph whenever this changes. */
    fitKey: string;
    /** A click on a node (not on a tile's tick). */
    onnodeclick?: (node: GraphNode) => void;
    /** A click on the background. */
    onpaneclick?: () => void;
  };

  let { model, selected = null, fitKey, onnodeclick, onpaneclick }: Props = $props();

  const nodeTypes: NodeTypes = {
    dragon: DragonNode,
    element: ElementNode,
    route: RouteNode,
    rule: RuleNode,
    friend: FriendNode,
  };
  const edgeTypes: EdgeTypes = { badge: BadgeEdge };

  const flow = useSvelteFlow();
  const positions = $derived(place(model));

  let nodes = $state.raw<FlowNode[]>([]);
  let edges = $state.raw<FlowEdge[]>([]);

  $effect(() => {
    nodes = toFlowNodes(model, { positions, selected });
    edges = toFlowEdges(model, { selected });
  });

  // Fit once the new nodes are measured (Svelte Flow queues the fit until then).
  let fitted: string | null = null;
  $effect(() => {
    const key = fitKey;
    if (key === fitted) return;
    const first = fitted === null;
    fitted = key;
    void flow.fitView({ padding: 0.12, maxZoom: 1, duration: first ? 0 : 300 });
  });

  /** Follow the OS, unless the page forces light (theme.css's data-theme). */
  const colorMode: ColorMode =
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'system';
</script>

<div class="canvas">
  <SvelteFlow
    bind:nodes
    bind:edges
    {nodeTypes}
    {edgeTypes}
    {colorMode}
    fitView
    fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
    minZoom={0.05}
    maxZoom={2.5}
    nodesDraggable={false}
    nodesConnectable={false}
    elementsSelectable={false}
    deleteKey={null}
    onnodeclick={({ node }) => onnodeclick?.(node.data.node)}
    onpaneclick={() => onpaneclick?.()}
  >
    <Controls showLock={false} />
  </SvelteFlow>
</div>

<style>
  .canvas {
    position: absolute;
    inset: 0;
  }

  /* Svelte Flow in the app's tokens. */
  .canvas :global(.svelte-flow) {
    --xy-background-color: var(--bg);
    --xy-edge-stroke: var(--muted);
    --xy-edge-stroke-width: 1.5;
    --xy-controls-button-background-color: var(--card);
    --xy-controls-button-color: var(--fg);
    --xy-controls-button-border-color: var(--line);
  }
  .canvas :global(.svelte-flow__node) {
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }
  .canvas :global(.svelte-flow__handle) {
    opacity: 0;
    pointer-events: none;
    min-width: 1px;
    min-height: 1px;
    width: 1px;
    height: 1px;
    border: 0;
  }

  /* ---- Node states ---- */
  .canvas :global(.svelte-flow__node.st-dimmed) {
    opacity: 0.4;
  }
  .canvas :global(.svelte-flow__node.st-locked) {
    filter: saturate(0.6);
  }
  .canvas :global(.svelte-flow__node.lit) {
    opacity: 1;
  }
  .canvas :global(.svelte-flow__node.picked) {
    outline: 3px solid var(--accent);
    outline-offset: 3px;
    border-radius: 12px;
  }
  .canvas :global(.svelte-flow__node.gn-route.picked) {
    border-radius: 50%;
  }
  .canvas :global(.svelte-flow__node.gn-route.st-locked .pill) {
    border-color: var(--bad, #c62828);
  }
  .canvas :global(.svelte-flow__node.gn-route.st-dimmed:not(.lit) .pill) {
    border-style: dashed;
  }

  /* ---- Edges: kind sets the dash, state the colour ---- */
  .canvas :global(.svelte-flow__edge.st-met .svelte-flow__edge-path) {
    stroke: var(--own);
    stroke-width: 2.5;
  }
  .canvas :global(.svelte-flow__edge.st-dimmed .svelte-flow__edge-path) {
    stroke-opacity: 0.3;
  }
  .canvas :global(.svelte-flow__edge.st-dimmed.lit .svelte-flow__edge-path) {
    stroke-opacity: 1;
    stroke-width: 2.5;
  }
  .canvas :global(.svelte-flow__edge.st-locked .svelte-flow__edge-path) {
    stroke: #c62828;
    stroke-dasharray: 5 4;
  }
  .canvas :global(.svelte-flow__edge.ge-evolves-from .svelte-flow__edge-path) {
    stroke-dasharray: 7 4;
  }
  .canvas :global(.svelte-flow__edge.ge-coop-only .svelte-flow__edge-path) {
    stroke-dasharray: 2 3;
  }

  /* ---- Badge chips, on edges and under tiles ---- */
  .canvas :global(.chip) {
    display: inline-block;
    max-width: 260px;
    padding: 0 5px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--card);
    color: var(--fg);
    font-size: 10px;
    line-height: 16px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .canvas :global(.edge-badges) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    background: none;
    padding: 0;
    pointer-events: none !important;
  }
  .canvas :global(.chip.b-purchase-only),
  .canvas :global(.chip.b-not-available),
  .canvas :global(.chip.b-dead-end),
  .canvas :global(.chip.b-cannot-be-parent) {
    border-color: #c62828;
    color: #c62828;
  }
  .canvas :global(.chip.b-no-valid-pair) {
    border-color: #b26a00;
    color: #b26a00;
  }
  .canvas :global(.chip.b-decoration) {
    border-color: #8e24aa;
  }
  .canvas :global(.edge-badges.dim) {
    opacity: 0.4;
  }
</style>
