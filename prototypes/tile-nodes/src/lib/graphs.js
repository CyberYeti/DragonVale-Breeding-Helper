// PROTOTYPE: renderer-neutral graphs. Nodes carry CENTER x,y plus w,h; each variant converts.
// All layouts are computed here (dagre / generation bands) so Svelte Flow and Cytoscape draw identical positions.
import dagre from "@dagrejs/dagre";
import { DV, S, PAGES } from "./dv.js";

export const SIZE = { dragon: [96, 136], root: [124, 168], element: [64, 78], note: [120, 40] };
const pillH = (n) => 30 + 20 * ((n.purchaseOnly ? 1 : 0) + (n.oor.length ? 1 : 0) + DV.conditionBadges(n.r).length);

function dagreLayout(nodes, edges, opt = {}) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "BT", nodesep: opt.nodesep ?? 28, ranksep: opt.ranksep ?? 70, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: n.w, height: n.h });
  for (const e of edges) if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  dagre.layout(g);
  for (const n of nodes) { const p = g.node(n.id); n.x = p.x; n.y = p.y; }
}

// ---- Focus tree (#5 rules, via DV.focus): Dragon, Route pill, Element and note nodes.
export function focusGraph(target, form, prefix = "") {
  const f = DV.focus(target, form);
  const nodes = f.nodes.map((n) => {
    const id = prefix + n.id;
    if (n.type === "dragon") { const [w, h] = n.root ? SIZE.root : SIZE.dragon; return { id, kind: "dragon", w, h, d: n.d, form: n.form, root: !!n.root, src: n }; }
    if (n.type === "element") return { id, kind: "element", w: SIZE.element[0], h: SIZE.element[1], name: n.name, rift: n.rift, src: n };
    if (n.type === "route") return { id, kind: "route", w: 140, h: pillH(n), n, src: n };
    return { id, kind: "note", w: SIZE.note[0], h: SIZE.note[1], title: n.name, src: n };
  });
  const edges = f.edges.map((e) => ({ id: prefix + e.source + ">" + e.target, source: prefix + e.source, target: prefix + e.target, kind: e.kind,
    label: e.kind === "coop" ? "co-op only" : e.label || null, route: e.route ? prefix + e.route : null }));
  dagreLayout(nodes, edges);
  return { nodes, edges, rootId: prefix + f.rootId };
}

// ---- Dragonarium page graph: the page's Dragons plus their named ancestors, bred from shared Element nodes.
const sources = (d) => {
  const r = d.routes[0], out = [];
  for (const e of [...(r.elements || []), ...(r.elementOnBothParents || [])]) out.push("E:" + e);
  for (const p of r.parents || []) if (DV.byName.has(p) && p !== d.name) out.push("D:" + p);
  if (r.from && DV.byName.has(r.from)) out.push("D:" + r.from);
  return out;
};
const edgeKind = (d, s) => (s.startsWith("E:") ? "elem" : d.routes[0].from ? "evolves" : "parent");

export function pageGraph(pageName) {
  const page = PAGES.find((p) => p.name === pageName) || PAGES[0];
  const want = new Set();
  const add = (name) => { if (want.has(name)) return; want.add(name); for (const s of sources(DV.byName.get(name))) if (s.startsWith("D:")) add(s.slice(2)); };
  page.dragons.filter((n) => DV.byName.has(n)).forEach(add);
  const nodes = [], edges = [], els = new Set();
  for (const name of want) {
    const d = DV.byName.get(name);
    nodes.push({ id: "D:" + name, kind: "dragon", w: SIZE.dragon[0], h: SIZE.dragon[1], d, form: "normal", onPage: page.dragons.includes(name) });
    for (const s of sources(d)) { if (s.startsWith("E:")) els.add(s.slice(2)); edges.push({ id: s + ">D:" + name, source: s, target: "D:" + name, kind: edgeKind(d, s) }); }
  }
  for (const e of els) nodes.push({ id: "E:" + e, kind: "element", w: SIZE.element[0], h: SIZE.element[1], name: e, rift: false });
  dagreLayout(nodes, edges, { nodesep: 18, ranksep: 90 });
  return { nodes, edges };
}

// ---- Whole graph: every Dragon, bottom-up by generation (port of the graph-views variant B layout, tile-sized).
let wholeCache = null;
export function wholeGraph() {
  if (wholeCache) return wholeCache;
  const DX = 112, DY = 156, EGAP = 330, BANDGAP = 220, SPREAD = 6;
  const pos = new Map();
  const others = [...new Set(S.dragons.flatMap((d) => d.routes.flatMap((r) => [...(r.elements || []), ...(r.elementOnBothParents || [])])))].filter((e) => !DV.PRIMARIES.includes(e));
  const elems = [...DV.PRIMARIES, ...others];
  elems.forEach((e, i) => pos.set("E:" + e, { x: i * EGAP, y: 0 }));
  const rank = new Map(), visiting = new Set();
  const rankOf = (d) => {
    if (rank.has(d.name)) return rank.get(d.name);
    if (visiting.has(d.name)) return 1;
    visiting.add(d.name);
    let r = 1;
    for (const s of sources(d)) if (s.startsWith("D:")) r = Math.max(r, rankOf(DV.byName.get(s.slice(2))) + 1);
    visiting.delete(d.name); rank.set(d.name, r); return r;
  };
  const byRank = new Map();
  for (const d of S.dragons) { const r = rankOf(d); (byRank.get(r) || byRank.set(r, []).get(r)).push(d); }
  let top = -DY * 1.5;
  for (const r of [...byRank.keys()].sort((a, b) => a - b)) {
    const items = byRank.get(r).map((d) => {
      const pts = sources(d).map((s) => pos.get(s)).filter(Boolean);
      const use = pts.length ? pts : d.breedingElements.map((e) => pos.get("E:" + e)).filter(Boolean);
      return { id: "D:" + d.name, x: use.length ? use.reduce((a, p) => a + p.x, 0) / use.length : 0 };
    });
    const fill = new Map();
    let rows = 0;
    for (const it of items.sort((a, b) => a.x - b.x)) {
      const c0 = Math.round(it.x / DX);
      let best = c0, bestFill = Infinity;
      for (let k = 0; k <= SPREAD; k++) for (const c of k ? [c0 - k, c0 + k] : [c0]) { const f = fill.get(c) || 0; if (f < bestFill) { best = c; bestFill = f; } }
      fill.set(best, bestFill + 1); rows = Math.max(rows, bestFill + 1);
      pos.set(it.id, { x: best * DX, y: top - bestFill * DY });
    }
    top -= rows * DY + BANDGAP;
  }
  const nodes = [], edges = [];
  for (const e of elems) nodes.push({ id: "E:" + e, kind: "element", w: SIZE.element[0], h: SIZE.element[1], name: e, rift: false, ...pos.get("E:" + e) });
  for (const d of S.dragons) {
    nodes.push({ id: "D:" + d.name, kind: "dragon", w: SIZE.dragon[0], h: SIZE.dragon[1], d, form: "normal", ...pos.get("D:" + d.name) });
    for (const s of sources(d)) edges.push({ id: s + ">D:" + d.name, source: s, target: "D:" + d.name, kind: edgeKind(d, s), bg: true });
  }
  return (wholeCache = { nodes, edges });
}

// Map a focus-tree node to the whole-graph node it was pulled out of (for the start of the animation).
export const mapIdOf = (fn) => (fn.kind === "dragon" ? "D:" + fn.d.name : fn.kind === "element" ? "E:" + fn.name : null);
