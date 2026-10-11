<!--
  Import Collection's modal (spec §7 Backup). For a file that can't be used it
  names the problem and changes nothing. Otherwise it warns that the current
  Collection will be overwritten, with the counts and the renames/orphans
  line, and calls `onconfirm` on Replace. Import never merges.
-->
<script lang="ts">
  import type { ImportPreview, ImportSummary } from '../../lib/core/collection';

  type Props = {
    fileName: string;
    result: ImportPreview;
    onconfirm: (summary: ImportSummary) => void;
    onclose: () => void;
  };

  let { fileName, result, onconfirm, onclose }: Props = $props();

  let dialog = $state<HTMLDialogElement>();

  $effect(() => {
    dialog?.showModal();
  });

  function plural(n: number, one: string, many: string): string {
    return `${n} ${n === 1 ? one : many}`;
  }

  /** "1 name will be renamed, 2 aren't in current data and will be kept hidden." */
  function changesLine(summary: ImportSummary): string | null {
    const parts: string[] = [];
    if (summary.renamed.length > 0) parts.push(`${plural(summary.renamed.length, 'name', 'names')} will be renamed`);
    if (summary.orphans.length > 0) {
      const n = summary.orphans.length;
      parts.push(`${n} ${n === 1 ? "isn't" : "aren't"} in current data and will be kept hidden`);
    }
    return parts.length > 0 ? `${parts.join(', ')}.` : null;
  }
</script>

<dialog bind:this={dialog} class="dialog" aria-labelledby="import-title" onclose={() => onclose()}>
  {#if result.ok}
    {@const summary = result.summary}
    {@const line = changesLine(summary)}
    <h2 id="import-title">Import Collection?</h2>
    <p class="warn">
      This <strong>overwrites your current Collection</strong> with <em>{fileName}</em>. It doesn't merge.
    </p>
    <p>
      File: {plural(summary.fileOwned, 'Dragon', 'Dragons')} owned. Current: {summary.currentOwned}.
      {summary.wouldChange} would change.
    </p>
    {#if line}
      <p>{line}</p>
      {#if summary.renamed.length > 0}
        <ul class="list">
          {#each summary.renamed as r (r.from)}
            <li>{r.from} → {r.to}</li>
          {/each}
        </ul>
      {/if}
    {/if}
    <div class="actions">
      <button type="button" onclick={() => dialog?.close()}>Cancel</button>
      <button type="button" class="primary" onclick={() => onconfirm(summary)}>Replace Collection</button>
    </div>
  {:else}
    <h2 id="import-title">Can't import {fileName}</h2>
    <p class="warn">{result.error.message}</p>
    <p>Your Collection hasn't changed.</p>
    <div class="actions">
      <button type="button" class="primary" onclick={() => dialog?.close()}>OK</button>
    </div>
  {/if}
</dialog>

<style>
  .dialog {
    width: min(440px, calc(100vw - 32px));
    padding: 16px 18px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--card);
    color: var(--fg);
    box-shadow: 0 12px 40px #0005;
  }
  .dialog::backdrop {
    background: #0006;
  }
  h2 {
    margin: 0 0 10px;
    font-size: 17px;
    overflow-wrap: anywhere;
  }
  p {
    margin: 0 0 8px;
    font-size: 14px;
  }
  em {
    overflow-wrap: anywhere;
  }
  .warn {
    padding: 6px 10px;
    border-left: 3px solid var(--accent);
    background: var(--bg);
    border-radius: 6px;
  }
  .list {
    max-height: 120px;
    overflow: auto;
    margin: 0 0 8px;
    padding-left: 20px;
    font-size: 13px;
    color: var(--muted);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }
  button {
    padding: 5px 12px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    cursor: pointer;
  }
  .primary {
    background: var(--fg);
    color: var(--bg);
    border-color: var(--fg);
  }
</style>
