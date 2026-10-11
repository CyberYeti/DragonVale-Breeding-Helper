<!--
  A page-header button (Select, ▸ Filters, ▸ Display, Graph). `pressed` draws
  it filled (a mode that is on); `active` outlines it in the accent colour (a
  setting changed from its default).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Props = HTMLButtonAttributes & { pressed?: boolean; active?: boolean; children: Snippet };

  let { pressed = false, active = false, children, ...rest }: Props = $props();
</script>

<button type="button" class="tool" class:pressed class:active aria-pressed={pressed || undefined} {...rest}>
  {@render children()}
</button>

<style>
  .tool {
    padding: 4px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    white-space: nowrap;
    cursor: pointer;
  }
  .tool:disabled {
    cursor: default;
    color: var(--muted);
  }
  .tool.pressed {
    background: var(--fg);
    color: var(--bg);
    border-color: var(--fg);
  }
  .tool.active {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
  }
</style>
