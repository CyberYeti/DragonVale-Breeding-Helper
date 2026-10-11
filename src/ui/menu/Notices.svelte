<!--
  Notes about the app's data above the page: an unreadable stored Collection,
  the "Dragon data updated" notice, storage not saving, and Limited data
  running from the cache.
-->
<script lang="ts">
  import { useStore } from '../store.svelte';

  const store = useStore();
</script>

{#if store.loadError}
  <p class="note warn" role="alert">
    Your saved Collection couldn't be read: {store.loadError.message} It was kept aside and the app started with an empty
    Collection.
    <button type="button" onclick={() => store.dismissLoadError()}>Dismiss</button>
  </p>
{/if}
{#if store.notice}
  {@const { renamed, orphans, dataDate } = store.notice}
  <div class="note" role="status">
    Dragon data updated ({new Date(dataDate).toLocaleDateString()}):
    {[
      renamed.length > 0 && `${renamed.length} renamed (${renamed.map((r) => `${r.from} → ${r.to}`).join(', ')})`,
      orphans.length > 0 && `${orphans.length} ${orphans.length === 1 ? 'entry' : 'entries'} not recognised`,
    ]
      .filter(Boolean)
      .join(', ')}
    <button type="button" onclick={() => store.dismissNotice()}>Dismiss</button>
    {#if orphans.length > 0}
      <details>
        <summary>Details</summary>
        These Collection entries aren't in the current Dragon data. They're kept and exported, but don't count as owned:
        {orphans.join(', ')}. To drop them, use ⋯ → Remove them.
      </details>
    {/if}
  </div>
{/if}
{#if store.storageFailed}
  <p class="note warn">This browser isn't saving data, so changes will be lost on reload.</p>
{/if}
{#if store.limitedAsOf}
  <p class="note">Limited data as of {store.limitedAsOf.toLocaleString()} (couldn't reach the wiki).</p>
{:else if store.limitedStatus === 'none'}
  <p class="note">Limited data unavailable: the Limited rotation and Event tabs are empty.</p>
{/if}

<style>
  .note {
    margin: 8px 12px 0;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--card);
    border: 1px solid var(--line);
    font-size: 13px;
    color: var(--muted);
  }
  .warn {
    color: inherit;
    border-left: 3px solid var(--accent);
  }
  details {
    margin-top: 4px;
  }
  summary {
    cursor: pointer;
  }
  button {
    margin-left: 6px;
    padding: 0 8px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--card);
    cursor: pointer;
  }
</style>
