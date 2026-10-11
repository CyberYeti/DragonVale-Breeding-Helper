// fetchPages(): the raw Data:*.json pages the snapshot is built from, plus
// each page's revision ID. Two adapters sit behind it:
//
//   live    one api.php request to the DragonVale wiki (`npm run snapshot`)
//   offline the raw pages committed under public/data/raw/ (`--offline`)
//
// fetchRevisions() asks the wiki for the revision IDs alone (`--check`), and
// changedPages() compares them with a pages.json manifest's, so the scheduled
// refresh scrapes only when a page changed.
//
// Page content is kept as the exact text the wiki returned, so the committed
// files are byte-for-byte what was fetched. Callers parse it themselves.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const WIKI = 'https://dragonvale.fandom.com';
export const API_URL = `${WIKI}/api.php`;
export const USER_AGENT =
  'DragonValeBreedingHelper/0.1 (https://github.com/CyberYeti/DragonVale-Breeding-Helper; ' +
  'snapshot scraper: a revision check every few hours, a full fetch only when a page changed)';

/** The pages the scraper needs, by wiki title, with the file each is saved to. */
const PAGES = {
  'Data:Dragons.json': 'Dragons.json',
  'Data:BreedingHints.json': 'BreedingHints.json',
  'Data:Game.json': 'Game.json',
  'Data:Dragonarium.json': 'Dragonarium.json',
  'Data:Limited.json': 'Limited.json',
} as const;

export type PageTitle = keyof typeof PAGES;
export const PAGE_TITLES = Object.keys(PAGES) as PageTitle[];

export type RawPage = {
  revision: number; // the wiki's revid
  content: string; // the page text, unparsed
};

export type RawPages = {
  source: string; // wiki URL
  fetchedAt: string; // ISO time of the live request
  pages: Record<PageTitle, RawPage>;
};

/** Where the committed raw pages live, relative to the repo root. */
export const RAW_DIR = 'public/data/raw';
const MANIFEST = 'pages.json';

type Manifest = {
  source: string;
  fetchedAt: string;
  license: string;
  pages: Record<string, { file: string; revision: number }>;
};

export type PageSource = { kind: 'live'; fetch?: typeof fetch; now?: () => Date } | { kind: 'offline'; dir: string };

export async function fetchPages(source: PageSource): Promise<RawPages> {
  return source.kind === 'live' ? fetchLive(source.fetch ?? fetch, source.now ?? (() => new Date())) : readRawPages(source.dir);
}

// ---- live --------------------------------------------------------------------

function liveRequestUrl(rvprop: 'content|ids' | 'ids'): string {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'revisions',
    rvprop,
    ...(rvprop === 'ids' ? {} : { rvslots: 'main' }),
    titles: PAGE_TITLES.join('|'),
    format: 'json',
    formatversion: '2',
  });
  return `${API_URL}?${params}`;
}

/** One request to the wiki API. No retries: a failed run is simply tried again at the next one. */
async function requestJson(fetchFn: typeof fetch, url: string): Promise<unknown> {
  const response = await fetchFn(url, {
    headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Wiki API answered ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchLive(fetchFn: typeof fetch, now: () => Date): Promise<RawPages> {
  // One request for all five pages.
  return parseApiResponse(await requestJson(fetchFn, liveRequestUrl('content|ids')), now().toISOString());
}

/** Each page's current revision ID, in one small request (no page content). */
export async function fetchRevisions(fetchFn: typeof fetch = fetch): Promise<Record<PageTitle, number>> {
  const pages = queryPages(await requestJson(fetchFn, liveRequestUrl('ids')));
  const revisions = {} as Record<PageTitle, number>;
  for (const title of PAGE_TITLES) {
    const revid = pages.get(title)?.revisions?.[0]?.revid;
    if (typeof revid !== 'number') throw new Error(`Wiki API response lacks a revision ID for ${title}`);
    revisions[title] = revid;
  }
  return revisions;
}

/** A pages.json manifest's revision IDs (the committed one, or another branch's copy). */
export async function readManifestRevisions(file: string): Promise<Partial<Record<PageTitle, number>>> {
  const manifest = JSON.parse(await readFile(file, 'utf8')) as Manifest;
  const revisions: Partial<Record<PageTitle, number>> = {};
  for (const title of PAGE_TITLES) {
    const revision = manifest.pages[title]?.revision;
    if (typeof revision === 'number') revisions[title] = revision;
  }
  return revisions;
}

/** The pages whose revision in `current` differs from (or is missing in) `baseline`. */
export function changedPages(
  current: Record<PageTitle, number>,
  baseline: Partial<Record<PageTitle, number>>,
): PageTitle[] {
  return PAGE_TITLES.filter((title) => baseline[title] !== current[title]);
}

/** The pages of an `action=query` response (formatversion=2) by title. Throws on an API error or a missing page. */
function queryPages(body: unknown): Map<string, ApiPage> {
  const query = (body as { query?: { pages?: unknown } } | null)?.query;
  const error = (body as { error?: { info?: string } } | null)?.error;
  if (error) throw new Error(`Wiki API error: ${error.info ?? JSON.stringify(error)}`);
  if (!query || !Array.isArray(query.pages)) {
    throw new Error('Wiki API response has no query.pages array');
  }
  const pages = new Map<string, ApiPage>();
  for (const page of query.pages as ApiPage[]) {
    if (page.missing || page.invalid) {
      throw new Error(`Wiki page ${page.title} is missing`);
    }
    pages.set(page.title, page);
  }
  return pages;
}

/** Turns an `action=query&prop=revisions` response (formatversion=2) into RawPages. */
function parseApiResponse(body: unknown, fetchedAt: string): RawPages {
  const found = new Map<string, RawPage>();
  for (const page of queryPages(body).values()) {
    const revision = page.revisions?.[0];
    const content = revision?.slots?.main?.content;
    if (!revision || typeof revision.revid !== 'number' || typeof content !== 'string') {
      throw new Error(`Wiki page ${page.title} came back without content or revision ID`);
    }
    found.set(page.title, { revision: revision.revid, content });
  }

  const pages = {} as Record<PageTitle, RawPage>;
  for (const title of PAGE_TITLES) {
    const page = found.get(title);
    if (!page) throw new Error(`Wiki API response lacks ${title}`);
    pages[title] = page;
  }
  return { source: WIKI, fetchedAt, pages };
}

type ApiPage = {
  title: string;
  missing?: boolean;
  invalid?: boolean;
  revisions?: { revid?: number; slots?: { main?: { content?: string } } }[];
};

// ---- offline -----------------------------------------------------------------

async function readRawPages(dir: string): Promise<RawPages> {
  const manifest = JSON.parse(await readFile(join(dir, MANIFEST), 'utf8')) as Manifest;
  const pages = {} as Record<PageTitle, RawPage>;
  for (const title of PAGE_TITLES) {
    const entry = manifest.pages[title];
    if (!entry) throw new Error(`${join(dir, MANIFEST)} lacks ${title}`);
    pages[title] = {
      revision: entry.revision,
      content: await readFile(join(dir, entry.file), 'utf8'),
    };
  }
  return { source: manifest.source, fetchedAt: manifest.fetchedAt, pages };
}

export async function writeRawPages(dir: string, raw: RawPages): Promise<void> {
  await mkdir(dir, { recursive: true });
  const manifest: Manifest = {
    source: raw.source,
    fetchedAt: raw.fetchedAt,
    license: 'CC BY-SA 3.0',
    pages: {},
  };
  for (const title of PAGE_TITLES) {
    const page = raw.pages[title];
    const file = PAGES[title];
    await writeFile(join(dir, file), page.content, 'utf8');
    manifest.pages[title] = { file, revision: page.revision };
  }
  await writeFile(join(dir, MANIFEST), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}
