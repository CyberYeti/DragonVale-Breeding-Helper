<script>
  // PROTOTYPE (throwaway) for #17. See index.html for the variants.
  import { onMount } from "svelte";
  import FlowView from "./lib/flow/FlowView.svelte";
  import CyView from "./lib/cy/CyView.svelte";
  import DragonTile from "./lib/DragonTile.svelte";
  import Sheet from "./lib/Sheet.svelte";
  import { DV, S, PAGES } from "./lib/dv.js";
  import { app, perf, syncUrl, setPreset } from "./lib/state.svelte.js";
  import { view } from "./lib/view.svelte.js";
  import { buildScene, panelNode } from "./lib/scene.js";

  const VARIANTS = { A: "Svelte Flow · full tiles", B: "Svelte Flow · culled + lite", C: "Cytoscape + floated tiles" };
  const keys = Object.keys(VARIANTS);
  const cycle = (k) => { app.variant = keys[(keys.indexOf(app.variant) + k + keys.length) % keys.length]; app.sel = null; };

  const scene = $derived.by(() => {
    if (app.mode === "menu") return null;
    const t0 = performance.now();
    const s = buildScene({ mode: app.mode, target: app.target, form: app.form, page: app.page, focused: app.focused });
    s.ms = Math.round(performance.now() - t0);
    return s;
  });
  $effect(() => { if (scene) perf.layoutMs = scene.ms; });
  const selNode = $derived(app.sel && scene ? scene.nodes.find((n) => n.id === app.sel) : null);
  $effect(() => { app.variant; app.mode; app.target; app.form; app.page; app.preset; app.focused; syncUrl(); });
  $effect(() => { app.target; app.mode; app.sel = null; app.sheet = false; });
  const menuDragons = $derived((PAGES.find((p) => p.name === app.page) || PAGES[0]).dragons.map((n) => DV.byName.get(n)).filter(Boolean));

  // ---- perf HUD: fps over the last second, worst frame in the last 2 s, DOM size
  let frames = [];
  onMount(() => {
    let raf, last = performance.now();
    const loop = (t) => {
      frames.push([t, t - last]); last = t;
      while (frames.length && frames[0][0] < t - 2000) frames.shift();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const iv = setInterval(() => {
      const t = performance.now(), sec = frames.filter((f) => f[0] > t - 1000);
      perf.fps = sec.length; perf.worst = Math.round(Math.max(0, ...frames.map((f) => f[1])));
      perf.dom = document.getElementsByTagName("*").length; perf.tiles = document.querySelectorAll(".tile, .etile").length;
    }, 500);
    const onkey = (e) => {
      if (e.target.closest("input,textarea,select,[contenteditable]")) return;
      if (e.key === "ArrowLeft") cycle(-1); if (e.key === "ArrowRight") cycle(1);
      if (e.key === "Escape") { app.sel = null; app.sheet = false; }
    };
    addEventListener("keydown", onkey);
    return () => { cancelAnimationFrame(raf); clearInterval(iv); removeEventListener("keydown", onkey); };
  });

  // ---- benchmark: scripted pan/zoom, (1) overview (all tiles on screen), (2) close-up pan across the map.
  async function bench(ms = 3000) {
    const api = view.api; if (!api) return null;
    const run = (dur, step) => new Promise((res) => {
      const ts = []; let t0 = null, prev = null;
      const f = (t) => {
        if (t0 === null) { t0 = t; prev = t; }
        ts.push(t - prev); prev = t;
        const k = (t - t0) / dur; step(k);
        if (t - t0 < dur) requestAnimationFrame(f); else res(ts.slice(2));
      };
      requestAnimationFrame(f);
    });
    const stats = (ts) => { const s = [...ts].sort((a, b) => a - b); const avg = ts.reduce((a, b) => a + b, 0) / ts.length;
      return { fps: Math.round(1000 / avg), p95: Math.round(s[Math.floor(s.length * 0.95)]), worst: Math.round(s[s.length - 1]), frames: ts.length }; };
    api.fitAll(); await new Promise((r) => setTimeout(r, 600));
    const v0 = api.get();
    const overview = stats(await run(ms, (k) => { const z = v0.zoom * (1 + 0.25 * Math.sin(k * Math.PI * 4)); api.set({ x: v0.x + 80 * Math.sin(k * 6), y: v0.y, zoom: z }); }));
    const close = stats(await run(ms, (k) => { api.set({ x: v0.x - k * 4000, y: v0.y + 300 + 200 * Math.sin(k * 6), zoom: 0.8 }); }));
    api.fitAll();
    perf.bench = { variant: app.variant, mode: app.mode, overview, close };
    return JSON.parse(JSON.stringify(perf.bench));
  }
  if (new URLSearchParams(location.search).get("farimg") === "0") document.body.classList.add("noimg");
  window.__bench = bench;
  window.__app = app;
</script>

<header>
  <b>Tile nodes spike</b>
  <select bind:value={app.mode}>
    <option value="whole">Whole graph (983)</option>
    <option value="page">Dragonarium page graph</option>
    <option value="focus">Focus tree</option>
    <option value="menu">Menu grid (same tile)</option>
  </select>
  {#if app.mode === "page" || app.mode === "menu"}
    <select bind:value={app.page}>{#each PAGES as p}<option value={p.name}>{p.name} ({p.dragons.length})</option>{/each}</select>
  {/if}
  {#if app.mode !== "page" && app.mode !== "menu"}
    <input list="names" bind:value={app.target} placeholder="Target" />
    <select bind:value={app.form}><option value="normal">Normal</option><option value="rift">Rift form</option></select>
  {/if}
  {#if app.mode === "whole"}<label><input type="checkbox" bind:checked={app.focused} /> Focus the Target (pull its path into a tree)</label>{/if}
  <select value={app.preset} onchange={(e) => setPreset(e.currentTarget.value)}><option value="new">New player</option><option value="mid">Mid-game</option></select>
  <button onclick={() => bench()}>Benchmark</button>
  <datalist id="names">{#each S.dragons as d}<option value={d.name}></option>{/each}</datalist>
</header>

<main>
  {#if app.mode === "menu"}
    <div class="grid">{#each menuDragons as d (d.name)}<DragonTile {d} onclick={() => { app.target = d.name; app.mode = "focus"; }} />{/each}</div>
  {:else if app.variant === "C"}
    <CyView {scene} />
  {:else}
    {#key app.variant}<FlowView {scene} liteMode={app.variant === "B"} cull={app.variant === "B"} />{/key}
  {/if}
  {#if app.sheet && selNode}<Sheet node={panelNode(selNode)} />{/if}

  <div class="hud">
    <div><b class:bad={perf.fps < 40} class:ok={perf.fps >= 55}>{perf.fps} fps</b> · worst frame {perf.worst} ms</div>
    <div>{perf.tiles} tiles in DOM · {perf.dom} DOM elements</div>
    <div>{perf.nodes} nodes · {perf.edges} edges · scene {perf.layoutMs} ms</div>
    {#if perf.bench}<div class="small">Bench {perf.bench.variant}/{perf.bench.mode}: overview {perf.bench.overview.fps} fps (p95 {perf.bench.overview.p95} ms) · close {perf.bench.close.fps} fps (p95 {perf.bench.close.p95} ms)</div>{/if}
  </div>
</main>

<div class="switcher">
  <button onclick={() => cycle(-1)}>←</button>
  <span>{app.variant} · {VARIANTS[app.variant]}</span>
  <button onclick={() => cycle(1)}>→</button>
</div>
