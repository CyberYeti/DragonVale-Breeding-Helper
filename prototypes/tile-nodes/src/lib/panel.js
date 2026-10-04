// PROTOTYPE: click-panel view model, ported from prototypes/click-panel (#15). One set of panel data feeds
// both the popover (short rendering) and the Details side sheet.
import { DV, S } from "./dv.js";
import { breedable } from "./state.svelte.js";

function whyInvalid(r, a, b) {
  if (!a.canBeParent || !b.canBeParent) return "x";
  if (S.opposites.some(([x, y]) => (a.name === x && b.name === y) || (a.name === y && b.name === x))) return "x";
  const pool = new Set([...a.breedingElements, ...b.breedingElements]);
  if ((r.elements || []).some((e) => !pool.has(e))) return "x";
  if (r.minDistinctElements && pool.size < r.minDistinctElements) return "x";
  if ((r.elementOnBothParents || []).some((e) => !a.breedingElements.includes(e) || !b.breedingElements.includes(e))) return "x";
  return null;
}
function allPairs(r, rift) {
  rift = rift || r.rift === "only";
  const c = DV.candidates(rift), out = [];
  for (let i = 0; i < c.length; i++) for (let j = i; j < c.length; j++) {
    const a = c[i], b = c[j];
    if (r.parents && r.parents.length === 2 && [a.name, b.name].sort().join() !== [...r.parents].sort().join()) continue;
    if (r.parents && r.parents.length === 1 && a.name !== r.parents[0] && b.name !== r.parents[0]) continue;
    if (!whyInvalid(r, a, b)) out.push([a, b]);
  }
  const w = (p) => p[0].breedingElements.length + p[1].breedingElements.length;
  return out.sort((x, y) => w(x) - w(y) || x[0].order + x[1].order - y[0].order - y[1].order);
}
function suggestions(r, rift, ownerName, target) {
  const owned = DV.candidates(rift), out = [];
  for (const d of S.dragons) {
    if (!d.canBeParent || owned.includes(d) || d.name === ownerName || d.name === target) continue;
    if (rift && !(d.isRiftDragon || d.hasRiftForm)) continue;
    const partner = owned.find((o) => {
      if (r.parents && r.parents.length && !r.parents.includes(d.name) && !r.parents.includes(o.name)) return false;
      if (r.parents && r.parents.length === 2 && [d.name, o.name].sort().join() !== [...r.parents].sort().join()) return false;
      return !whyInvalid(r, d, o);
    });
    if (partner) out.push({ d, with: partner, now: breedable(d, rift ? "rift" : "normal"), locked: DV.outOfRotation(d) || DV.purchaseOnly.has(d.name) });
  }
  return out.sort((a, b) => b.now - a.now || a.locked - b.locked || a.d.breedingElements.length - b.d.breedingElements.length || a.d.order - b.d.order).slice(0, 12);
}

export function vm(n, target) {
  if (!n) return null;
  if (n.type === "dragon") {
    const d = DV.byName.get(n.name), form = n.form || "normal";
    const b = DV.breedableNow(d, form);
    let head, tone, reason;
    if (DV.owns(d.name, form)) { head = "Owned"; tone = "ok"; }
    else if (b) { head = "Breedable now"; tone = "ok"; reason = `${b.pair[0].name} + ${b.pair[1].name}`; }
    else {
      const why = [];
      if (DV.outOfRotation(d)) why.push("not in the Limited rotation");
      if (DV.purchaseOnly.has(d.name)) why.push("Purchase only right now");
      if (d.routes.every((r) => r.kind !== "Bred")) why.push("no Bred Route (" + d.routes.map((r) => r.kind).join(", ") + ")");
      if (!why.length) why.push("no Route is met by a Valid pair yet");
      head = "Can't breed now"; tone = "bad"; reason = why.join("; ");
    }
    return { kind: "dragon", title: d.name, d, form, head, tone, reason, top: b ? [b.pair] : [] };
  }
  if (n.type === "route") {
    const r = n.r, rift = n.rift, text = DV.routeText(r);
    const base = { kind: "route", title: text, r, rift, badges: DV.conditionBadges(r), form: rift ? "rift" : "normal" };
    if (r.kind !== "Bred") return { ...base, head: r.kind, tone: "muted", top: [] };
    const pairs = allPairs(r, rift);
    if (pairs.length) return { ...base, head: `✔ Met · ${pairs.length} Valid pair${pairs.length > 1 ? "s" : ""}`, tone: "ok", pairs, top: pairs.slice(0, 3) };
    const sugg = suggestions(r, rift, n.owner, target);
    const uncovered = [...new Set((r.elements || []).concat(r.elementOnBothParents || []).filter((e) => !DV.elementCovered(e, rift)))];
    const missingParents = (r.parents || []).filter((p) => !DV.candidates(rift).some((c) => c.name === p));
    if (uncovered.length || missingParents.length)
      return { ...base, head: "Not met: something's missing", tone: "bad", reason: "Missing " + [...uncovered, ...missingParents].join(", "), sugg, topSugg: sugg.slice(0, 3),
        basics: uncovered.map((e) => ({ e, d: DV.basicDragon(e)[0] })).filter((x) => x.d), missingParents: missingParents.map((p) => DV.byName.get(p)) };
    return { ...base, head: "No Valid pair yet", tone: "warn", reason: DV.noPairReason(r, rift), sugg, topSugg: sugg.slice(0, 3) };
  }
  if (n.type === "element") {
    const carriers = DV.candidates(n.rift).filter((d) => d.breedingElements.includes(n.name)).sort((a, b) => a.breedingElements.length - b.breedingElements.length || a.order - b.order);
    const all = DV.basicDragon(n.name).filter((d) => !n.rift || d.isRiftDragon || d.hasRiftForm);
    return { kind: "element", title: n.name + (n.rift ? " (Rift)" : ""), head: carriers.length ? `${carriers.length} of yours carry it` : "Nobody in your Collection carries it",
      tone: carriers.length ? "ok" : "bad", carriers, basic: all[0], alts: all.slice(1, 25), form: n.rift ? "rift" : "normal" };
  }
  return { kind: "note", title: n.name, head: n.type === "friend" ? "A friend's Dragon" : "Rule", tone: "muted",
    reason: n.type === "friend" ? "Used in the Cooperative cave; never checked against your Collection." : "Any pair whose combined elements meet the rule." };
}
