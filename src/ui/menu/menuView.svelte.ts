// What the menu shows right now, derived from the store and nav: the tab's
// contents, the view after search/Owned forms/filters, and the sidebar
// counts. Every menu component reads it through useMenuView(), so add-ons
// (select mode's "Select all shown", the chips row, the tab graph) share one
// computation instead of each calling core/menu.

import { getContext, setContext } from 'svelte';
import { applyView, graphRoots, sidebarCounts, tabContents, type SidebarCounts, type TabContents, type View } from '../../lib/core/menu';
import type { Nav } from '../nav.svelte';
import type { AppStore } from '../store.svelte';

export class MenuView {
  readonly #store: AppStore;
  readonly #nav: Nav;

  /** The current tab's sections before search and filters. */
  readonly contents: TabContents = $derived.by(() => tabContents(this.#store.world, this.#nav.tab, this.#store.cave));

  /**
   * The sections to draw and the page header's owned/total. Search results
   * replace the tab's sections; find narrows the tab, and waits while a
   * search is showing.
   */
  readonly view: View = $derived.by(() =>
    applyView(
      this.contents.sections,
      this.#nav.query,
      this.#nav.filters,
      this.#store.display,
      this.#store.world,
      this.#store.cave,
      this.#nav.searching ? '' : this.#nav.find,
    ),
  );

  /** The graph header's Show all: the tab graph draws the whole tab. Only the graph reads it; the filters stay as they are. */
  showAllInGraph = $state(false);

  /** The tab graph's roots: the Dragons shown now, live with search and filters, or the whole tab on Show all. */
  readonly graphRoots = $derived.by(() =>
    graphRoots(this.contents.sections, this.view.sections, this.showAllInGraph),
  );

  /** The tab graph draws only the shown Dragons (not Show all). Such a graph neither uses nor saves an arrangement. */
  readonly graphFiltered = $derived(this.graphRoots.narrowed && !this.showAllInGraph);

  /** Owned/total for every sidebar entry. */
  readonly counts: SidebarCounts = $derived.by(() =>
    sidebarCounts(this.#store.world, this.#store.cave, this.#store.display),
  );

  /** The Event tab's contents, whatever tab is on show: the sidebar's label and icon read it. */
  readonly events: TabContents = $derived.by(() =>
    tabContents(this.#store.world, { kind: 'event' }, this.#store.cave),
  );

  constructor(store: AppStore, nav: Nav) {
    this.#store = store;
    this.#nav = nav;
  }
}

const VIEW_KEY = Symbol('menu-view');

export function provideMenuView(view: MenuView): void {
  setContext(VIEW_KEY, view);
}

export function useMenuView(): MenuView {
  const view = getContext<MenuView | undefined>(VIEW_KEY);
  if (!view) throw new Error('useMenuView() called outside the menu (no MenuView provided).');
  return view;
}
