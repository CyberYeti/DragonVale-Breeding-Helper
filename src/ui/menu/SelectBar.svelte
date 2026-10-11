<!--
  Select mode's action bar (spec §8 Select mode): the selection count, Select
  all shown, Mark / Unmark and Done. Shown while select mode is on.

  Mark and Unmark follow Display's Owned forms: Normal and Rift go straight
  to core/collection's `mark`/`unmark` with that form; Either first asks
  Normal / Rift form / Both. Each is one undoable store write (the Undo
  toast), after which select mode ends. Escape steps back: out of the
  question, then out of select mode.
-->
<script lang="ts">
  import { shownNames } from '../../lib/core/menu';
  import type { MarkChoice } from '../../lib/core/collection';
  import { useNav } from '../nav.svelte';
  import { useStore } from '../store.svelte';
  import { useMenuView } from './menuView.svelte';

  type Action = 'mark' | 'unmark';

  const store = useStore();
  const nav = useNav();
  const menu = useMenuView();

  const CHOICES: readonly { choice: MarkChoice; label: string }[] = [
    { choice: 'normal', label: 'Normal' },
    { choice: 'rift', label: 'Rift form' },
    { choice: 'both', label: 'Both' },
  ];

  /** The action waiting for Either's Normal / Rift form / Both answer. */
  let asking = $state<Action | null>(null);

  const count = $derived(nav.selected.size);
  const ownedForms = $derived(store.display.ownedForms);
  const fixedChoice = $derived<MarkChoice | null>(ownedForms === 'either' ? null : ownedForms);

  // A question is about the selection it was asked for.
  $effect(() => {
    if (!nav.selecting || count === 0) asking = null;
  });

  function start(action: Action) {
    if (fixedChoice) run(action, fixedChoice);
    else asking = action;
  }

  function run(action: Action, choice: MarkChoice) {
    const names = [...nav.selected];
    if (action === 'mark') store.mark(names, choice);
    else store.unmark(names, choice);
    asking = null;
    nav.exitSelect();
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !nav.selecting || nav.level) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select')) return;
    if (asking) asking = null;
    else nav.exitSelect();
  }
</script>

<svelte:window {onkeydown} />

{#if nav.selecting}
  <div class="bar" role="toolbar" aria-label="Selection">
    <span class="count" aria-live="polite"><b>{count}</b> selected</span>
    {#if asking}
      <span class="question">{asking === 'mark' ? 'Mark' : 'Unmark'} which form?</span>
      {#each CHOICES as { choice, label } (choice)}
        <button type="button" onclick={() => run(asking!, choice)}>{label}</button>
      {/each}
      <button type="button" onclick={() => (asking = null)}>Cancel</button>
    {:else}
      <button type="button" onclick={() => nav.selectAll(shownNames(menu.view.sections))}>Select all shown</button>
      {#if fixedChoice}
        <span class="form">{fixedChoice === 'rift' ? 'Rift form' : 'Normal form'}</span>
      {/if}
      <span class="spacer"></span>
      <button type="button" class="primary" disabled={count === 0} onclick={() => start('mark')}>Mark</button>
      <button type="button" disabled={count === 0} onclick={() => start('unmark')}>Unmark</button>
      <button type="button" onclick={() => nav.exitSelect()}>Done</button>
    {/if}
  </div>
{/if}

<style>
  .bar {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 10px 12px;
    background: var(--card);
    border-top: 2px solid var(--accent);
    box-shadow: 0 -6px 18px #0002;
  }
  .count {
    font-variant-numeric: tabular-nums;
  }
  .form,
  .question {
    color: var(--muted);
  }
  .spacer {
    flex: 1;
  }
  button {
    padding: 4px 12px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    cursor: pointer;
    white-space: nowrap;
  }
  button:disabled {
    cursor: default;
    color: var(--muted);
  }
  .primary:not(:disabled) {
    background: var(--accent);
    border-color: var(--accent);
    color: #000;
  }
</style>
