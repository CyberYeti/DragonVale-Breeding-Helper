<!--
  A small menu icon (tab, page, cave or Event art) from public/images. Falls
  back to `icon.fallback` when the file is missing, and draws nothing if that
  fails too. Size comes from `--icon-size` (default 20px).
-->
<script lang="ts">
  import { assetUrl } from '../tile/labels';
  import type { IconSpec } from './tabInfo';

  let { icon }: { icon: IconSpec } = $props();

  /** Sources that failed to load. */
  let failed = $state<readonly string[]>([]);
  const src = $derived([icon.src, icon.fallback].find((s) => s !== undefined && !failed.includes(s)));
</script>

{#if src}
  <span class="icon" class:crop={icon.crop} aria-hidden="true">
    <img src={assetUrl(src)} alt="" draggable="false" onerror={() => (failed = [...failed, src])} />
  </span>
{/if}

<style>
  .icon {
    display: inline-block;
    flex: none;
    width: var(--icon-size, 20px);
    height: var(--icon-size, 20px);
    position: relative;
    vertical-align: middle;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
  /* Art with a wide frame: zoom in and clip to a circle. */
  .crop {
    overflow: hidden;
    border-radius: 50%;
  }
  .crop img {
    position: absolute;
    width: 190%;
    height: 190%;
    max-width: none;
    left: -45%;
    top: -45%;
  }
</style>
