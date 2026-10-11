// What each tab holds before search and filters (spec §8 Tabs).

import type { Dragon } from '../../snapshot';
import { breedableNow, type Cave } from '../breeding';
import type { EndDate } from '../limited';
import type { World } from '../world';
import type { MenuItem, Section, Tab, TabContents } from './types';

/**
 * Names a tab: `page:<page>`, `all`, `breedable`, `limited` or `event`. Equal
 * for the same tab. Saved arrangements use it in their storage keys, so keep
 * the spelling stable.
 */
export function tabKey(tab: Tab): string {
  return tab.kind === 'page' ? `page:${tab.page}` : tab.kind;
}

/**
 * The sections of `tab`:
 *
 * - Dragonarium page: one section, the page's Dragons in the game's order.
 *   An unknown page name gives no sections.
 * - All: one section, every Dragon in the snapshot in release order.
 * - Breedable now: one section, every Dragon Breedable now in `cave`, in
 *   snapshot order.
 * - Limited rotation: one section, the overlay's list with end dates.
 * - Event: one section per running Event, each Dragon with its shop cost and
 *   end date. `noEvent` when none is running; `notRecognised` from the overlay.
 *
 * Entries whose end date is before `world.now`'s local day are left out, as
 * are Events that have ended, so a stale overlay never shows a dead entry.
 */
export function tabContents(world: World, tab: Tab, cave: Cave): TabContents {
  switch (tab.kind) {
    case 'page': {
      const page = world.snapshot.pages.find((p) => p.name === tab.page);
      if (!page) return contents([]);
      return contents([{ kind: 'page', page, items: itemsFor(world, page.dragons) }]);
    }
    case 'all': {
      const items = [...world.snapshot.dragons].sort((a, b) => a.order - b.order).map((dragon) => ({ dragon }));
      return contents([{ kind: 'all', items }]);
    }
    case 'breedable': {
      const names = breedableNow(world, cave);
      const items = world.snapshot.dragons.filter((d) => names.has(d.name)).map((dragon) => ({ dragon }));
      return contents([{ kind: 'breedable', items }]);
    }
    case 'limited': {
      const today = localDay(world.now);
      const items: MenuItem[] = [];
      for (const entry of world.overlay.rotation) {
        const dragon = world.dragons.get(entry.dragon);
        if (dragon && live(entry.ends, today)) items.push({ dragon, ends: entry.ends });
      }
      return contents([{ kind: 'rotation', items }]);
    }
    case 'event': {
      const today = localDay(world.now);
      const sections: Section[] = [];
      for (const event of world.overlay.events) {
        if (!live(event.ends, today)) continue;
        const items: MenuItem[] = [];
        for (const entry of event.shop) {
          const dragon = world.dragons.get(entry.dragon);
          if (dragon && live(entry.ends, today)) items.push({ dragon, ends: entry.ends, cost: entry.cost });
        }
        sections.push({
          kind: 'event',
          event: { name: event.name, ends: event.ends, currency: event.currency },
          items,
        });
      }
      return { sections, noEvent: sections.length === 0, notRecognised: world.overlay.notRecognised };
    }
  }
}

/**
 * Whole days from `now`'s local day to `ends` ("ends in N days"): 0 on the
 * last day. null when there is no end date.
 */
export function daysLeft(ends: EndDate, now: Date): number | null {
  if (ends === null) return null;
  const [y, m, d] = ends.split('-').map(Number) as [number, number, number];
  const end = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end - today) / 86_400_000);
}

const contents = (sections: Section[]): TabContents => ({ sections, noEvent: false, notRecognised: [] });

function itemsFor(world: World, names: readonly string[]): MenuItem[] {
  return names.map((name) => world.dragons.get(name)).filter((d): d is Dragon => d !== undefined).map((dragon) => ({ dragon }));
}

const live = (ends: EndDate, today: string) => ends === null || ends >= today;

const pad = (n: number) => String(n).padStart(2, '0');

/** `now`'s calendar day in local time, `YYYY-MM-DD`; compares as a string with EndDate. */
const localDay = (now: Date) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
