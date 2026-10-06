<!--
  The home screen at desktop width (spec §8 Desktop layout, layout B of the
  menu-layout prototype): the sidebar on the left; on the right the header,
  the page header and the tile grid, with the footer at the end of the
  scrolling page.
-->
<script lang="ts">
  import { useNav } from '../nav.svelte';
  import AppHeader from './AppHeader.svelte';
  import Footer from './Footer.svelte';
  import Notices from './Notices.svelte';
  import PageHeader from './PageHeader.svelte';
  import SelectBar from './SelectBar.svelte';
  import Sidebar from './Sidebar.svelte';
  import TileGrid from './TileGrid.svelte';
  import UndoToast from './UndoToast.svelte';

  const nav = useNav();

  let scroller = $state<HTMLElement>();

  // A new tab or search starts at the top of the page.
  $effect(() => {
    void nav.tab;
    void nav.searching;
    scroller?.scrollTo({ top: 0 });
  });
</script>

<div class="shell">
  <aside class="side">
    <Sidebar />
  </aside>
  <div class="main">
    <AppHeader />
    <main class="scroll" bind:this={scroller}>
      <Notices />
      <PageHeader />
      <TileGrid />
      <Footer />
    </main>
    <!-- Floating bars (select mode's action bar, the Undo toast) go here, after the page. -->
    <SelectBar />
    <UndoToast />
  </div>
</div>

<style>
  .shell {
    display: flex;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }
  .side {
    width: 250px;
    flex: none;
    min-height: 0;
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
</style>
