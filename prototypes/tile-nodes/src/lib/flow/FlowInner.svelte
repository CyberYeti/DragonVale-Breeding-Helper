<script>
  // Variants A and B: Svelte Flow, every node a Svelte component wrapping the shared tiles.
  import { SvelteFlow, Background, Controls, MiniMap, useSvelteFlow, MarkerType, ViewportPortal } from "@xyflow/svelte";
  import { tick, untrack } from "svelte";
  import DragonNode from "./DragonNode.svelte";
  import ElementNode from "./ElementNode.svelte";
  import RouteNode from "./RouteNode.svelte";
  import NoteNode from "./NoteNode.svelte";
  import BadgeEdge from "./BadgeEdge.svelte";
  import { app, perf } from "../state.svelte.js";
  import { view } from "../view.svelte.js";

  let { scene, liteMode = false, cull = false } = $props();
  // Diagnostic switches: ?edges=0 drops the faint background edges, ?minimap=0 drops the minimap.
  const QS = new URLSearchParams(location.search), NOMINI = QS.get("minimap") === "0";
  // B only: the ~2,500 faint background edges are drawn as ONE merged SVG path behind the nodes, not as Svelte Flow edges.
  const NOBG = QS.get("edges") === "0" || liteMode;
  let bgPath = $state("");
  function mergedPath(s) {
    if (!liteMode || QS.get("edges") === "0") return "";
    const by = new Map(s.nodes.map((n) => [n.id, n]));
    let d = "";
    for (const e of s.edges) {
      if (!e.bg) continue;
      const a = by.get(e.source), b = by.get(e.target); if (!a || !b) continue;
      const x1 = a.x, y1 = a.y - a.h / 2, x2 = b.x, y2 = b.y + b.h / 2, my = (y1 + y2) / 2;
      d += `M${x1 | 0} ${y1 | 0}C${x1 | 0} ${my | 0} ${x2 | 0} ${my | 0} ${x2 | 0} ${y2 | 0}`;
    }
    return d;
  }
  const nodeTypes = { dragon: DragonNode, element: ElementNode, route: RouteNode, note: NoteNode };
  const edgeTypes = { badge: BadgeEdge };
  const flow = useSvelteFlow();
  let box;
  let nodes = $state.raw([]);
  let edges = $state.raw([]);

  const toNode = (sn, x = sn.x, y = sn.y, cls = "") => ({
    id: sn.id, type: sn.kind, position: { x: x - sn.w / 2, y: y - sn.h / 2 }, width: sn.w, height: sn.h,
    data: { sn, liteMode }, hidden: !!sn.hidden, draggable: false, class: (sn.faded ? "faded " : "") + (sn.tree ? "tree " : "") + cls,
    zIndex: sn.tree ? 10 : 0,
  });
  const toEdge = (e, hidden = false) => ({
    id: e.id, source: e.source, target: e.target, type: "badge", data: { label: e.bg ? null : e.label }, hidden,
    class: `k-${e.kind} ${e.bg ? "bg" : ""} ${e.tree ? "treeedge" : ""}`, selectable: false, zIndex: e.tree ? 9 : 0,
    markerEnd: e.bg ? undefined : { type: MarkerType.ArrowClosed, width: 14, height: 14 },
  });

  let token = 0;
  $effect(() => {
    const s = scene, my = ++token;
    bgPath = mergedPath(s);
    if (!s.tree) {
      nodes = s.nodes.map((n) => toNode(n));
      edges = s.edges.filter((e) => !(NOBG && e.bg)).map((e) => toEdge(e));
      perf.nodes = s.nodes.length; perf.edges = s.edges.length;
      tick().then(() => my === token && flow.fitView({ padding: 0.08, maxZoom: 1 }));
      return;
    }
    // Pull the path into a tree over the faded map: start each tree node at its map position, then let a CSS
    // transform transition carry it to its tree position around the current viewport centre.
    const r = box.getBoundingClientRect();
    const c = untrack(() => flow.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 }));
    const final = (n) => [c.x + n.rx, c.y + n.ry];
    nodes = s.nodes.map((n) => (n.tree ? (n.from ? toNode(n, n.from.x, n.from.y) : toNode(n, ...final(n))) : toNode(n)));
    edges = s.edges.filter((e) => !(NOBG && e.bg)).map((e) => toEdge(e, !!e.tree));
    perf.nodes = s.nodes.length; perf.edges = s.edges.length;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (my !== token) return;
      nodes = s.nodes.map((n) => (n.tree ? toNode(n, ...final(n), "anim") : toNode(n)));
      setTimeout(() => {
        if (my !== token) return;
        edges = s.edges.filter((e) => !(NOBG && e.bg)).map((e) => toEdge(e));
        flow.fitView({ nodes: s.tree.ids.map((id) => ({ id })), padding: 0.12, duration: 400, maxZoom: 1 });
      }, 650);
    }));
  });

  // Benchmark hook + "far" zoom flag (B renders tiles lite when they're too small to read).
  view.api = {
    get: () => flow.getViewport(),
    set: (v) => flow.setViewport(v),
    fitAll: () => flow.fitView({ padding: 0.05 }),
  };
  function onmove(_, v) { const far = v.zoom < 0.32; if (far !== view.far) view.far = far; }
</script>

<div class="flowbox" bind:this={box}>
  <SvelteFlow bind:nodes bind:edges {nodeTypes} {edgeTypes} onlyRenderVisibleElements={cull} minZoom={0.04} maxZoom={2.5}
    nodesDraggable={false} nodesConnectable={false} colorMode="system" {onmove}
    onnodeclick={({ node }) => { app.sel = node.id; }} onpaneclick={() => { app.sel = null; }}>
    <Background />
    <Controls showLock={false} />
    {#if !NOMINI}<MiniMap pannable zoomable />{/if}
    {#if bgPath}<ViewportPortal target="back"><svg class="bgedges"><path d={bgPath} /></svg></ViewportPortal>{/if}
  </SvelteFlow>
</div>
