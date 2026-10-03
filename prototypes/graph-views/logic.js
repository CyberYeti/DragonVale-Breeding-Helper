// PROTOTYPE (throwaway): shared rules for the graph-views prototype.
// Valid pair, Breedable now and the Focus view tree, per the Focus view rules ticket (#5).
(function () {
  const S = window.SNAPSHOT;
  const byName = new Map(S.dragons.map((d) => [d.name, d]));
  const PRIMARIES = ["Plant", "Fire", "Earth", "Cold", "Lightning", "Water", "Air", "Metal", "Light", "Dark"];
  const oppositeOf = new Map();
  for (const [a, b] of S.opposites) { oppositeOf.set(a, b); oppositeOf.set(b, a); }

  // Element bitmasks (two 32-bit halves) so pair checks are cheap.
  const elemIndex = new Map();
  const allElems = new Set();
  for (const d of S.dragons) {
    d.breedingElements.forEach((e) => allElems.add(e));
    for (const r of d.routes) (r.elements || []).concat(r.elementOnBothParents || []).forEach((e) => allElems.add(e));
  }
  [...allElems].forEach((e, i) => elemIndex.set(e, i));
  const mask = (list) => {
    let lo = 0, hi = 0;
    for (const e of list) { const i = elemIndex.get(e); if (i < 32) lo |= 1 << i; else hi |= 1 << (i - 32); }
    return [lo >>> 0, hi >>> 0];
  };
  const pop = (x) => { let c = 0; while (x) { x &= x - 1; c++; } return c; };
  for (const d of S.dragons) { d.mask = mask(d.breedingElements); d.isRiftDragon = d.elements.includes("Rift"); d.hasRiftForm = d.traits === "all"; }

  // Rotation overlay from Data:Limited.json
  const L = S.limitedRaw;
  const inRotation = new Set(Object.keys(L.dragons || {}));
  const purchaseOnly = new Set();
  const endDate = new Map(Object.entries(L.dragons || {}).map(([k, v]) => [k, v.countdown]));
  for (const ev of Object.values(L.events || {}))
    for (const [n, v] of Object.entries(ev.dragons || {})) {
      // Every event-shop Dragon is Available until the event (or its own countdown) ends; Breedable: false is Purchase only.
      inRotation.add(n); endDate.set(n, v.countdown || ev.countdown);
      if (v.Breedable === false) purchaseOnly.add(n);
    }
  const outOfRotation = (d) => d.isLimited && !inRotation.has(d.name);

  // ---- Collection: name -> {normal, rift}
  const coll = new Map();
  const owns = (name, form) => {
    const c = coll.get(name); if (!c) return false;
    const d = byName.get(name);
    if (d.isRiftDragon || !d.hasRiftForm) return !!c.normal;
    return form === "rift" ? !!c.rift : !!c.normal;
  };
  const ownsAny = (name) => { const c = coll.get(name); return !!(c && (c.normal || c.rift)); };
  function setOwned(name, form, val) {
    const c = coll.get(name) || { normal: false, rift: false };
    const d = byName.get(name);
    if (d.isRiftDragon || !d.hasRiftForm) c.normal = val; else c[form] = val;
    coll.set(name, c);
  }
  function preset(kind) {
    coll.clear();
    const pick = (f) => S.dragons.filter(f).forEach((d) => setOwned(d.name, "normal", true));
    if (kind === "new") {
      pick((d) => ["Plant", "Fire", "Earth", "Cold", "Lightning"].includes(d.name));
      pick((d) => ["Poison", "Flower", "Lava", "Scorch", "Tree", "Moss", "Firefly"].includes(d.name));
    } else if (kind === "mid") {
      pick((d) => d.rarity === "Primary" || d.rarity === "Hybrid");
      pick((d) => d.rarity === "Rare" && !d.isLimited && !d.elements.includes("Rift") && d.order < 420);
      pick((d) => ["Sun", "Moon", "Rainbow", "Love", "Flower"].includes(d.name));
      ["Lava", "Poison", "Blue Fire", "Plasma", "Moss"].forEach((n) => setOwned(n, "rift", true));
      ["Fire Rift", "Water Rift", "Air Rift"].forEach((n) => setOwned(n, "normal", true));
    }
  }

  // ---- Valid pair
  // Candidate parents for a breeding context (rift = Rift breeding).
  function candidates(rift) {
    const out = [];
    for (const d of S.dragons) {
      if (!d.canBeParent) continue;
      const ok = rift ? (d.isRiftDragon ? owns(d.name) : d.hasRiftForm && owns(d.name, "rift")) : ownsAny(d.name);
      if (ok) out.push(d);
    }
    return out;
  }
  // Collapse candidates by mask (primaries kept apart because of the opposites rule).
  function groups(cands) {
    const g = new Map();
    for (const d of cands) {
      const k = d.rarity === "Primary" ? "P:" + d.name : d.mask[0] + ":" + d.mask[1];
      if (!g.has(k)) g.set(k, { mask: d.mask, members: [], primary: d.rarity === "Primary" ? d.name : null });
      g.get(k).members.push(d);
    }
    return [...g.values()];
  }
  function whyInvalid(r, a, b) {
    if (!a.canBeParent || !b.canBeParent) return "cannot be a parent";
    if (a.rarity === "Primary" && b.rarity === "Primary" && oppositeOf.get(a.name) === b.name) return `${a.name} + ${b.name} are opposites`;
    const lo = (a.mask[0] | b.mask[0]) >>> 0, hi = (a.mask[1] | b.mask[1]) >>> 0;
    if (r.elements) { const [ml, mh] = mask(r.elements); if ((lo & ml) >>> 0 !== ml || (hi & mh) >>> 0 !== mh) return "missing elements"; }
    if (r.minDistinctElements && pop(lo) + pop(hi) < r.minDistinctElements) return `fewer than ${r.minDistinctElements} elements`;
    if (r.elementOnBothParents) { const [ml, mh] = mask(r.elementOnBothParents);
      for (const p of [a, b]) if ((p.mask[0] & ml) >>> 0 !== ml || (p.mask[1] & mh) >>> 0 !== mh) return "both parents must carry " + r.elementOnBothParents.join(", "); }
    return null;
  }
  // Returns up to `limit` valid pairs [a,b] from the Collection for route r.
  function validPairs(r, rift, limit = 1) {
    rift = rift || r.rift === "only";
    const cands = candidates(rift);
    const out = [];
    const named = r.parents || [];
    if (named.length === 2) {
      const [a, b] = named.map((n) => byName.get(n));
      if (a && b && cands.includes(a) && cands.includes(b) && !whyInvalid(r, a, b)) out.push([a, b]);
      return out;
    }
    if (named.length === 1) {
      const a = byName.get(named[0]);
      if (!a || !cands.includes(a)) return out;
      for (const b of cands) { if (!whyInvalid(r, a, b)) { out.push([a, b]); if (out.length >= limit) break; } }
      return out;
    }
    const gs = groups(cands);
    for (let i = 0; i < gs.length && out.length < limit; i++)
      for (let j = i; j < gs.length && out.length < limit; j++) {
        const a = gs[i].members[0], b = gs[j].members[0];
        if (!whyInvalid(r, a, b)) out.push([a, b]);
      }
    return out;
  }
  // Why a route has no valid pair even though its Elements are covered (for the click panel).
  function noPairReason(r, rift) {
    const cands = candidates(rift || r.rift === "only");
    const missing = (r.parents || []).filter((n) => !cands.some((c) => c.name === n));
    if (missing.length) return "Missing named parent: " + missing.join(", ");
    const prims = cands.filter((c) => c.rarity === "Primary");
    for (const a of prims) for (const b of prims) {
      const w = whyInvalid(r, a, b);
      if (w && w.includes("opposites") && !whyInvalid(r, { ...a, rarity: "x" }, b)) return w + ", so they can't be the pair";
    }
    return "No two owned Dragons cover the requirement between them";
  }
  const elementCovered = (e, rift) => candidates(rift).some((d) => d.breedingElements.includes(e));

  const needsOutOfRotation = (r) => (r.parents || []).map((n) => byName.get(n)).filter((p) => p && outOfRotation(p) && !ownsAny(p.name));

  function breedableNow(d, form) {
    if (owns(d.name, form)) return null;
    if (form === "rift" && !d.hasRiftForm) return null;
    if (purchaseOnly.has(d.name)) return null;
    if (outOfRotation(d)) return null;
    for (const r of d.routes) {
      if (r.kind !== "Bred") continue;
      if (needsOutOfRotation(r).length) continue;
      const p = validPairs(r, form === "rift" || d.isRiftDragon, 1);
      if (p.length) return { route: r, pair: p[0] };
    }
    return null;
  }
  function allBreedableNow() {
    const out = [];
    for (const d of S.dragons) {
      const n = breedableNow(d, "normal"); if (n) out.push({ d, form: "normal", ...n });
      if (d.hasRiftForm) { const rr = breedableNow(d, "rift"); if (rr) out.push({ d, form: "rift", ...rr }); }
    }
    return out;
  }

  // Basic dragon for an Element: fewest breeding elements, ties to earliest release.
  function basicDragon(e) {
    return S.dragons.filter((d) => d.breedingElements.includes(e) && d.canBeParent)
      .sort((a, b) => a.breedingElements.length - b.breedingElements.length || a.order - b.order);
  }

  // ---- Focus view tree: nodes + edges, as written in the requirement.
  function focus(targetName, form) {
    const nodes = new Map(), edges = [];
    const add = (id, data) => { if (!nodes.has(id)) nodes.set(id, { id, ...data }); return id; };
    const visit = (name, form) => {
      const d = byName.get(name);
      const id = "D:" + name + (form === "rift" && !d.isRiftDragon ? "~rift" : "");
      if (nodes.has(id)) return id;
      const owned = owns(name, form);
      add(id, { type: "dragon", name, form, owned, dimmed: outOfRotation(d) && !owned, d });
      if (owned && id !== rootId) return id;
      d.routes.forEach((r, i) => {
        const rid = id + "#R" + i;
        if (r.kind === "Purchased" || r.kind === "Summoned") { nodes.get(id).badges = (nodes.get(id).badges || []).concat(r.kind === "Purchased" ? "💰 Purchasable" : "✨ Summoned (dead end)"); return; }
        const rift = form === "rift" || r.rift === "only";
        const met = r.kind === "Bred" && validPairs(r, rift, 1).length > 0;
        const oor = r.kind === "Bred" ? needsOutOfRotation(r) : [];
        add(rid, { type: "route", kind: r.kind, r, met, rift, dimmed: oor.length > 0, oor: oor.map((p) => p.name), purchaseOnly: purchaseOnly.has(name), owner: name });
        edges.push({ source: rid, target: id, kind: "route" });
        if (r.kind === "Evolved") { const b = visit(r.from, "normal"); edges.push({ source: b, target: rid, kind: "evolves", label: "evolves (" + (r.decorations || []).join(", ") + ")" }); return; }
        if (r.kind === "Co-op bred") { const f = add("F:" + r.friendsDragon, { type: "friend", name: "Friend's " + r.friendsDragon }); edges.push({ source: f, target: rid, kind: "coop" }); return; }
        for (const e of r.elements || []) { const eid = add("E:" + e + (rift ? "~rift" : ""), { type: "element", name: e, rift, covered: elementCovered(e, rift) }); edges.push({ source: eid, target: rid, kind: "elem", route: rid }); }
        for (const e of r.elementOnBothParents || []) { const eid = add("E:" + e + (rift ? "~rift" : ""), { type: "element", name: e, rift, covered: elementCovered(e, rift) }); edges.push({ source: eid, target: rid, kind: "elem", label: "×2 both", route: rid }); }
        if (r.minDistinctElements) { const x = add(rid + "#min", { type: "rule", name: `Any ${r.minDistinctElements}+ elements` }); edges.push({ source: x, target: rid, kind: "elem", route: rid }); }
        if (r.anyPair) { const x = add(rid + "#any", { type: "rule", name: "Any pair" }); edges.push({ source: x, target: rid, kind: "elem", route: rid }); }
        for (const p of r.parents || []) {
          if (purchaseOnly.has(name)) { const pid = add("D:" + p + (rift && !byName.get(p).isRiftDragon ? "~rift" : ""), { type: "dragon", name: p, form: rift ? "rift" : "normal", owned: owns(p, rift ? "rift" : "normal"), d: byName.get(p), dimmed: false }); edges.push({ source: pid, target: rid, kind: "parent" }); continue; }
          const pid = visit(p, rift ? "rift" : "normal");
          edges.push({ source: pid, target: rid, kind: "parent" });
        }
      });
      return id;
    };
    const rootId = "D:" + targetName + (form === "rift" && !byName.get(targetName).isRiftDragon ? "~rift" : "");
    visit(targetName, form);
    nodes.get(rootId).root = true;
    return { nodes: [...nodes.values()], edges, rootId };
  }

  function routeText(r) {
    if (r.kind === "Evolved") return `Evolves from ${r.from}`;
    if (r.kind === "Co-op bred") return `Co-op with a friend's ${r.friendsDragon}`;
    if (r.kind !== "Bred") return r.kind;
    const bits = [...(r.parents || []), ...(r.elements || [])];
    if (r.elementOnBothParents) bits.push("both: " + r.elementOnBothParents.join("+"));
    if (r.minDistinctElements) bits.push(`any ${r.minDistinctElements}+ elements`);
    if (r.anyPair) bits.push("any pair");
    return bits.join(" + ") + (r.rift === "only" ? " (Rift)" : "");
  }
  function conditionBadges(r) {
    const c = r.conditions || {}, b = [];
    if (c.time) b.push((c.time === "Day" ? "☀️ " : "🌙 ") + c.time);
    if (c.weather) b.push("🌦 " + c.weather);
    if (c.alignment) b.push("🧭 Rift aligned " + c.alignment);
    if (c.parentTrait) b.push("🔹 Parent with " + c.parentTrait.join("/") + " trait");
    if (c.namedParentTrait) b.push("🔹 Named parent traits");
    if (c.prerequisite) b.push("📌 Needs " + [].concat(c.prerequisite).join(", "));
    return b;
  }

  window.DV = { S, byName, PRIMARIES, coll, owns, ownsAny, setOwned, preset, validPairs, noPairReason, elementCovered, breedableNow, allBreedableNow,
    basicDragon, focus, routeText, conditionBadges, outOfRotation, inRotation, purchaseOnly, endDate, candidates, needsOutOfRotation };
})();
