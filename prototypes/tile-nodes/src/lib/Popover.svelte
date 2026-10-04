<script>
  // Default click panel (#15): headline, reason, top 3; Details opens the side sheet. Same DragonTile inside.
  import DragonTile from "./DragonTile.svelte";
  import { app } from "./state.svelte.js";
  import { vm } from "./panel.js";
  let { node } = $props();
  const v = $derived((app.rev, vm(node, app.target)));
  const go = (d) => { app.target = d.name; app.sel = null; app.sheet = false; };
</script>

{#if v}
  <div class="pop nodrag nopan nowheel">
    <div class="ttl">{v.title}</div>
    <div class={v.tone}>{v.head}</div>
    {#if v.reason}<div class="muted small">{v.reason}</div>{/if}
    {#if v.top?.length}
      <div class="row">
        {#each v.top as [a, b]}<div class="pair"><DragonTile d={a} form={v.form} size="sm" ticks={false} onclick={() => go(a)} /><span>{a === b ? "×2" : "+"}</span>{#if a !== b}<DragonTile d={b} form={v.form} size="sm" ticks={false} onclick={() => go(b)} />{/if}</div>{/each}
      </div>
    {/if}
    {#if v.topSugg?.length}
      <div class="lbl">Get one of these</div>
      <div class="row">{#each v.topSugg as s}<DragonTile d={s.d} form={v.form} size="sm" ticks={false} note={"+ " + s.with.name} onclick={() => go(s.d)} />{/each}</div>
    {/if}
    {#if v.kind === "element" && v.basic}
      <div class="row"><DragonTile d={v.basic} form={v.form} size="sm" ticks={false} note="basic" onclick={() => go(v.basic)} /></div>
    {/if}
    <button class="primary" onclick={() => (app.sheet = true)}>Details</button>
  </div>
{/if}
