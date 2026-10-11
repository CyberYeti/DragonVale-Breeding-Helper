<!--
  The page header's ▸ Display button and popover (spec §8 Filters and
  Display). Outlined while a setting differs from the default. The settings
  live in the store (`store.display`), which persists them.
-->
<script lang="ts">
  import { useStore } from '../store.svelte';
  import DisplayPanel from './DisplayPanel.svelte';
  import Popover from './Popover.svelte';
  import ToolButton from './ToolButton.svelte';

  const store = useStore();
  const changed = $derived(store.display.ownedForms !== 'either' || store.display.allInColour || !store.display.elementIcons);
</script>

<Popover label="Display" align="right">
  {#snippet trigger({ open, toggle })}
    <ToolButton aria-expanded={open} active={changed} onclick={toggle}>{open ? '▾' : '▸'} Display</ToolButton>
  {/snippet}
  {#snippet children({ close })}
    <DisplayPanel ondone={close} />
  {/snippet}
</Popover>
