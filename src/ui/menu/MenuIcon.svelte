<!--
  A small menu icon (tab, page, cave or Event art) from public/images. Falls
  back to each of `icon.fallbacks` in turn when a file is missing, and draws
  nothing if they all fail. Size comes from `--icon-size` (default 20px).
-->
<script lang="ts">
  import { assetUrl } from '../assets';
  import type { IconSpec } from './tabInfo';

  let { icon }: { icon: IconSpec } = $props();

  /** Sources that failed to load. */
  let failed = $state<readonly string[]>([]);
  const src = $derived([icon.src, ...(icon.fallbacks ?? [])].find((s) => !failed.includes(s)));
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
  /*
   * A square already cut to a disc (the hourglass): clip to a circle, no
   * zoom, so the frame's corners go and the disc fills the icon box like the
   * other icons' art does.
   */
  .crop img {
    border-radius: 50%;
  }
</style>
