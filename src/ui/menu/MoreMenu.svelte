<!--
  The header's ⋯ menu (spec §8 Desktop layout). A placeholder button for now:
  the menu itself (Export / Import Collection, Last exported) is ticket #46,
  which fills in this component.
-->
<button type="button" class="more" title="More (coming soon)" aria-label="More" disabled>⋯</button>

<style>
  .more {
    padding: 4px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    cursor: pointer;
  }
  .more:disabled {
    cursor: default;
    color: var(--muted);
  }
</style>
