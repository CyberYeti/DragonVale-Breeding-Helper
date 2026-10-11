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
  starts where it was on screen and moves with a CSS transform transition,
  while the view moves to fit where the nodes are going, with the same
  duration and easing; the tree's edges appear when the move ends. Leaving
  or changing the tree moves the nodes the same way.

  Nodes can be dragged. A drag of a node of the graph itself goes to
  `onarrange` (a tab graph saves it); without one, and for a pulled tree's
  nodes, it lasts while the view (or the tree) is open.
-->
<script lang="ts">
  /* eslint-disable svelte/prefer-svelte-reactivity -- the maps here are render() and drag bookkeeping, never read reactively */
  import '@xyflow/svelte/dist/style.css';
  import { untrack } from 'svelte';
  import {
    Controls,
    getViewportForBounds,
    SvelteFlow,
    useSvelteFlow,
    ViewportPortal,
    type ColorMode,
    type EdgeTypes,
    type NodeTargetEventWithPointer,
    type NodeTypes,
    type Viewport,
  } from '@xyflow/svelte';
  import type { GraphEdge, GraphModel, GraphNode, NodeId } from '../../lib/core/graph';
  import type { Layout, Position } from '../../lib/core/layout';
  import { withMoves, type Moves } from './arrangement';
  import BadgeEdge from './BadgeEdge.svelte';
  import { CanvasView, FAR_ZOOM, provideCanvasView } from './canvasView.svelte';
  import {
    backgroundPaths,
    moved,
    moveStart,
    nodesBounds,
    nodeSize,
    place,
    placeTree,
    toFlowEdges,
    toFlowNodes,
    withTree,
    type FlowEdge,
    type FlowNode,
  } from './flow';
  import { easeInOut, MOVE_MS, reducedMotion } from './motion';
  import GraphKey from './GraphKey.svelte';
  import DragonNode from './nodes/DragonNode.svelte';
  import ElementNode from './nodes/ElementNode.svelte';
  import FriendNode from './nodes/FriendNode.svelte';
  import RouteNode from './nodes/RouteNode.svelte';
  import RuleNode from './nodes/RuleNode.svelte';
  import { useClickPanel } from './panel/clickPanel.svelte';

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
     * graph's layout with the saved moves. Defaults to laying out `model`.
     */
    positions?: ReadonlyMap<NodeId, Position>;
    /** Changes when the saved arrangement is reset: the nodes move to their new places instead of jumping. */
    arrangement?: number;
    /** Nodes of the graph itself (not of a pulled tree) the player dragged, and where they were left. */
    onarrange?: (moves: Moves) => void;
    /** A click on a node (not on a tile's tick, and not the end of a drag). */
    onnodeclick?: (node: GraphNode) => void;
    /** A click on the background. */
    onpaneclick?: () => void;
  };

  let {
    model,
    selected = null,
    fitKey,
    large = false,
    positions,
    arrangement = 0,
    onarrange,
    onnodeclick,
    onpaneclick,
  }: Props = $props();

  /** How the view fits: a margin around the nodes, and never closer than 1:1. */
  const FIT = { padding: 0.12, maxZoom: 1 } as const;
  const MIN_ZOOM = 0.05;
  /** Pointer travel (px) that makes a press on a node a drag instead of a click. */
  const DRAG_PX = 4;

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
  /** The view's click panel, if it has one. */
  const panel = useClickPanel();

  // A Dragon or Route picked in a panel: pan to its node at the current zoom.
  // Done here, not in the node, because a large graph doesn't draw off-screen nodes.
  $effect(() => {
    const reveal = panel?.reveal;
    if (!reveal) return;
    untrack(() => {
      const node = model.nodes.find((n) => n.id === reveal.id);
      const at = shown.get(reveal.id);
      if (!node || !at) return;
      const size = nodeSize(node, node.id === model.target?.node);
      void flow.setCenter(at.x + size.width / 2, at.y + size.height / 2, {
        zoom: flow.getZoom(),
        duration: large ? 0 : 300,
      });
    });
  });

  /** Where nodes sit outside a pulled tree. */
  const base = $derived(positions ?? place(model));
  /** The pulled tree on its own, relative to its top-left corner; null without one. */
  const tree = $derived(placeTree(model));
  /** Names the pulled tree ('' for none); the nodes move when it changes. */
  const treeKey = $derived(tree ? (model.target?.node ?? '') : '');
  const background = $derived(large ? backgroundPaths(model, base) : null);

  type Paths = ReturnType<typeof backgroundPaths>;
  /**
   * While a node of a large graph is dragged: the background edges that
   * don't touch it (drawn once) and the ones that do (redrawn as it moves).
   */
  let dragPaths = $state.raw<{ still: Paths; live: Paths } | null>(null);
  /** The edges dragPaths.live draws; null when no drag is redrawing the background. */
  let dragTouches: ((edge: GraphEdge) => boolean) | null = null;

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
  /** The arrangement last rendered. */
  let renderedArrangement = 0;
  /** Drags that last while this view (and this tree) is open, and what they belong to. */
  let dragged = new Map<NodeId, Position>();
  let draggedFor = '';
  /** The fitKey last fitted. */
  let fitted: string | null = null;
  /** Bumped by every render, so a superseded move's later steps do nothing. */
  let token = 0;

  $effect(() => {
    const input = { model, selected, fitKey, base, tree, treeKey, large, arrangement };
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
    arrangement: number;
  };

  function render({
    model: m,
    selected: sel,
    fitKey: key,
    base: b,
    tree: t,
    treeKey: tk,
    large: isLarge,
    arrangement: arr,
  }: RenderInput) {
    const my = ++token;
    if (!t) placedTree = null;
    // Drags that aren't saved are forgotten with the view or tree they were made in.
    if (`${key}\n${tk}` !== draggedFor) {
      draggedFor = `${key}\n${tk}`;
      dragged = new Map();
    }
    const final = withMoves(t ? withTree(b, t, treeCorner(tk, t.width, t.height)) : b, dragged);
    const allEdges = toFlowEdges(m, { selected: sel });
    // Large graphs: only the tree's edges are real; the rest are in the background paths.
    const realEdges = isLarge ? allEdges.filter((e) => e.data?.edge.pull === 'lit') : allEdges;
    const flowNodes = (at: ReadonlyMap<NodeId, Position>, moving?: ReadonlySet<NodeId>) =>
      toFlowNodes(m, { positions: at, selected: sel, sized: isLarge, moving });

    const changed = renderedTree !== undefined && (tk !== renderedTree || arr !== renderedArrangement);
    renderedTree = tk;
    renderedArrangement = arr;
    const moving = changed && !reducedMotion() ? moved(shown, final) : new Set<NodeId>();
    if (moving.size === 0) {
      shown = final;
      nodes = flowNodes(final);
      edges = realEdges;
      fit(key, m, final, isLarge ? 0 : 300);
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
        // The view moves with the nodes: same start, duration and easing.
        fit(key, m, final, MOVE_MS);
        setTimeout(() => {
          if (my !== token) return;
          nodes = flowNodes(final);
          edges = realEdges;
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
   * else to the whole graph, at `at` (where the nodes are going).
   *
   * The fit is worked out here from the laid-out sizes and set with
   * setViewport, not with Svelte Flow's fitView: an animated fitView stays
   * queued until its transition ends, and every node a large graph mounts
   * on the way (onlyRenderVisibleElements) re-measures and restarts it from
   * wherever the view has got to, so it crawls and stops short. The first
   * fit, before anything is measured or the view has a size, is fitView's.
   */
  function fit(key: string, m: GraphModel, at: ReadonlyMap<NodeId, Position>, duration: number) {
    if (key === fitted) return;
    const first = fitted === null;
    fitted = key;
    const lit = m.nodes.some((n) => n.pull === 'lit');
    if (first) {
      const nodes = lit ? m.nodes.filter((n) => n.pull === 'lit').map((n) => ({ id: n.id })) : undefined;
      void flow.fitView({ ...FIT, duration: 0, nodes });
      return;
    }
    const bounds = nodesBounds(m, at, lit ? (n) => n.pull === 'lit' : undefined);
    const width = box?.clientWidth ?? 0;
    const height = box?.clientHeight ?? 0;
    if (!bounds || width === 0 || height === 0) return;
    const viewport = getViewportForBounds(bounds, width, height, MIN_ZOOM, FIT.maxZoom, FIT.padding);
    void flow.setViewport(viewport, {
      duration: reducedMotion() ? 0 : duration,
      ease: easeInOut,
      interpolate: 'linear',
    });
  }

  type DragEvent = Parameters<NodeTargetEventWithPointer<MouseEvent | TouchEvent, FlowNode>>[0];

  /** Large graphs: the background edges of a dragged graph node follow it. */
  function ondragstart({ nodes: dragging }: DragEvent) {
    if (!background) return;
    const ids = new Set(dragging.filter((n) => n.data.node.pull !== 'lit').map((n) => n.id));
    if (ids.size === 0) return;
    const touches = (e: GraphEdge) => ids.has(e.source) || ids.has(e.target);
    dragTouches = touches;
    dragPaths = { still: backgroundPaths(model, base, (e) => !touches(e)), live: backgroundPaths(model, base, touches) };
  }

  function ondrag({ nodes: dragging }: DragEvent) {
    if (!dragTouches || !dragPaths) return;
    const at = new Map(base);
    for (const n of dragging) at.set(n.id, n.position);
    dragPaths = { still: dragPaths.still, live: backgroundPaths(model, at, dragTouches) };
  }

  /** A drop: graph nodes go to `onarrange` when there is one; the rest last while the view is open. */
  function ondragstop({ nodes: dropped }: DragEvent) {
    const next = new Map(shown);
    const saved = new Map<NodeId, Position>();
    for (const n of dropped) {
      const at = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
      next.set(n.id, at);
      if (onarrange && n.data.node.pull !== 'lit') saved.set(n.id, at);
      else dragged.set(n.id, at);
    }
    shown = next;
    dragTouches = null;
    if (saved.size > 0) onarrange?.(saved);
    // The saved moves are in `base` now, so the background redraws from it.
    dragPaths = null;
  }

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
    fitViewOptions={FIT}
    minZoom={MIN_ZOOM}
    maxZoom={2.5}
    onlyRenderVisibleElements={large}
    nodesDraggable
    nodeDragThreshold={DRAG_PX}
    nodeClickDistance={DRAG_PX}
    nodesConnectable={false}
    elementsSelectable={false}
    deleteKey={null}
    {onmove}
    oninit={() => onmove(null, flow.getViewport())}
    onnodeclick={({ node }) => onnodeclick?.(node.data.node)}
    onpaneclick={() => onpaneclick?.()}
    onnodedragstart={ondragstart}
    onnodedrag={ondrag}
    onnodedragstop={ondragstop}
  >
    {#if background}
      {@const still = dragPaths?.still ?? background}
      <ViewportPortal target="back">
        <svg class="background" class:faint={tree !== null} aria-hidden="true">
          <path class="other" d={still.other} />
          <path class="met" d={still.met} />
          <path class="loop" d={still.loop} />
          {#if dragPaths}
            <path class="other" d={dragPaths.live.other} />
            <path class="met" d={dragPaths.live.met} />
            <path class="loop" d={dragPaths.live.loop} />
          {/if}
        </svg>
      </ViewportPortal>
    {/if}
    <Controls showLock={false} />
  </SvelteFlow>
  <GraphKey {model} />
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
  .canvas :global(.svelte-flow__node.dragging) {
    cursor: grabbing;
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
  .background .loop {
    stroke: var(--loop);
    stroke-opacity: 0.85;
  }
  .background.faint path {
    stroke-opacity: 0.08;
    stroke-width: 1;
  }
  /* Faded tiles fade themselves (DragonTile's `faded`); the other kinds fade here. */
  .canvas :global(.svelte-flow__node.pull-faded:not(.gn-dragon)) {
    opacity: 0.12;
  }
  /* motion.ts's MOVE_MS and MOVE_EASING: the view moves with the same. */
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
  .canvas :global(.svelte-flow__edge.is-loop .svelte-flow__edge-path) {
    stroke: var(--loop);
    stroke-width: 2;
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
  .canvas :global(.chip.b-loop),
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
