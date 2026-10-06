<!--
  The line over a graph saying why its Target can't be bred now (spec §9
  rule 7), or "Breedable now". Floats at the top left of the graph; the
  parent must be positioned. With no `info`, shows `hint` instead.
-->
<script lang="ts">
  import type { TargetInfo } from '../../lib/core/graph';

  let { info = null, hint }: { info?: TargetInfo | null; hint?: string } = $props();
</script>

{#if info}
  <p class="why" class:ok={info.breedableNow} aria-live="polite">
    {#if info.breedableNow}
      ✔ Breedable now
    {:else}
      {#each info.reasons as r, i (i)}{#if i > 0}<span class="sep">·</span>{/if}<span class="reason r-{r.kind}"
          >{r.label}</span
        >{/each}
    {/if}
  </p>
{:else if hint}
  <p class="why hint">{hint}</p>
{/if}

<style>
  .why {
    position: absolute;
    left: 12px;
    top: 12px;
    z-index: 5;
    max-width: min(520px, calc(100% - 24px));
    margin: 0;
    padding: 6px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    font-size: 13px;
    pointer-events: none;
  }
  .why.ok {
    color: var(--own);
    font-weight: 600;
  }
  .why.hint {
    color: var(--muted);
  }
  .reason {
    font-weight: 600;
  }
  .reason.r-owned {
    color: var(--own);
  }
  .sep {
    margin: 0 0.4em;
    color: var(--muted);
  }
</style>
