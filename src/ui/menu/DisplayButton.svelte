<!--
  The page header's ▸ Display button and popover (spec §8 Filters and
  Display). Outlined while a setting differs from the default. The settings
  live in the store (`store.display`), which persists them.
-->
<script lang="ts">
  import { useStore } from '../store.svelte';
  import DisplayPanel from './DisplayPanel.svelte';
  import Popover from './Popover.svelte';
  import { popovers } from './popovers.svelte';
  import ToolButton from './ToolButton.svelte';

  const store = useStore();
  const changed = $derived(store.display.ownedForms !== 'either' || store.display.allInColour);
</script>

<Popover id="display" label="Display">
  {#snippet trigger(props, open)}
    <ToolButton {...props} active={changed}>{open ? '▾' : '▸'} Display</ToolButton>
  {/snippet}
  <DisplayPanel ondone={() => popovers.close('display')} />
</Popover>
