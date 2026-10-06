<!--
  The app root: loads the snapshot through ui/store, then hands the store to
  Main. A snapshot that can't be fetched or is refused shows an error page.
-->
<script lang="ts">
  import Main from './Main.svelte';
  import { openApp } from './store.svelte';

  const opening = openApp();
</script>

{#await opening}
  <p class="status">Loading Dragon data…</p>
{:then store}
  <Main {store} />
{:catch error}
  <main class="error" role="alert">
    <h1>The app couldn't start</h1>
    <p>{error instanceof Error ? error.message : String(error)}</p>
    <p>Try reloading the page. If this keeps happening, the app's Dragon data needs updating.</p>
  </main>
{/await}

<style>
  .status {
    margin: 2rem auto;
    text-align: center;
    color: var(--muted);
  }

  .error {
    max-width: 40rem;
    margin: 2rem auto;
    padding: 0 1rem;
  }

  .error h1 {
    font-size: 1.4rem;
  }
</style>
