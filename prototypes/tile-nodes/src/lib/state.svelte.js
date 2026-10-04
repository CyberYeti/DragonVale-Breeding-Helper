// PROTOTYPE: app state shared by every variant. The Collection lives in memory (DV.coll); `rev` bumps on change.
import { DV } from "./dv.js";

const q = new URLSearchParams(location.search);
export const app = $state({
  variant: q.get("variant") || "A",
  mode: q.get("mode") || "whole", // focus | page | whole
  target: q.get("target") || "Mesmer",
  form: q.get("form") || "normal",
  page: q.get("page") || "Spooky",
  preset: q.get("preset") || "mid",
  focused: q.get("focused") !== "0", // whole graph: pull the Target's path into a tree
  rev: 0,
  sel: null, // selected node id (popover)
  sheet: false, // Details side sheet open
});
DV.preset(app.preset);

export function syncUrl() {
  const u = new URL(location);
  for (const k of ["variant", "mode", "target", "form", "page", "preset"]) u.searchParams.set(k, app[k]);
  u.searchParams.set("focused", app.focused ? "1" : "0");
  history.replaceState(null, "", u);
}

let cache = { rev: -1, set: null };
export function breedSet() {
  if (cache.rev !== app.rev) cache = { rev: app.rev, set: new Set(DV.allBreedableNow().map((x) => x.d.name + "|" + x.form)) };
  return cache.set;
}
export const owned = (d, form) => (app.rev, DV.owns(d.name, form || "normal"));
export const breedable = (d, form) => (app.rev, breedSet().has(d.name + "|" + (form || "normal")));
export function toggle(d, form) { DV.setOwned(d.name, form, !DV.owns(d.name, form)); app.rev++; }
export function setPreset(p) { app.preset = p; DV.preset(p); app.rev++; }

// Banners from the menu layout ticket (#14).
export function banner(d, form) {
  if (DV.purchaseOnly.has(d.name)) return "Purchase only";
  if (DV.outOfRotation(d)) return "Not available";
  const k = d.routes.map((r) => r.kind);
  if (!k.includes("Bred") && !k.includes("Co-op bred")) {
    if (k.includes("Summoned")) return "Summoning only";
    if (k.includes("Evolved")) return "Evolution only";
    if (k.includes("Purchased")) return "Shop only";
  }
  if (form === "rift" && !d.hasRiftForm && !d.isRiftDragon) return "Not breedable in Rift cave";
  return null;
}

// Perf numbers the HUD shows and the benchmark returns.
export const perf = $state({ fps: 0, worst: 0, dom: 0, tiles: 0, nodes: 0, edges: 0, bench: null, layoutMs: 0 });
