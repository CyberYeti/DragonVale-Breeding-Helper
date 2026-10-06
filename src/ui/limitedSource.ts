// The app's only live request (spec §5): the raw text of Data:Limited.json,
// fetched once when the app opens. The raw page text and its fetch time are
// cached in localStorage; when the fetch fails the cached copy is used. The
// caller parses the raw text (core/limited) on every load, so a parser fix
// also applies to a cached copy.

import { isRecord, readStoredJson, writeStored } from './storage';

export const LIMITED_URL =
  'https://dragonvale.fandom.com/api.php?action=query&prop=revisions&titles=Data:Limited.json&rvprop=content|ids&rvslots=main&format=json&origin=*';

/** Versioned: bump the suffix if the cached shape changes. */
const CACHE_KEY = 'limited:v1';

const TIMEOUT_MS = 15_000;

/** The page's raw text and when it was fetched. */
export type LimitedRaw = {
  /** The page content (JSON text), not the api.php response. */
  readonly raw: string;
  /** When this copy was fetched from the wiki. */
  readonly fetchedAt: Date;
};

export type LimitedResult =
  /** Fetched just now (and cached). */
  | { readonly source: 'live'; readonly data: LimitedRaw }
  /** The fetch failed; this is the cached copy. Show "Limited data as of <fetchedAt>". */
  | { readonly source: 'cache'; readonly data: LimitedRaw }
  /** The fetch failed and nothing is cached. */
  | { readonly source: 'none' };

/** The cached copy, or null when there is none (or storage is unavailable). */
export function readCachedLimited(): LimitedRaw | null {
  const stored = readStoredJson(CACHE_KEY);
  if (!isRecord(stored) || typeof stored.raw !== 'string' || typeof stored.fetchedAt !== 'string') return null;
  const fetchedAt = new Date(stored.fetchedAt);
  if (Number.isNaN(fetchedAt.getTime())) return null;
  return { raw: stored.raw, fetchedAt };
}

/** Fetches the page, caching it on success and falling back to the cache on any failure. Never throws. */
export async function fetchLimited(): Promise<LimitedResult> {
  try {
    const response = await fetch(LIMITED_URL, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = pageContent(await response.json());
    const data: LimitedRaw = { raw, fetchedAt: new Date() };
    writeStored(CACHE_KEY, JSON.stringify({ raw, fetchedAt: data.fetchedAt.toISOString() }));
    return { source: 'live', data };
  } catch {
    const cached = readCachedLimited();
    return cached ? { source: 'cache', data: cached } : { source: 'none' };
  }
}

/**
 * Pulls `query.pages[*].revisions[0].slots.main.content` out of the api.php
 * response. Throws when it's missing or isn't a JSON object, so a broken
 * response never replaces a good cached copy.
 */
function pageContent(response: unknown): string {
  const pages = isRecord(response) && isRecord(response.query) ? response.query.pages : undefined;
  if (isRecord(pages)) {
    for (const page of Object.values(pages)) {
      const revision = isRecord(page) && Array.isArray(page.revisions) ? page.revisions[0] : undefined;
      const main = isRecord(revision) && isRecord(revision.slots) ? revision.slots.main : undefined;
      const content = isRecord(main) ? (main.content ?? main['*']) : undefined;
      if (typeof content === 'string' && isJsonObject(content)) return content;
    }
  }
  throw new Error('Data:Limited.json: no page content in the response');
}

function isJsonObject(text: string): boolean {
  try {
    return isRecord(JSON.parse(text));
  } catch {
    return false;
  }
}
