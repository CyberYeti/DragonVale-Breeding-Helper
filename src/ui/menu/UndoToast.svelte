<!--
  The Undo toast (spec §7 Undo): shown while the store holds one level of
  Undo, after a bulk Mark/Unmark, an import or an orphan removal. It lasts
  until the next Collection action or a reload; ✕ closes it without undoing.

  Minimal version from select mode (#45); the ⋯ menu ticket (#46) owns it.
-->
<script lang="ts">
  import { useStore } from '../store.svelte';

  const store = useStore();
</script>

{#if store.canUndo}
  <div class="toast" role="status">
    <span>Collection updated.</span>
    <button type="button" onclick={() => store.undo()}>Undo</button>
    <button type="button" class="close" aria-label="Close" onclick={() => store.dismissUndo()}>✕</button>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    left: 50%;
    bottom: 80px;
    transform: translateX(-50%);
    z-index: 40;
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 8px 10px 8px 14px;
    border-radius: 10px;
    background: #222;
    color: #fff;
    box-shadow: 0 6px 18px #0004;
    white-space: nowrap;
  }
  button {
    padding: 3px 10px;
    border: 1px solid #666;
    border-radius: 8px;
    background: #444;
    color: #fff;
    cursor: pointer;
  }
  .close {
    padding: 3px 7px;
    border-color: transparent;
    background: transparent;
  }
</style>
