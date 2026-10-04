<script>
  // Route pill: one requirement record. Headline from the click-panel rules; condition badges underneath.
  import { DV } from "./dv.js";
  import { app } from "./state.svelte.js";
  let { n, faded = false, picked = false } = $props();
  const state = $derived.by(() => {
    app.rev;
    if (n.kind !== "Bred") return { t: n.kind === "Evolved" ? "Evolves" : n.kind, c: "other" };
    if (DV.validPairs(n.r, n.rift, 1).length) return { t: "✔ Met", c: "met" };
    const unc = (n.r.elements || []).some((e) => !DV.elementCovered(e, n.rift));
    const miss = (n.r.parents || []).some((p) => !DV.candidates(n.rift).some((c) => c.name === p));
    return unc || miss ? { t: "✖ Not met", c: "missing" } : { t: "No Valid pair yet", c: "nopair" };
  });
  const badges = $derived([...(n.purchaseOnly ? ["🔒 Purchase only"] : []), ...(n.oor.length ? ["⏳ Not in rotation"] : []), ...DV.conditionBadges(n.r)]);
</script>

<div class="pill {state.c}" class:faded class:picked>
  <b>{state.t}</b>
  {#each badges as b}<span class="badge">{b}</span>{/each}
</div>
