// Wording for the menu grid's sections: headings, empty states and tile notes
// ("ends in N days", Event shop costs).

import { daysLeft, type EventInfo, type MenuItem, type Section } from '../../lib/core/menu';
import type { EndDate } from '../../lib/core/limited';
import type { LimitedStatus } from '../store.svelte';

/**
 * A section's heading, or null for none. A tab with one section needs none;
 * the page header names it. Event sections always get EventHeading instead.
 */
export function sectionHeading(section: Section, count: number): string | null {
  if (count < 2) return null;
  switch (section.kind) {
    case 'page':
      return section.page.name;
    case 'all':
      return 'All Dragons';
    case 'event':
      return section.event.name;
    case 'breedable':
      return 'Breedable now';
    case 'rotation':
      return 'Limited rotation';
    case 'search':
      return `Search: “${section.query}”`;
  }
}

/** Why the Limited data may be missing: still loading, or neither the wiki nor a cache had it. null = we have it. */
export type LimitedGap = 'loading' | 'none' | null;

export function limitedGap(status: LimitedStatus): LimitedGap {
  return status === 'loading' || status === 'none' ? status : null;
}

const GAP_TEXT: Record<'loading' | 'none', string> = {
  loading: 'Loading the Limited data from the wiki…',
  none: 'Limited data unavailable: the wiki couldn’t be reached and there is no saved copy.',
};

/**
 * What an empty section says. `hiddenByFilters`: filters are on, so they may
 * be what emptied it. `find`: the page header's find text, which may have
 * too. `gap`: the Limited data is missing, which explains an empty Limited
 * rotation.
 */
export function emptyText(
  section: Section,
  hiddenByFilters: boolean,
  caveTitle: string,
  gap: LimitedGap = null,
  find = '',
): string {
  const found = find.trim();
  if (found && hiddenByFilters) return `Nothing here matches “${found}” and the filters.`;
  if (found) return `Nothing here matches “${found}”.`;
  if (hiddenByFilters) return 'Nothing here matches the filters.';
  switch (section.kind) {
    case 'search':
      return 'No Dragon matches that search.';
    case 'breedable':
      return `Nothing is Breedable now in the ${caveTitle} cave.`;
    case 'rotation':
      return gap ? GAP_TEXT[gap] : 'Nothing is in the Limited rotation right now.';
    case 'event':
      return 'This Event has no Dragons to show.';
    case 'page':
    case 'all':
      return 'Nothing here with this Owned forms setting.';
  }
}

/**
 * The Event tab's note for the Dragons it lists that the snapshot doesn't
 * have: usually new ones, which arrive with the next snapshot refresh.
 */
export function notRecognisedText(names: readonly string[]): string {
  const subject = names.length === 1 ? `${names[0]} isn’t` : `${names.join(', ')} aren’t`;
  return `${subject} in this app’s data yet, so ${names.length === 1 ? 'it isn’t' : 'they aren’t'} shown. New Dragons appear after the next data update, once the wiki has them.`;
}

/** The Event tab's text when no Event is running (it reads "No event"). */
export function noEventText(gap: LimitedGap): string {
  return gap ? GAP_TEXT[gap] : 'No event is running right now. This tab fills in by itself when the next event starts.';
}

/** "today", "in 1 day", "in N days"; null with no end date. */
function inDays(ends: EndDate, now: Date): string | null {
  const days = daysLeft(ends, now);
  if (days === null) return null;
  if (days <= 0) return 'today';
  return `in ${days} ${days === 1 ? 'day' : 'days'}`;
}

/** "ends today", "ends in 1 day", "ends in N days"; null with no end date. */
export function endsText(ends: EndDate, now: Date): string | null {
  const when = inDays(ends, now);
  return when === null ? null : `ends ${when}`;
}

/** An EndDate as a local date, e.g. "12 Oct 2026". */
export function endDateText(ends: string): string {
  const [y, m, d] = ends.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The line under an Event's name: end date and currency. */
export function eventSubtitle(event: EventInfo, now: Date): string {
  const parts: string[] = [];
  if (event.ends === null) parts.push('No end date known');
  else parts.push(`Ends ${endDateText(event.ends)} (${inDays(event.ends, now)})`);
  if (event.currency) parts.push(`Currency: ${event.currency}`);
  return parts.join(' · ');
}

/** A shop cost in the Event's currency: "1,500 Spice"; null when the cost isn't a number. */
export function costText(cost: number | null | undefined, currency: string | null): string | null {
  if (cost === null || cost === undefined) return null;
  return currency ? `${cost.toLocaleString()} ${currency}` : cost.toLocaleString();
}

/**
 * A tile's note under its name, or undefined for none:
 * - Limited rotation: "ends in N days".
 * - Event: the shop cost, and "ends in N days" when the Dragon leaves the shop
 *   before the Event ends.
 */
export function itemNote(section: Section, item: MenuItem, now: Date): string | undefined {
  switch (section.kind) {
    case 'rotation':
      return endsText(item.ends ?? null, now) ?? undefined;
    case 'event': {
      const cost = costText(item.cost, section.event.currency);
      const own = item.ends !== undefined && item.ends !== section.event.ends ? endsText(item.ends, now) : null;
      const parts = [cost, own].filter((p): p is string => p !== null);
      return parts.length ? parts.join(' · ') : undefined;
    }
    default:
      return undefined;
  }
}
