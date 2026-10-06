// fetchPages(): the raw Data:*.json pages the snapshot is built from, plus
// each page's revision ID. Two adapters sit behind it:
//
//   live    one api.php request to the DragonVale wiki (`npm run snapshot`)
//   offline the raw pages committed under public/data/raw/ (`--offline`)
//
// Page content is kept as the exact text the wiki returned, so the committed
// files are byte-for-byte what was fetched. Callers parse it themselves.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const WIKI = 'https://dragonvale.fandom.com';
export const API_URL = `${WIKI}/api.php`;
export const USER_AGENT =
  'DragonValeBreedingHelper/0.1 (https://github.com/CyberYeti/DragonVale-Breeding-Helper; ' +
  'snapshot scraper, run by hand once per game release)';

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

function liveRequestUrl(): string {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'revisions',
    rvprop: 'content|ids',
    rvslots: 'main',
    titles: PAGE_TITLES.join('|'),
    format: 'json',
    formatversion: '2',
  });
  return `${API_URL}?${params}`;
}

async function fetchLive(fetchFn: typeof fetch, now: () => Date): Promise<RawPages> {
  // One request for all five pages. No retries: this runs by hand.
  const response = await fetchFn(liveRequestUrl(), {
    headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Wiki API answered ${response.status} ${response.statusText}`);
  }
  return parseApiResponse(await response.json(), now().toISOString());
}

/** Turns an `action=query&prop=revisions` response (formatversion=2) into RawPages. */
function parseApiResponse(body: unknown, fetchedAt: string): RawPages {
  const query = (body as { query?: { pages?: unknown } } | null)?.query;
  const error = (body as { error?: { info?: string } } | null)?.error;
  if (error) throw new Error(`Wiki API error: ${error.info ?? JSON.stringify(error)}`);
  if (!query || !Array.isArray(query.pages)) {
    throw new Error('Wiki API response has no query.pages array');
  }

  const found = new Map<string, RawPage>();
  for (const page of query.pages as ApiPage[]) {
    if (page.missing || page.invalid) {
      throw new Error(`Wiki page ${page.title} is missing`);
    }
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
