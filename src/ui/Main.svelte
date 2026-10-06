<!--
  The app once the snapshot has loaded. Provides the store, nav and the menu
  view to everything below it (useStore(), useNav(), useMenuView()), then
  draws the menu with any open graph level on top.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import GraphLayer from './GraphLayer.svelte';
  import MenuShell from './menu/MenuShell.svelte';
  import { MenuView, provideMenuView } from './menu/menuView.svelte';
  import { Nav, provideNav } from './nav.svelte';
  import { provideStore, type AppStore } from './store.svelte';

  let { store }: { store: AppStore } = $props();
  // The store is created once and never replaced.
  // svelte-ignore state_referenced_locally
  provideStore(store);
  // svelte-ignore state_referenced_locally
  const nav = new Nav(store.snapshot);
  provideNav(nav);
  // Browser back steps through tabs and graph levels.
  onMount(() => nav.connectHistory(window.history, window));
  // svelte-ignore state_referenced_locally
  provideMenuView(new MenuView(store, nav));
</script>

<MenuShell />
<GraphLayer />
