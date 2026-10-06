<!--
  The Undo toast (spec §7 Undo), shown while the store has something to undo:
  after a bulk Mark/Unmark, an import or an orphan removal. It lasts until
  the next action or a reload. Undo calls `store.undo()`; ✕ calls
  `store.dismissUndo()`. The message is worked out from the Collection before
  and after, so callers needn't say what they did.
-->
<script lang="ts">
  import type { Entries } from '../../lib/core/collection';
  import { useStore } from '../store.svelte';

  const store = useStore();

  function changedCount(before: Entries, after: Entries): number {
    let n = 0;
    for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const a = before[name];
      const b = after[name];
      if (a?.normal !== b?.normal || a?.rift !== b?.rift) n++;
    }
    return n;
  }

  const message = $derived.by(() => {
    const previous = store.previous;
    if (!previous) return '';
    const dragons = changedCount(previous.entries, store.collection.entries);
    if (dragons > 0) return `Collection changed: ${dragons} Dragon${dragons === 1 ? '' : 's'}.`;
    const hidden = changedCount(previous.orphans, store.collection.orphans);
    if (hidden > 0) return `Removed ${hidden} ${hidden === 1 ? 'entry' : 'entries'} not in current data.`;
    return 'Collection updated (no Dragons changed).';
  });
</script>

{#if store.canUndo}
  <div class="toast" role="status">
    <span>{message}</span>
    <button type="button" onclick={() => store.undo()}>Undo</button>
    <button type="button" class="close" aria-label="Close" title="Close" onclick={() => store.dismissUndo()}>✕</button>
  </div>
{/if}

<style>
  .toast {
    position: absolute;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    z-index: 40;
    display: flex;
    gap: 10px;
    align-items: center;
    width: max-content;
    max-width: calc(100% - 24px);
    padding: 8px 14px;
    border-radius: 10px;
    background: #222;
    color: #fff;
    font-size: 14px;
    box-shadow: 0 6px 18px #0004;
  }
  button {
    padding: 2px 10px;
    border: 1px solid #666;
    border-radius: 6px;
    background: #444;
    color: #fff;
    cursor: pointer;
  }
  .close {
    padding: 2px 6px;
    background: none;
    border-color: transparent;
  }
</style>
