// core/menu's public types (spec §8 Tabs, Filters and Display).

import type { Dragon, DragonariumPage, Rarity } from '../../snapshot';
import type { OwnedForms } from '../breeding';
import type { EndDate } from '../limited';

export type { OwnedForms } from '../breeding';

/** What the menu shows: a Dragonarium page (by name) or one of the three tabs. */
export type Tab =
  | { readonly kind: 'page'; readonly page: string }
  | { readonly kind: 'breedable' }
  | { readonly kind: 'limited' }
  | { readonly kind: 'event' };

/** One tile in a section. */
export type MenuItem = {
  readonly dragon: Dragon;
  /** Limited rotation and Event only: when it leaves. null = no end date known. */
  readonly ends?: EndDate;
  /** Event only: the shop cost in the Event's currency; null if the page's Cost isn't a number. */
  readonly cost?: number | null;
};

/** A running Event's header. */
export type EventInfo = {
  readonly name: string;
  readonly ends: EndDate;
  readonly currency: string | null;
};

/** A run of tiles under one heading. */
export type Section =
  | { readonly kind: 'page'; readonly page: DragonariumPage; readonly items: readonly MenuItem[] }
  | { readonly kind: 'breedable'; readonly items: readonly MenuItem[] }
  | { readonly kind: 'rotation'; readonly items: readonly MenuItem[] }
  | { readonly kind: 'event'; readonly event: EventInfo; readonly items: readonly MenuItem[] }
  /** Search results over every Dragon; replaces the tab's sections. */
  | { readonly kind: 'search'; readonly query: string; readonly items: readonly MenuItem[] };

export type TabContents = {
  readonly sections: readonly Section[];
  /** Event tab only: true when no Event is running, so the tab reads "No event". */
  readonly noEvent: boolean;
  /** Event tab only: the "Not recognised: …" names. Empty on other tabs. */
  readonly notRecognised: readonly string[];
};

/** The Show filter. */
export type Show = 'all' | 'owned' | 'not-owned';

export type Filters = {
  /** Only Dragons Breedable now in the chosen cave. */
  readonly breedableNow: boolean;
  readonly show: Show;
  /** Ticked rarities. None ticked = every rarity. */
  readonly rarities: ReadonlySet<Rarity>;
};

/** The Display settings menu reads. core/tile's `Display` fits this. */
export type MenuDisplay = { readonly ownedForms: OwnedForms };

/** Owned / total, counting each Dragon once. */
export type Count = { readonly owned: number; readonly total: number };

/** What `applyView` returns: the sections to draw and the page header's counts. */
export type View = {
  /** The sections after search, Owned forms and filters. Sections left empty are kept. */
  readonly sections: readonly Section[];
  /**
   * Owned/total over the Dragons shown after search and Owned forms, before
   * the filters, so the page header matches the sidebar entry.
   */
  readonly owned: number;
  readonly total: number;
};

export type PageGroup = DragonariumPage['group'];

export type PageCount = { readonly page: DragonariumPage; readonly count: Count };

export type GroupCount = {
  readonly group: PageGroup;
  /** Each Dragon once, even when it sits on several of the group's pages. */
  readonly count: Count;
  /** The group's pages, in snapshot order. */
  readonly pages: readonly PageCount[];
};

/** Owned/total for every sidebar entry. */
export type SidebarCounts = {
  readonly breedable: Count;
  readonly limited: Count;
  readonly event: Count;
  /** Elemental, Epic, Special, in that order. */
  readonly groups: readonly GroupCount[];
};
