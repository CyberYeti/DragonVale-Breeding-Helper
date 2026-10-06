<!--
  The app once the snapshot has loaded. Provides the store to everything
  below it (useStore()). For now a status page; the menu shell replaces the
  body in a later ticket.
-->
<script lang="ts">
  import type { Cave } from '../lib/core/breeding';
  import type { OwnedForms } from '../lib/core/tile';
  import { provideStore, type AppStore } from './store.svelte';

  let { store }: { store: AppStore } = $props();
  // The store is created once and never replaced.
  // svelte-ignore state_referenced_locally
  provideStore(store);

  const owned = $derived(Object.keys(store.collection.entries).length);
  const dataDate = $derived(new Date(store.snapshot.meta.fetchedAt).toLocaleDateString());

  const CAVES: [Cave, string][] = [
    ['normal', 'Normal'],
    ['rift', 'Rift'],
    ['coop', 'Co-op'],
  ];
  const FORMS: [OwnedForms, string][] = [
    ['either', 'Either'],
    ['normal', 'Normal'],
    ['rift', 'Rift'],
  ];
</script>

<main>
  <h1>DragonVale Breeding Helper</h1>

  {#if store.loadError}
    <p class="note warn" role="alert">
      Your saved Collection couldn't be read: {store.loadError.message} It was kept aside and the app started with an
      empty Collection.
      <button type="button" onclick={() => store.dismissLoadError()}>Dismiss</button>
    </p>
  {/if}
  {#if store.notice}
    <p class="note">
      Dragon data updated ({new Date(store.notice.dataDate).toLocaleDateString()}): {store.notice.renamed.length} renamed,
      {store.notice.orphans.length} entries not recognised.
      <button type="button" onclick={() => store.dismissNotice()}>Dismiss</button>
    </p>
  {/if}
  {#if store.storageFailed}
    <p class="note warn">This browser isn't saving data, so changes will be lost on reload.</p>
  {/if}

  <dl>
    <dt>Dragon data</dt>
    <dd>{store.snapshot.dragons.length} Dragons, from {dataDate}</dd>
    <dt>Owned</dt>
    <dd>{owned} Dragons</dd>
    <dt>Available limited</dt>
    <dd>
      {store.overlay.rotation.length} in the Limited rotation, {store.overlay.events.length} running Events
      {#if store.limitedStatus === 'loading'}(checking for updates…){/if}
      {#if store.limitedStatus === 'none'}(Limited data unavailable){/if}
    </dd>
  </dl>

  <fieldset>
    <legend>Breeding cave</legend>
    {#each CAVES as [value, label] (value)}
      <label><input type="radio" name="cave" {value} checked={store.cave === value} onchange={() => (store.cave = value)} />
        {label}</label>
    {/each}
  </fieldset>

  <fieldset>
    <legend>Display</legend>
    {#each FORMS as [value, label] (value)}
      <label>
        <input
          type="radio"
          name="owned-forms"
          {value}
          checked={store.display.ownedForms === value}
          onchange={() => (store.display = { ...store.display, ownedForms: value })}
        />
        {label}</label>
    {/each}
    <label>
      <input
        type="checkbox"
        checked={store.display.allInColour}
        onchange={(e) => (store.display = { ...store.display, allInColour: e.currentTarget.checked })}
      />
      Show all Dragons in colour</label>
  </fieldset>

  {#if store.limitedAsOf}
    <p class="note">Limited data as of {store.limitedAsOf.toLocaleString()}</p>
  {/if}
</main>

<style>
  main {
    max-width: 40rem;
    margin: 2rem auto;
    padding: 0 1rem;
  }

  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.25rem 1rem;
  }

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
  }

  fieldset {
    border: 1px solid var(--line);
    border-radius: 6px;
    margin: 1rem 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
  }

  .note {
    color: var(--muted);
    font-size: 0.9em;
  }

  .warn {
    color: inherit;
    border-left: 3px solid var(--accent);
    padding-left: 0.5rem;
  }
</style>
