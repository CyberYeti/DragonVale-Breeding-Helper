<!--
  The page header's Select button (spec §8 Select mode): turns select mode on
  and off. Drawn pressed while it is on. Leaving select mode clears the
  selection.
-->
<script lang="ts">
  import { useNav } from '../nav.svelte';
  import ToolButton from './ToolButton.svelte';

  const nav = useNav();

  function onclick() {
    if (nav.selecting) nav.exitSelect();
    else nav.enterSelect();
  }
</script>

<ToolButton pressed={nav.selecting} title="Select Dragons to mark or unmark in bulk" {onclick}>Select</ToolButton>
