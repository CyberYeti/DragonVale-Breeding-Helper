<script>
  // THE Dragon tile: one component for the menu grid, graph nodes (all variants) and the click panel.
  // lite = same component, cheap rendering for faded background tiles (no banner, ticks, sheen or name).
  import { RC, IMG, formLbl } from "./dv.js";
  import { owned, breedable, toggle, banner } from "./state.svelte.js";
  let { d, form = "normal", size = "md", lite = false, ticks = true, faded = false, root = false, picked = false, note = "", onclick = null } = $props();
  const own = $derived(owned(d, form));
  const breed = $derived(!own && !lite && breedable(d, form));
  const bn = $derived(lite ? null : banner(d, form));
  const one = $derived(d.isRiftDragon || !d.hasRiftForm);
  function tick(e, f) { e.stopPropagation(); toggle(d, f); }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="tile {size}" class:grey={!own} class:breed class:lite class:faded class:root class:picked style="--rc:{RC[d.rarity] || '#999'}"
  title="{d.name}{formLbl(d, form)}{breed ? ' · Breedable now' : ''}" {onclick}>
  <img src={IMG(d)} alt="" loading="lazy" decoding="async" draggable="false" />
  {#if !lite}
    {#if bn}<div class="po">{bn}</div>{/if}
    <div class="nm">{d.name}{form === "rift" && !d.isRiftDragon ? " ◈" : ""}</div>
    {#if note}<div class="note">{note}</div>{/if}
    {#if ticks}
      <div class="ticks nodrag nopan">
        {#if one}
          <button class:on={own} onclick={(e) => tick(e, "normal")}>✔ Owned</button>
        {:else}
          <button class:on={owned(d, "normal")} onclick={(e) => tick(e, "normal")}>N</button>
          <button class="rf" class:on={owned(d, "rift")} onclick={(e) => tick(e, "rift")}>Rift</button>
        {/if}
      </div>
    {/if}
  {/if}
</div>
