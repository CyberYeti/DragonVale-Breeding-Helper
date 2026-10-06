<!--
  The Display popover's contents (spec §8 Filters and Display): Owned forms
  Either / Normal / Rift, Show all Dragons in colour, and Done. Writes
  `store.display` as new objects; the store persists it.
-->
<script lang="ts">
  import type { Display } from '../../lib/core/tile';
  import { useStore } from '../store.svelte';

  let { ondone }: { ondone: () => void } = $props();

  const store = useStore();

  const FORMS: readonly { value: Display['ownedForms']; label: string }[] = [
    { value: 'either', label: 'Either' },
    { value: 'normal', label: 'Normal' },
    { value: 'rift', label: 'Rift' },
  ];
</script>

<div class="lbl" id="display-forms">Owned forms</div>
<div class="seg" role="radiogroup" aria-labelledby="display-forms">
  {#each FORMS as form (form.value)}
    <button
      type="button"
      role="radio"
      aria-checked={store.display.ownedForms === form.value}
      class:on={store.display.ownedForms === form.value}
      onclick={() => (store.display = { ...store.display, ownedForms: form.value })}>{form.label}</button
    >
  {/each}
</div>

<label class="check">
  <input
    type="checkbox"
    checked={store.display.allInColour}
    onchange={(e) => (store.display = { ...store.display, allInColour: e.currentTarget.checked })}
  />
  Show all Dragons in colour
</label>

<div class="actions">
  <span class="spacer"></span>
  <button type="button" class="small primary" onclick={ondone}>Done</button>
</div>

<style>
  .lbl {
    margin: 0 0 4px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
  }
  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
    padding: 3px 4px;
    border-radius: 6px;
    cursor: pointer;
  }
  .check:hover {
    background: var(--bg);
  }
  .check input {
    margin: 0;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
  }
  .seg button {
    padding: 4px 10px;
    border: 0;
    border-right: 1px solid var(--line);
    background: var(--card);
    cursor: pointer;
  }
  .seg button:last-child {
    border-right: 0;
  }
  .seg button.on {
    background: var(--fg);
    color: var(--bg);
  }
  .actions {
    display: flex;
    margin-top: 10px;
  }
  .spacer {
    flex: 1;
  }
  .small {
    padding: 3px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    cursor: pointer;
  }
  .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #000;
  }
</style>
