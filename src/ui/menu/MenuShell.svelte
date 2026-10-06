<!--
  The home screen (layout B of the menu-layout prototype).

  Desktop (spec §8 Desktop layout): the sidebar on the left; on the right the
  header, the page header and the tile grid, with the footer at the end of
  the scrolling page.

  Phone, ≤ 700px (spec §8 Phone layout): the sidebar becomes a drawer opened
  by ☰ in the header or Dragonarium in the bottom nav; picking a tab closes
  it. The bottom nav sits under the page, except in select mode, where the
  Mark/Unmark bar replaces it. Keep 700px in step with Popover and TileGrid.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { useNav } from '../nav.svelte';
  import AppHeader from './AppHeader.svelte';
  import BottomNav from './BottomNav.svelte';
  import Footer from './Footer.svelte';
  import Notices from './Notices.svelte';
  import PageHeader from './PageHeader.svelte';
  import Sidebar from './Sidebar.svelte';
  import TileGrid from './TileGrid.svelte';
  import UndoToast from './UndoToast.svelte';

  const nav = useNav();

  let scroller = $state<HTMLElement>();
  let burger = $state<HTMLButtonElement>();
  let closer = $state<HTMLButtonElement>();

  /** The phone drawer is open. Ignored at desktop width, where the sidebar always shows. */
  let drawerOpen = $state(false);

  // A new tab or search starts at the top of the page, with the drawer shut.
  $effect(() => {
    void nav.tab;
    void nav.searching;
    scroller?.scrollTo({ top: 0 });
    drawerOpen = false;
  });

  async function openDrawer() {
    drawerOpen = true;
    await tick();
    closer?.focus();
  }

  function closeDrawer() {
    if (!drawerOpen) return;
    drawerOpen = false;
    burger?.focus();
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && drawerOpen) {
      event.stopPropagation();
      closeDrawer();
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="shell" class:drawer-open={drawerOpen}>
  <aside class="side" id="app-drawer">
    <button type="button" class="drawer-close" aria-label="Close menu" bind:this={closer} onclick={closeDrawer}
      >✕</button
    >
    <Sidebar />
  </aside>
  {#if drawerOpen}
    <button type="button" class="backdrop" tabindex="-1" aria-label="Close menu" onclick={closeDrawer}></button>
  {/if}
  <div class="main">
    <AppHeader>
      {#snippet leading()}
        <button
          type="button"
          class="burger"
          aria-label="Open menu"
          aria-controls="app-drawer"
          aria-expanded={drawerOpen}
          bind:this={burger}
          onclick={openDrawer}>☰</button
        >
      {/snippet}
    </AppHeader>
    <main class="scroll" bind:this={scroller}>
      <Notices />
      <PageHeader />
      <TileGrid />
      <Footer />
    </main>
    <!-- Floating bars (select mode's action bar, the Undo toast) go here, after the page.
         The layer has no height and sits on top of the bottom nav, so a bar placed
         at bottom: 24px floats above the nav on a phone and above the page's foot
         on desktop. -->
    <div class="floating">
      <UndoToast />
    </div>
    {#if !nav.selecting}
      <div class="bottom-nav">
        <BottomNav onDragonarium={openDrawer} />
      </div>
    {/if}
  </div>
</div>

<style>
  .shell {
    position: relative;
    display: flex;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }
  .side {
    position: relative;
    width: 250px;
    flex: none;
    min-height: 0;
  }
  .main {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    overflow-x: hidden;
  }
  .floating {
    position: relative;
    flex: none;
  }
  .burger,
  .drawer-close,
  .backdrop,
  .bottom-nav {
    display: none;
  }
  .burger,
  .drawer-close {
    padding: 4px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    cursor: pointer;
  }

  @media (max-width: 700px) {
    .side {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      z-index: 31;
      width: min(280px, 85vw);
      transform: translateX(-105%);
      /* Hidden (and out of the tab order) once the slide-out ends. */
      visibility: hidden;
      transition:
        transform 0.2s,
        visibility 0s 0.2s;
      box-shadow: 4px 0 24px #0004;
    }
    .drawer-open .side {
      transform: none;
      visibility: visible;
      transition: transform 0.2s;
    }
    .drawer-close {
      display: block;
      position: absolute;
      top: 8px;
      right: 10px;
      z-index: 1;
    }
    .backdrop {
      display: block;
      position: absolute;
      inset: 0;
      z-index: 30;
      padding: 0;
      border: 0;
      background: #0006;
      cursor: default;
    }
    .burger {
      display: block;
      flex: none;
    }
    .bottom-nav {
      display: block;
    }
  }

  @media (max-width: 700px) and (prefers-reduced-motion: reduce) {
    .side,
    .drawer-open .side {
      transition: none;
    }
  }
</style>
