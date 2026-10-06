<!--
  The header's ⋯ menu (spec §7 Backup): Export Collection, Import Collection,
  "Last exported", and, when there are orphans, their names with a Remove
  them button. Import is checked first (ImportDialog shows the error or the
  overwrite warning); a confirmed import and Remove them both leave Undo.
-->
<script lang="ts">
  import type { ImportPreview } from '../../lib/core/collection';
  import { useStore } from '../store.svelte';
  import ImportDialog from './ImportDialog.svelte';

  const store = useStore();

  let open = $state(false);
  let wrap = $state<HTMLElement>();
  let fileInput = $state<HTMLInputElement>();
  let preview = $state.raw<{ fileName: string; result: ImportPreview } | null>(null);

  const orphans = $derived(Object.keys(store.collection.orphans).sort());
  const lastExported = $derived(
    store.collection.lastExported ? new Date(store.collection.lastExported).toLocaleDateString() : 'never',
  );

  function exportCollection() {
    const { blob, fileName } = store.exportCollection();
    const url = URL.createObjectURL(new Blob([JSON.stringify(blob, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    open = false;
  }

  async function onfile(event: Event & { currentTarget: HTMLInputElement }) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = ''; // picking the same file again still fires change
    if (!file) return;
    open = false;
    let text: string;
    try {
      text = await file.text();
    } catch {
      preview = {
        fileName: file.name,
        result: { ok: false, error: { problem: 'not-json', message: "The file couldn't be read." } },
      };
      return;
    }
    preview = { fileName: file.name, result: store.previewImport(text) };
  }

  function removeOrphans() {
    store.removeOrphans();
    open = false;
  }

  function onwindowclick(event: MouseEvent) {
    if (open && wrap && !wrap.contains(event.target as Node)) open = false;
  }

  function onwindowkeydown(event: KeyboardEvent) {
    if (open && event.key === 'Escape') {
      event.stopPropagation();
      open = false;
    }
  }
</script>

<svelte:window onclick={onwindowclick} onkeydown={onwindowkeydown} />

<span class="wrap" bind:this={wrap}>
  <button
    type="button"
    class="more"
    class:on={open}
    title="More"
    aria-label="More"
    aria-haspopup="true"
    aria-expanded={open}
    onclick={() => (open = !open)}>⋯</button
  >
  {#if open}
    <div class="menu" role="group" aria-label="Collection backup">
      <button type="button" class="item" onclick={exportCollection}>⬇ Export Collection</button>
      <button type="button" class="item" onclick={() => fileInput?.click()}>⬆ Import Collection…</button>
      <p class="muted">Last exported: {lastExported}</p>
      {#if orphans.length > 0}
        <div class="orphans">
          <p>
            {orphans.length} Collection {orphans.length === 1 ? 'entry' : 'entries'} not in current data:
          </p>
          <ul>
            {#each orphans as name (name)}
              <li>{name}</li>
            {/each}
          </ul>
          <button type="button" class="remove" onclick={removeOrphans}>Remove them</button>
        </div>
      {/if}
    </div>
  {/if}
  <input bind:this={fileInput} type="file" accept=".json,application/json" hidden onchange={onfile} />
</span>

{#if preview}
  <ImportDialog
    fileName={preview.fileName}
    result={preview.result}
    onconfirm={(summary) => {
      store.applyImport(summary);
      preview = null;
    }}
    onclose={() => (preview = null)}
  />
{/if}

<style>
  .wrap {
    position: relative;
  }
  .more {
    padding: 4px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    cursor: pointer;
  }
  .more.on {
    background: var(--fg);
    color: var(--bg);
    border-color: var(--fg);
  }
  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    z-index: 30;
    min-width: 240px;
    max-width: min(320px, calc(100vw - 24px));
    padding: 6px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--card);
    box-shadow: 0 8px 24px #0003;
  }
  .item {
    display: block;
    width: 100%;
    margin: 2px 0;
    padding: 6px 10px;
    border: 0;
    border-radius: 6px;
    background: none;
    text-align: left;
    cursor: pointer;
  }
  .item:hover,
  .item:focus-visible {
    background: var(--bg);
  }
  .muted {
    margin: 4px 10px;
    font-size: 12px;
    color: var(--muted);
  }
  .orphans {
    margin: 6px 4px 2px;
    padding: 6px;
    border-top: 1px solid var(--line);
    font-size: 13px;
  }
  .orphans p {
    margin: 0 0 4px;
  }
  .orphans ul {
    max-height: 140px;
    overflow: auto;
    margin: 0 0 6px;
    padding-left: 18px;
    color: var(--muted);
  }
  .remove {
    padding: 2px 10px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--card);
    cursor: pointer;
  }
</style>
