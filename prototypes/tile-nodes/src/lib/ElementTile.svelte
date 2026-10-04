<script>
  // Element node in the tile system: colour when a Dragon in the Collection carries it, greyscale when not.
  import { EIMG } from "./dv.js";
  import { app } from "./state.svelte.js";
  import { DV } from "./dv.js";
  let { name, rift = false, lite = false, faded = false, picked = false } = $props();
  const covered = $derived((app.rev, DV.elementCovered(name, rift)));
</script>

<div class="etile" class:grey={!covered} class:lite class:faded class:picked title="{name}{covered ? '' : ' · nobody in your Collection carries it'}">
  <img src={EIMG(name)} alt="" draggable="false" />
  {#if !lite}<div class="nm">{name}{rift ? " ◈" : ""}</div>{/if}
</div>
