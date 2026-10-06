<!--
  An Element hub (a leaf): the game's Element icon and its name. Covered
  (some parent that counts carries it) is drawn in colour, missing in
  greyscale. Display only.
-->
<script lang="ts">
  import type { NodeProps } from '@xyflow/svelte';
  import type { ElementNode } from '../../../lib/core/graph';
  import { useStore } from '../../store.svelte';
  import { assetUrl } from '../../tile/labels';
  import type { FlowNode } from '../flow';
  import Ends from './Ends.svelte';

  let { data }: NodeProps<FlowNode> = $props();

  const store = useStore();
  const node = $derived(data.node as ElementNode);
  const icon = $derived(store.snapshot.elements.find((e) => e.name === node.element)?.icon ?? null);
  const title = $derived(
    `${node.element} element · ${node.covered ? 'a Dragon you own carries it' : 'no Dragon you own carries it'}${node.breeding === 'rift' ? ' (Rift breeding)' : ''}`,
  );
</script>

<Ends />
<div class="element" class:grey={!node.covered} {title}>
  {#if icon}
    <img src={assetUrl(icon)} alt="" draggable="false" />
  {:else}
    <span class="fallback" aria-hidden="true">{node.element.slice(0, 2)}</span>
  {/if}
  <span class="name">{node.element}</span>
</div>

<style>
  .element {
    width: 56px;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
  }
  img,
  .fallback {
    width: 44px;
    height: 44px;
    display: block;
  }
  .fallback {
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--line);
    font-weight: 700;
  }
  .grey img {
    filter: grayscale(1) opacity(0.45);
  }
  .name {
    font-size: 11px;
    font-weight: 600;
    line-height: 1.3;
    white-space: nowrap;
  }
  .grey .name {
    color: var(--muted);
  }
</style>
