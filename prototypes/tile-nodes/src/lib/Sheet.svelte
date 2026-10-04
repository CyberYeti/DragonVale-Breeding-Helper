<script>
  // Details side sheet (#15): the full panel. Every Dragon in it is the same DragonTile, with ownership ticks.
  import DragonTile from "./DragonTile.svelte";
  import { app } from "./state.svelte.js";
  import { vm } from "./panel.js";
  let { node } = $props();
  let q = $state("");
  const v = $derived((app.rev, vm(node, app.target)));
  const m = (d) => !q || d.name.toLowerCase().includes(q.toLowerCase());
  const go = (d) => { app.target = d.name; app.sel = null; app.sheet = false; };
</script>

{#if v}
  <aside class="sheet">
    <div class="sh"><b>{v.title}</b><button onclick={() => (app.sheet = false)}>✕</button></div>
    <div class={v.tone}>{v.head}</div>
    {#if v.reason}<div class="muted small">{v.reason}</div>{/if}
    {#if v.badges?.length}<div>{#each v.badges as b}<span class="badge">{b}</span>{/each}</div>{/if}
    <input class="search" placeholder="Search Dragons…" bind:value={q} />
    {#if v.kind === "dragon"}
      <div class="row"><DragonTile d={v.d} form={v.form} /></div>
    {/if}
    {#if v.pairs}
      <div class="lbl">Valid pairs, simplest first ({v.pairs.length})</div>
      <div class="row">{#each v.pairs.filter(([a, b]) => m(a) || m(b)).slice(0, 60) as [a, b]}<div class="pair"><DragonTile d={a} form={v.form} size="sm" onclick={() => go(a)} /><span>{a === b ? "×2" : "+"}</span>{#if a !== b}<DragonTile d={b} form={v.form} size="sm" onclick={() => go(b)} />{/if}</div>{/each}</div>
    {/if}
    {#if v.basics?.length}
      <div class="lbl">Missing Elements: basic dragon</div>
      <div class="row">{#each v.basics as x}<DragonTile d={x.d} form={v.form} size="sm" note={x.e} onclick={() => go(x.d)} />{/each}</div>
    {/if}
    {#if v.sugg?.length}
      <div class="lbl">Get one to make a Valid pair</div>
      <div class="row">{#each v.sugg.filter((s) => m(s.d)) as s}<DragonTile d={s.d} form={v.form} size="sm" note={"+ " + s.with.name} onclick={() => go(s.d)} />{/each}</div>
    {/if}
    {#if v.kind === "element"}
      <div class="lbl">Basic dragon, then alternatives</div>
      <div class="row">{#if v.basic}<DragonTile d={v.basic} form={v.form} size="sm" note="basic" onclick={() => go(v.basic)} />{/if}{#each v.alts.filter(m) as d}<DragonTile {d} form={v.form} size="sm" onclick={() => go(d)} />{/each}</div>
      <div class="lbl">Yours ({v.carriers.length})</div>
      <div class="row">{#each v.carriers.filter(m).slice(0, 60) as d}<DragonTile {d} form={v.form} size="sm" onclick={() => go(d)} />{/each}</div>
    {/if}
  </aside>
{/if}
