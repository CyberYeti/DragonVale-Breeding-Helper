<!--
  The Svelte Flow surface for one GraphModel. Lays the model out, draws it
  with the node and edge components, and fits the view when `fitKey`
  changes (opening a graph, a new Target). Must sit inside a
  SvelteFlowProvider; use GraphView, which adds one.

  `large` turns on the performance rules for big graphs (spec §9): only
  visible nodes are drawn, every edge that isn't lit is part of a merged
  background path, and tiles go lite when faded or zoomed far out.

  A pulled tree (a model whose nodes carry `pull`) is laid out on its own
  around the middle of the view, over the faded tab graph. Each tree node
  starts where it was on screen and moves with a CSS transform transition;
  the tree's edges appear when the move ends, then the view fits the tree.
  Leaving or changing the tree moves the nodes the same way.
-->
<script lang="ts">
  import '@xyflow/svelte/dist/style.css';
  import { untrack } from 'svelte';
  import {
    Controls,
    SvelteFlow,
    useSvelteFlow,
    ViewportPortal,
    type ColorMode,
    type EdgeTypes,
    type NodeTypes,
    type Viewport,
  } from '@xyflow/svelte';
  import type { GraphModel, GraphNode, NodeId } from '../../lib/core/graph';
  import type { Layout, Position } from '../../lib/core/layout';
  import BadgeEdge from './BadgeEdge.svelte';
  import { CanvasView, FAR_ZOOM, provideCanvasView } from './canvasView.svelte';
  import {
    backgroundPaths,
    moved,
    moveStart,
    place,
    placeTree,
    toFlowEdges,
    toFlowNodes,
    withTree,
    type FlowEdge,
    type FlowNode,
  } from './flow';
  import DragonNode from './nodes/DragonNode.svelte';
  import ElementNode from './nodes/ElementNode.svelte';
  import FriendNode from './nodes/FriendNode.svelte';
  import RouteNode from './nodes/RouteNode.svelte';
  import RuleNode from './nodes/RuleNode.svelte';

  type Props = {
    model: GraphModel;
    /** The tapped node, drawn picked; a selected Route shows its path at full brightness. */
    selected?: NodeId | null;
    /** The view fits the graph (or the pulled tree) whenever this changes. */
    fitKey: string;
    /** The large-graph rules (spec §9 Performance rules). Tab graphs turn them on. */
    large?: boolean;
    /**
     * Where each node sits when it isn't part of a pulled tree: the tab
     * graph's layout. Defaults to laying out `model`.
     */
    positions?: ReadonlyMap<NodeId, Position>;
    /** A click on a node (not on a tile's tick). */
    onnodeclick?: (node: GraphNode) => void;
    /** A click on the background. */
    onpaneclick?: () => void;
  };

  let { model, selected = null, fitKey, large = false, positions, onnodeclick, onpaneclick }: Props = $props();

  /** How long moving nodes take (the `.moving` transition below). */
  const MOVE_MS = 600;

  const nodeTypes: NodeTypes = {
    dragon: DragonNode,
    element: ElementNode,
    route: RouteNode,
    rule: RuleNode,
    friend: FriendNode,
  };
  const edgeTypes: EdgeTypes = { badge: BadgeEdge };

  const flow = useSvelteFlow();
  const canvas = new CanvasView(() => large);
  provideCanvasView(canvas);

  /** Where nodes sit outside a pulled tree. */
  const base = $derived(positions ?? place(model));
  /** The pulled tree on its own, relative to its top-left corner; null without one. */
  const tree = $derived(placeTree(model));
  /** Names the pulled tree ('' for none); the nodes move when it changes. */
  const treeKey = $derived(tree ? (model.target?.node ?? '') : '');
  const background = $derived(large ? backgroundPaths(model, base) : null);

  let box: HTMLDivElement | undefined = $state();
  let nodes = $state.raw<FlowNode[]>([]);
  let edges = $state.raw<FlowEdge[]>([]);

  // Plain variables: render() reads and writes them without tracking them.
  /** The positions last handed to Svelte Flow. */
  let shown: ReadonlyMap<NodeId, Position> = new Map();
  /** The tree drawn last and where its top-left corner went. */
  let placedTree: { key: string; corner: Position } | null = null;
  /** The tree key last rendered; undefined before the first render. */
  let renderedTree: string | undefined;
  /** The fitKey last fitted. */
  let fitted: string | null = null;
  /** Bumped by every render, so a superseded move's later steps do nothing. */
  let token = 0;

  $effect(() => {
    const input = { model, selected, fitKey, base, tree, treeKey, large };
    // render() reads the viewport; untracked, so panning never re-renders the nodes (spec §9).
    untrack(() => render(input));
  });

  type RenderInput = {
    model: GraphModel;
    selected: NodeId | null;
    fitKey: string;
    base: ReadonlyMap<NodeId, Position>;
    tree: Layout | null;
    treeKey: string;
    large: boolean;
  };

  function render({ model: m, selected: sel, fitKey: key, base: b, tree: t, treeKey: tk, large: isLarge }: RenderInput) {
    const my = ++token;
    if (!t) placedTree = null;
    const final = t ? withTree(b, t, treeCorner(tk, t.width, t.height)) : b;
    const allEdges = toFlowEdges(m, { selected: sel });
    // Large graphs: only the tree's edges are real; the rest are in the background paths.
    const realEdges = isLarge ? allEdges.filter((e) => e.data?.edge.pull === 'lit') : allEdges;
    const flowNodes = (at: ReadonlyMap<NodeId, Position>, moving?: ReadonlySet<NodeId>) =>
      toFlowNodes(m, { positions: at, selected: sel, sized: isLarge, moving });

    const animate = renderedTree !== undefined && tk !== renderedTree && !reducedMotion();
    renderedTree = tk;
    const moving = animate ? moved(shown, final) : new Set<NodeId>();
    if (moving.size === 0) {
      shown = final;
      nodes = flowNodes(final);
      edges = realEdges;
      fit(key, m, isLarge);
      return;
    }

    // Each moving node starts where it was on screen; the tree's edges wait for the move.
    const start = moveStart(shown, final, moving);
    shown = final;
    nodes = flowNodes(start, moving);
    edges = [];
    // Two frames, so the start positions are painted before the move begins.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (my !== token) return;
        nodes = flowNodes(final, moving);
        setTimeout(() => {
          if (my !== token) return;
          nodes = flowNodes(final);
          edges = realEdges;
          fit(key, m, isLarge);
        }, MOVE_MS + 50);
      }),
    );
  }

  /**
   * Where the pulled tree's top-left corner goes: centred on the middle of
   * the view when the tree is first drawn, then kept while it's the same
   * tree (a tick or a selection doesn't move it).
   */
  function treeCorner(key: string, width: number, height: number): Position {
    if (placedTree?.key === key) return placedTree.corner;
    const r = box?.getBoundingClientRect();
    const middle = r
      ? flow.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
      : { x: 0, y: 0 };
    const corner = { x: Math.round(middle.x - width / 2), y: Math.round(middle.y - height / 2) };
    placedTree = { key, corner };
    return corner;
  }

  /**
   * Fits the view once per fitKey: to the pulled tree when there is one,
   * else to the whole graph. Large graphs jump: an animated fit there mounts
   * nodes on every frame, and Svelte Flow cuts the zoom transition short.
   */
  function fit(key: string, m: GraphModel, isLarge: boolean) {
    if (key === fitted) return;
    const first = fitted === null;
    fitted = key;
    const lit = m.nodes.filter((n) => n.pull === 'lit').map((n) => ({ id: n.id }));
    void flow.fitView({
      padding: 0.12,
      maxZoom: 1,
      duration: first || isLarge ? 0 : 300,
      ...(lit.length > 0 && { nodes: lit }),
    });
  }

  const reducedMotion = (): boolean =>
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Large graphs: the far-zoom flag lite tiles follow. Written only when the threshold is crossed. */
  function onmove(_event: unknown, viewport: Viewport) {
    const far = large && viewport.zoom < FAR_ZOOM;
    if (far !== canvas.far) canvas.far = far;
  }

  /** Follow the OS, unless the page forces light (theme.css's data-theme). */
  const colorMode: ColorMode =
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'system';
</script>

<div class="canvas" bind:this={box}>
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
    onlyRenderVisibleElements={large}
    nodesDraggable={false}
    nodesConnectable={false}
    elementsSelectable={false}
    deleteKey={null}
    {onmove}
    oninit={() => onmove(null, flow.getViewport())}
    onnodeclick={({ node }) => onnodeclick?.(node.data.node)}
    onpaneclick={() => onpaneclick?.()}
  >
    {#if background}
      <ViewportPortal target="back">
        <svg class="background" class:faint={tree !== null} aria-hidden="true">
          <path class="other" d={background.other} />
          <path class="met" d={background.met} />
        </svg>
      </ViewportPortal>
    {/if}
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

  /* ---- Large graphs: the merged background edges and the pull ---- */
  .background {
    position: absolute;
    left: 0;
    top: 0;
    width: 1px;
    height: 1px;
    overflow: visible;
    pointer-events: none;
  }
  .background path {
    fill: none;
    stroke-width: 1.5;
  }
  .background .other {
    stroke: var(--muted);
    stroke-opacity: 0.45;
  }
  .background .met {
    stroke: var(--own);
    stroke-opacity: 0.7;
  }
  .background.faint path {
    stroke-opacity: 0.08;
    stroke-width: 1;
  }
  /* Faded tiles fade themselves (DragonTile's `faded`); the other kinds fade here. */
  .canvas :global(.svelte-flow__node.pull-faded:not(.gn-dragon)) {
    opacity: 0.12;
  }
  .canvas :global(.svelte-flow__node.moving) {
    transition: transform 0.6s ease-in-out;
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
