// Titles and icons for the menu's tabs and caves. Wording and asset paths
// only; what each tab holds comes from core/menu.

import type { Cave } from '../../lib/core/breeding';
import type { EventInfo, Tab, TabContents } from '../../lib/core/menu';
import { GENERIC_EVENT_ICON, MENU_ICONS, currencyIconPath, type DragonariumPage, type Snapshot } from '../../lib/snapshot';

/** An icon to draw: a path under public/, fallbacks to try in order if it fails to load, and whether to crop it to a circle. */
export type IconSpec = { readonly src: string; readonly fallbacks?: readonly string[]; readonly crop?: boolean };

export const CAVE_ICONS: Record<Cave, string> = {
  normal: MENU_ICONS.normalCave,
  rift: MENU_ICONS.riftCave,
  coop: MENU_ICONS.coopCave,
};

export const GROUP_TITLES: Record<DragonariumPage['group'], string> = {
  elemental: 'Elemental',
  epic: 'Epic',
  special: 'Special',
};

/** The All tab: every Dragon, under the Dragonarium's icon. */
export const ALL_ICON: IconSpec = { src: MENU_ICONS.dragonarium };
export const ALL_TITLE = 'All Dragons';
export const BREEDABLE_ICON: IconSpec = { src: MENU_ICONS.breedable };
/**
 * The hourglass: the scraper already cut the green disc out of the wiki's
 * framed art; the circle clip removes the frame's corners left in the square.
 */
export const LIMITED_ICON: IconSpec = { src: MENU_ICONS.limited, crop: true };

/**
 * An Event's icon: its currency's (Candy for a Candy Bash), else the generic
 * one. The generic one too when no Event is running or its currency is unknown.
 */
export function eventIcon(event: EventInfo | undefined): IconSpec {
  return event?.currency ? { src: currencyIconPath(event.currency), fallbacks: [GENERIC_EVENT_ICON] } : { src: GENERIC_EVENT_ICON };
}

export function pageIcon(page: DragonariumPage | undefined): IconSpec | null {
  return page?.icon ? { src: page.icon } : null;
}

/** The Event tab's label: "Event", or "No event" while none is running. */
export function eventLabel(contents: TabContents | null): string {
  return contents?.noEvent ? 'No event' : 'Event';
}

/** The page header's title and icon for `tab`. */
export function tabHeading(
  tab: Tab,
  snapshot: Snapshot,
  contents: TabContents,
): { readonly title: string; readonly icon: IconSpec | null } {
  switch (tab.kind) {
    case 'page':
      return { title: tab.page, icon: pageIcon(snapshot.pages.find((p) => p.name === tab.page)) };
    case 'all':
      return { title: ALL_TITLE, icon: ALL_ICON };
    case 'breedable':
      return { title: 'Breedable now', icon: BREEDABLE_ICON };
    case 'limited':
      return { title: 'Limited rotation', icon: LIMITED_ICON };
    case 'event': {
      const first = contents.sections.find((s) => s.kind === 'event');
      return { title: eventLabel(contents), icon: eventIcon(first?.kind === 'event' ? first.event : undefined) };
    }
  }
}
