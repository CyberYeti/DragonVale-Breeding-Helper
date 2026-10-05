// Tolerant parse of the hand-edited Data:Limited.json page (spec §5). The app
// can't fail at runtime, so nothing here throws: junk is skipped, unknown names
// are reported, bad dates mean "no end date".

import type { EndDate, LimitedEvent, Overlay, RotationEntry, ShopEntry } from './types';

export const emptyOverlay = (): Overlay => ({ rotation: [], events: [], notRecognised: [] });

/**
 * Parses the page's text (the page content itself, not the api.php envelope)
 * into the overlay of what is Available at `now`.
 *
 * - `dragons` is the Limited rotation; `events.<name>.dragons` is each Event's
 *   shop. Other top-level keys (`decorations`, `islandThemes`, …) are ignored.
 * - Shop entries that aren't objects or have no `Cost` are skipped (today
 *   `islands`, `islandThemes`).
 * - Names match `dragonNames` exactly; the rest go in `notRecognised`.
 * - A Dragon's own `countdown` overrides its Event's. Anything whose end date
 *   is before `now`'s local day is absent; an Event that has ended takes its
 *   whole shop with it.
 * - An unparseable countdown means no end date. For a shop entry that means
 *   it has no end of its own, so the Event's end applies.
 */
export function parseLimited(rawText: string, dragonNames: Iterable<string>, now: Date): Overlay {
  let page: unknown;
  try {
    page = JSON.parse(rawText);
  } catch {
    return emptyOverlay();
  }
  if (!isObject(page)) return emptyOverlay();

  const known = new Set(dragonNames);
  const today = localDay(now);
  const notRecognised = new Set<string>();
  const recognised = (name: string): boolean => {
    if (known.has(name)) return true;
    notRecognised.add(name);
    return false;
  };

  const rotation: RotationEntry[] = [];
  for (const [name, entry] of entries(page.dragons)) {
    if (!isObject(entry)) continue;
    const ends = endDate(entry.countdown);
    if (hasEnded(ends, today) || !recognised(name)) continue;
    rotation.push({ dragon: name, ends });
  }

  const events: LimitedEvent[] = [];
  for (const [name, event] of entries(page.events)) {
    if (!isObject(event)) continue;
    const eventEnds = endDate(event.countdown);
    if (hasEnded(eventEnds, today)) continue;

    let currency = typeof event.Currency === 'string' ? event.Currency : null;
    const shop: ShopEntry[] = [];
    for (const [dragon, entry] of entries(event.dragons)) {
      if (!isObject(entry) || !('Cost' in entry)) continue;
      const ends = endDate(entry.countdown) ?? eventEnds;
      if (hasEnded(ends, today) || !recognised(dragon)) continue;
      if (currency === null && typeof entry.Currency === 'string') currency = entry.Currency;
      shop.push({ dragon, cost: toCost(entry.Cost), breedable: entry.Breedable !== false, ends });
    }
    events.push({ name, ends: eventEnds, currency, shop });
  }

  return { rotation, events, notRecognised: [...notRecognised] };
}

type Obj = Record<string, unknown>;

const isObject = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const entries = (value: unknown): [string, unknown][] => (isObject(value) ? Object.entries(value) : []);

function toCost(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number(value.replace(/[,\s]/g, ''));
    return value.trim() !== '' && Number.isFinite(n) ? n : null;
  }
  return null;
}

// ---- Dates ----------------------------------------------------------------

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

function monthIndex(word: string): number {
  const w = word.toLowerCase().replace(/\.$/, '');
  if (w.length < 3) return -1;
  return MONTHS.findIndex((m) => m.startsWith(w) || (w === 'sept' && m === 'september'));
}

/** `countdown` → `YYYY-MM-DD`, or null if it's missing or unreadable. */
function endDate(countdown: unknown): EndDate {
  if (typeof countdown !== 'string') return null;
  const text = countdown.trim();

  let year: number, month: number, day: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  const written = /^([A-Za-z]+\.?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(text);
  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (written) {
    [year, month, day] = [Number(written[3]), monthIndex(written[1] ?? '') + 1, Number(written[2])];
  } else {
    return null;
  }

  // Reject days that don't exist (February 30 and the like).
  const check = new Date(year, month - 1, day);
  if (month < 1 || check.getFullYear() !== year || check.getMonth() !== month - 1 || check.getDate() !== day) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `now`'s calendar day in local time, `YYYY-MM-DD`. */
const localDay = (now: Date) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

/** Ended = its last day is before today (local). Same-length ISO days compare as strings. */
const hasEnded = (ends: EndDate, today: string) => ends !== null && ends < today;
