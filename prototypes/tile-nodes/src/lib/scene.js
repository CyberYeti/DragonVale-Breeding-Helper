// PROTOTYPE: what to draw for the current mode. Whole + focused = the faded 983-tile map plus the Target's
// Focus tree laid over it (variant B of #7). Tree nodes carry `from` (their map position) for the pull animation.
import { focusGraph, pageGraph, wholeGraph, mapIdOf } from "./graphs.js";

export function buildScene({ mode, target, form, page, focused }) {
  if (mode === "focus") { const f = focusGraph(target, form); return { nodes: f.nodes, edges: f.edges, tree: null }; }
  if (mode === "page") { const p = pageGraph(page); return { nodes: p.nodes, edges: p.edges, tree: null }; }
  const w = wholeGraph();
  if (!focused) return { nodes: w.nodes, edges: w.edges, tree: null };
  const t = focusGraph(target, form, "T:");
  const inTree = new Set(t.nodes.map(mapIdOf).filter(Boolean));
  const byId = new Map(w.nodes.map((n) => [n.id, n]));
  const xs = t.nodes.map((n) => n.x), ys = t.nodes.map((n) => n.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const tree = t.nodes.map((n) => {
    const m = byId.get(mapIdOf(n));
    return { ...n, tree: true, rx: n.x - cx, ry: n.y - cy, from: m ? { x: m.x, y: m.y } : null };
  });
  const base = w.nodes.map((n) => ({ ...n, faded: true, hidden: n.kind === "dragon" && inTree.has(n.id) }));
  return { nodes: [...base, ...tree], edges: [...w.edges, ...t.edges.map((e) => ({ ...e, tree: true }))], tree: { rootId: t.rootId, ids: tree.map((n) => n.id) } };
}

// The click panel's node shape (DV.focus style) for any scene node.
export function panelNode(n) {
  if (n.src) return n.src;
  if (n.kind === "dragon") return { type: "dragon", name: n.d.name, form: n.form || "normal" };
  if (n.kind === "element") return { type: "element", name: n.name, rift: !!n.rift };
  return null;
}
