<script>
  // Variant C (the fallback): Cytoscape draws edges and does hit-testing on invisible nodes; the real tile
  // components float over them in an HTML layer that follows Cytoscape's pan/zoom. Culled + lite, like B.
  import { onMount } from "svelte";
  import cytoscape from "cytoscape";
  import DragonTile from "../DragonTile.svelte";
  import ElementTile from "../ElementTile.svelte";
  import RoutePill from "../RoutePill.svelte";
  import Popover from "../Popover.svelte";
  import { app, perf } from "../state.svelte.js";
  import { view } from "../view.svelte.js";
  import { panelNode } from "../scene.js";

  let { scene } = $props();
  let el, cy;
  let vp = $state({ x: 0, y: 0, zoom: 1 });
  let items = $state.raw([]);
  const pos = new Map();
  let dirty = false;

  const style = [
    { selector: "node", style: { "background-opacity": 0, "border-width": 0, shape: "round-rectangle", width: "data(w)", height: "data(h)", label: "" } },
    { selector: "edge", style: { width: 1.6, "line-color": "#8a8a8a", "curve-style": "bezier", "target-arrow-shape": "triangle", "target-arrow-color": "#8a8a8a", "arrow-scale": 0.8 } },
    { selector: "edge.k-parent", style: { width: 2.6, "line-color": "#555", "target-arrow-color": "#555" } },
    { selector: "edge.k-evolves", style: { "line-style": "dashed", "line-color": "#8e24aa", "target-arrow-color": "#8e24aa" } },
    { selector: "edge.k-coop", style: { "line-style": "dotted" } },
    { selector: "edge[label]", style: { label: "data(label)", "font-size": 10, "text-background-color": "#fff", "text-background-opacity": 1, "text-background-padding": 2, "text-background-shape": "round-rectangle", "text-border-width": 1, "text-border-color": "#bbb", "text-border-opacity": 1 } },
    { selector: "edge.bg", style: { opacity: 0.05, "target-arrow-shape": "none", width: 1 } },
    { selector: "edge.hide", style: { display: "none" } },
    { selector: "node.hide", style: { display: "none" } },
  ];

  function schedule() {
    if (dirty) return;
    dirty = true;
    requestAnimationFrame(() => {
      dirty = false;
      if (!cy) return;
      const z = cy.zoom(), p = cy.pan();
      vp = { x: p.x, y: p.y, zoom: z };
      const far = z < 0.32; if (far !== view.far) view.far = far;
      const ext = cy.extent(), m = 150;
      items = scene.nodes.filter((n) => {
        if (n.hidden) return false;
        const q = pos.get(n.id) || n;
        return q.x + n.w / 2 > ext.x1 - m && q.x - n.w / 2 < ext.x2 + m && q.y + n.h / 2 > ext.y1 - m && q.y - n.h / 2 < ext.y2 + m;
      });
    });
  }

  function build(s) {
    pos.clear();
    const r = el.getBoundingClientRect();
    const c = cy ? { x: (r.width / 2 - cy.pan().x) / cy.zoom(), y: (r.height / 2 - cy.pan().y) / cy.zoom() } : { x: 0, y: 0 };
    const start = (n) => (n.tree ? (n.from || { x: c.x + n.rx, y: c.y + n.ry }) : { x: n.x, y: n.y });
    const els = [
      ...s.nodes.map((n) => ({ data: { id: n.id, w: n.w, h: n.h }, position: start(n), classes: n.hidden ? "hide" : "" })),
      ...s.edges.map((e) => ({ data: { id: e.id, source: e.source, target: e.target, ...(e.label && !e.bg ? { label: e.label } : {}) }, classes: `k-${e.kind} ${e.bg ? "bg" : ""} ${e.tree ? "hide tree" : ""}` })),
    ];
    for (const n of s.nodes) pos.set(n.id, start(n));
    const keep = s.tree && cy ? { zoom: cy.zoom(), pan: { ...cy.pan() } } : null;
    if (cy) cy.destroy();
    cy = cytoscape({ container: el, elements: els, style, layout: { name: "preset" }, minZoom: 0.04, maxZoom: 2.5, wheelSensitivity: 0.3, autoungrabify: true });
    perf.nodes = s.nodes.length; perf.edges = s.edges.length;
    cy.on("viewport", schedule);
    cy.on("position", "node", (e) => { pos.set(e.target.id(), { ...e.target.position() }); schedule(); });
    cy.on("tap", "node", (e) => { app.sel = e.target.id(); });
    cy.on("tap", (e) => { if (e.target === cy) app.sel = null; });
    if (keep) cy.viewport(keep); else { cy.fit(undefined, 20); if (cy.zoom() > 1) { cy.zoom(1); cy.center(); } }
    schedule();
    if (s.tree) {
      const tree = cy.collection(s.tree.ids.map((id) => cy.getElementById(id)));
      let left = tree.length;
      tree.forEach((node) => {
        const n = s.nodes.find((x) => x.id === node.id());
        node.animate({ position: { x: c.x + n.rx, y: c.y + n.ry } }, { duration: 600, complete: () => {
          if (--left === 0) { cy.edges(".tree").removeClass("hide"); cy.animate({ fit: { eles: tree, padding: 60 } }, { duration: 400 }); }
        } });
      });
    }
  }

  onMount(() => {
    view.api = { get: () => ({ ...cy.pan(), zoom: cy.zoom() }), set: (v) => cy.viewport({ zoom: v.zoom, pan: { x: v.x, y: v.y } }), fitAll: () => cy.fit(undefined, 20) };
    return () => cy && cy.destroy();
  });
  $effect(() => { build(scene); });

  const sel = $derived(app.sel ? scene.nodes.find((n) => n.id === app.sel) : null);
  const selPos = $derived.by(() => { if (!sel) return null; vp; const p = pos.get(sel.id) || sel; return { left: (p.x + sel.w / 2) * vp.zoom + vp.x + 10, top: (p.y - sel.h / 2) * vp.zoom + vp.y }; });
</script>

<div class="cybox">
  <div class="cy" bind:this={el}></div>
  <div class="ov">
    <div class="layer" style="transform: translate({vp.x}px, {vp.y}px) scale({vp.zoom})">
      {#each items as n (n.id)}
        {@const p = pos.get(n.id) || n}
        <div class="ovn" class:tree={n.tree} style="left:{p.x - n.w / 2}px; top:{p.y - n.h / 2}px; width:{n.w}px; height:{n.h}px">
          {#if n.kind === "dragon"}<DragonTile d={n.d} form={n.form} size={n.root ? "root" : "md"} lite={n.faded || view.far} faded={n.faded} root={n.root} picked={app.sel === n.id} />
          {:else if n.kind === "element"}<ElementTile name={n.name} rift={n.rift} faded={n.faded} lite={n.faded || view.far} picked={app.sel === n.id} />
          {:else if n.kind === "route"}<RoutePill n={n.n} picked={app.sel === n.id} />
          {:else}<div class="note-node">{n.title}</div>{/if}
        </div>
      {/each}
    </div>
    {#if sel && selPos}<div class="ovpop" style="left:{selPos.left}px; top:{selPos.top}px"><Popover node={panelNode(sel)} /></div>{/if}
  </div>
</div>
