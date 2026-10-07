<!--
  The phone layout's bottom nav (spec §8 Phone layout): Dragonarium (opens
  the ☰ drawer, lit while a Dragonarium page or All Dragons is on show), Breedable, Limited
  and Event. MenuShell shows it only at phone width and hides it in select
  mode, where the Mark/Unmark bar takes its place.
-->
<script lang="ts">
  import type { Tab } from '../../lib/core/menu';
  import { MENU_ICONS } from '../../lib/snapshot';
  import { useNav } from '../nav.svelte';
  import { useMenuView } from './menuView.svelte';
  import MenuIcon from './MenuIcon.svelte';
  import { BREEDABLE_ICON, LIMITED_ICON, eventIcon, eventLabel, type IconSpec } from './tabInfo';

  let { onDragonarium }: { onDragonarium: () => void } = $props();

  const nav = useNav();
  const menu = useMenuView();

  const firstEvent = $derived(menu.events.sections.find((s) => s.kind === 'event'));
  const tabs = $derived<readonly { tab: Tab; label: string; icon: IconSpec }[]>([
    { tab: { kind: 'breedable' }, label: 'Breedable', icon: BREEDABLE_ICON },
    { tab: { kind: 'limited' }, label: 'Limited', icon: LIMITED_ICON },
    {
      tab: { kind: 'event' },
      label: eventLabel(menu.events),
      icon: eventIcon(firstEvent?.kind === 'event' ? firstEvent.event.name : undefined),
    },
  ]);

  function isOn(kind: Tab['kind']): boolean {
    return !nav.searching && nav.tab.kind === kind;
  }
</script>

<nav class="bottom" aria-label="Tabs">
  <button type="button" class:on={isOn('page') || isOn('all')} aria-haspopup="dialog" onclick={onDragonarium}>
    <MenuIcon icon={{ src: MENU_ICONS.dragonarium }} />
    <span>Dragonarium</span>
  </button>
  {#each tabs as { tab, label, icon } (tab.kind)}
    {@const on = isOn(tab.kind)}
    <button type="button" class:on aria-current={on ? 'page' : undefined} onclick={() => nav.goTo(tab)}>
      <MenuIcon {icon} />
      <span>{label}</span>
    </button>
  {/each}
</nav>

<style>
  .bottom {
    display: flex;
    border-top: 1px solid var(--line);
    background: var(--card);
    padding-bottom: env(safe-area-inset-bottom);
  }
  button {
    --icon-size: 24px;
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 6px 2px 8px;
    border: 0;
    border-radius: 0;
    background: none;
    font-size: 11px;
    cursor: pointer;
  }
  button span {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  button.on {
    background: var(--bg);
    box-shadow: inset 0 3px 0 var(--accent);
  }
</style>
