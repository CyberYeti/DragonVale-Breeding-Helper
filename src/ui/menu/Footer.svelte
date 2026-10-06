<!--
  The footer: credits and disclaimer (spec §10). Links the wiki and each
  Data: page at the revision the snapshot was built from (meta.pageRevisions).
-->
<script lang="ts">
  import { useStore } from '../store.svelte';

  const store = useStore();
  const meta = $derived(store.snapshot.meta);
  const wiki = $derived(meta.source.replace(/\/+$/, ''));
  const pages = $derived(
    Object.entries(meta.pageRevisions).map(([title, revision]) => ({
      title,
      revision,
      href: `${wiki}/wiki/${encodeURI(title.replace(/ /g, '_'))}?oldid=${revision}`,
    })),
  );
  const dataDate = $derived(new Date(meta.fetchedAt).toLocaleDateString());
</script>

<footer class="footer">
  <p>
    DragonVale is owned by Deca Games (originally Backflip Studios). This is an independent fan project, not
    affiliated with or sanctioned by them. The Dragon art is theirs.
  </p>
  <p>
    Dragon data from the <a href={wiki} target="_blank" rel="noopener noreferrer">DragonVale Fandom wiki</a>, under
    <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 3.0</a
    >, as of {dataDate}. Pages used:
    {#each pages as page, i (page.title)}
      <a href={page.href} target="_blank" rel="noopener noreferrer">{page.title}</a> (revision {page.revision}){i <
      pages.length - 1
        ? ', '
        : '.'}
    {/each}
  </p>
</footer>

<style>
  .footer {
    margin-top: 8px;
    padding: 12px;
    border-top: 1px solid var(--line);
    font-size: 12px;
    color: var(--muted);
  }
  p {
    margin: 0 0 6px;
    max-width: 70rem;
  }
  a {
    color: inherit;
  }
</style>
