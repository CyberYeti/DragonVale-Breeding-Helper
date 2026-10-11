// downloadImages(snapshot, options): resolves every image the app needs
// through the wiki's imageinfo API, downloads the ones not already saved under
// public/images/, and fills `image` / `icon` with local paths (spec §4 Images).
//
// What's fetched:
//   Dragons   <Name without spaces/punctuation>DragonAdult.png, or the file
//             named in IMAGE_OVERRIDES.dragons
//   Elements  Icon <Element>.png, for the Elements in the snapshot
//   Pages     <Name without spaces/punctuation>DragonariumIcon.png
//   Menu      the fixed icons in MENU_FILES (paths in src/lib/snapshot/images)
//   Currencies for each Event currency (eventCurrencies), the file its wiki
//             template shows: Template:<Currency>, else Template:<Currency>s,
//             is {{TreasureIcon|<file>|...}} ("Candy" -> candy_template.png).
//             Without one, <Currency>FilterOn.png (the shop's filter button).
//             Saved under currencyIconPath; the app shows the running Event's.
//
// Network etiquette: one imageinfo request per 50 files, one template request
// per 25 currencies whose icon isn't on disk yet, every request
// sequential with a pause between, a descriptive User-Agent, and retries with
// backoff only on 429, 5xx and network errors. Files already on disk are
// neither resolved nor downloaded again. Static files are downloaded once and
// served from this repo; the app never hotlinks the wiki's CDN.
//
// A missing image is a warning and a null path; a missing currency icon is
// not (an Event paying in it shows the generic icon).

import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { IMAGES_DIR, MENU_ICONS, currencyIconPath, isRecord, squash, type MenuIcon, type Snapshot } from '../src/lib/snapshot';
import { API_URL, USER_AGENT, type RawPages } from './pages';
import { cropPng, isPng, type CropBox } from './png';

/** Thumbnail width asked of imageinfo (spec §4). */
const THUMB_WIDTH = 120;
/** The API's limit on titles per query. */
const BATCH_SIZE = 50;

export type ImageOverrides = {
  /** Dragon name -> wiki file name. */
  dragons: Record<string, string>;
  /** Element name -> wiki file name. */
  elements: Record<string, string>;
  /** Dragonarium page name -> wiki file name. */
  pages: Record<string, string>;
};

/**
 * The files that don't follow the naming convention, taken from the wiki's
 * Module:Dragon (d.imageWithName) and checked against imageinfo:
 *   - Legendary and Mythic Dragons: <Name>Adult.png
 *   - Snowflake, Monolith and Dracomancy forms: <Base>DragonAdult<N>.png
 *   - Seasonal: one file per season; the Spring one is used
 *   - Names with punctuation keep it in the file name
 */
const IMAGE_OVERRIDES: ImageOverrides = {
  dragons: {
    Kairos: 'KairosAdult.png',
    Gaia: 'GaiaAdult.png',
    Bahamut: 'BahamutAdult.png',
    Tiamat: 'TiamatAdult.png',
    "Ts'aishen": "Ts'aishenAdult.png",
    Seasonal: 'SpringSeasonalDragonAdult.png',
    ...numbered('Snowflake', 7),
    ...numbered('Monolith', 7),
    ...numbered('Dracomancy', 4),
    'Drack-o-Lantern': 'Drack-o-LanternDragonAdult.png',
    'Pyros & Glacius': 'Pyros&GlaciusDragonAdult.png',
    'Drak-E': 'Drak-EDragonAdult.png',
  },
  elements: {},
  pages: {},
};

function numbered(base: string, count: number): Record<string, string> {
  const files: Record<string, string> = {};
  for (let n = 1; n <= count; n++) files[`${base} ${n}`] = `${base}DragonAdult${n}.png`;
  return files;
}

/** Hourglass inside LimitedTimeDragonariumHelpIcon.png, in the original file's pixels. */
const HOURGLASS_CROP: CropBox = { x: 84, y: 84, width: 146, height: 146 };

/** The fixed menu icons: wiki file, and a crop of the original file where one is needed. */
const MENU_FILES: Record<MenuIcon, { file: string; crop?: CropBox }> = {
  breedable: { file: 'BreedingHeartIcon.png' },
  limited: { file: 'LimitedTimeDragonariumHelpIcon.png', crop: HOURGLASS_CROP },
  dragonarium: { file: 'DragonariumBasic.png' },
  normalCave: { file: 'BreedingCave2015.png' },
  riftCave: { file: 'RiftBreedingCave.png' },
  coopCave: { file: 'CooperativeBreedingCave2015.png' },
};

export type ImageKind = 'dragon' | 'element' | 'page' | 'menu' | 'currency';

/** One image to have on disk. */
export type ImageTarget = {
  kind: ImageKind;
  /** The Dragon, Element, page, menu icon or currency it's for. */
  key: string;
  /** Wiki file name, without the File: prefix. */
  file: string;
  /** Local path relative to public/ (what the snapshot stores). */
  path: string;
  /** Cut from the original file instead of the thumbnail. */
  crop?: CropBox;
};

function dragonImageFile(name: string, overrides: ImageOverrides = IMAGE_OVERRIDES): string {
  return overrides.dragons[name] ?? `${squash(name)}DragonAdult.png`;
}

function elementIconFile(name: string, overrides: ImageOverrides = IMAGE_OVERRIDES): string {
  return overrides.elements[name] ?? `Icon ${name}.png`;
}

function pageIconFile(name: string, overrides: ImageOverrides = IMAGE_OVERRIDES): string {
  return overrides.pages[name] ?? `${squash(name)}DragonariumIcon.png`;
}

/** A currency's templates, in the order to try: Template:Candy, then Template:Candys (Doubloon's is Template:Doubloons). */
function currencyTemplates(currency: string): string[] {
  return [`Template:${currency}`, `Template:${currency}s`];
}

/** The icon file a currency template shows: `{{TreasureIcon|candy_template.png|Candy|17px|...}}` -> candy_template.png. */
export function treasureIconFile(wikitext: string): string | null {
  return /\{\{\s*TreasureIcon\s*\|\s*([^|}]+?)\s*\|/i.exec(wikitext)?.[1] ?? null;
}

/**
 * The files to try for a currency's icon, in order: its template's, then its
 * filter button squashed ("StarDustFilterOn.png"), then as Module:DvWiki
 * spells an unlisted one ("Legendary EggFilterOn.png").
 */
function currencyFiles(currency: string, templateFile: string | null): string[] {
  const files = [templateFile, `${squash(currency)}FilterOn.png`, `${currency}FilterOn.png`];
  return [...new Set(files.filter((f): f is string => f !== null))];
}

/**
 * Every image the snapshot and the menus need. Throws if two targets would
 * share a local path (two names that squash to the same thing).
 */
function planImages(snapshot: Snapshot, overrides: ImageOverrides = IMAGE_OVERRIDES): ImageTarget[] {
  const targets: ImageTarget[] = [
    ...snapshot.dragons.map((d) => target('dragon', d.name, dragonImageFile(d.name, overrides), `dragons/${squash(d.name)}.png`)),
    ...snapshot.elements.map((e) => target('element', e.name, elementIconFile(e.name, overrides), `elements/${squash(e.name)}.png`)),
    ...snapshot.pages.map((p) => target('page', p.name, pageIconFile(p.name, overrides), `pages/${squash(p.name)}.png`)),
    ...(Object.entries(MENU_FILES) as [MenuIcon, (typeof MENU_FILES)[MenuIcon]][]).map(([key, { file, crop }]) => ({
      kind: 'menu' as const,
      key,
      file,
      path: MENU_ICONS[key],
      ...(crop ? { crop } : {}),
    })),
  ];
  const seen = new Map<string, ImageTarget>();
  for (const t of targets) {
    const other = seen.get(t.path);
    if (other) throw new Error(`${other.kind} ${other.key} and ${t.kind} ${t.key} would both be saved as ${t.path}`);
    seen.set(t.path, t);
  }
  return targets;
}

function target(kind: ImageKind, key: string, file: string, path: string): ImageTarget {
  return { kind, key, file, path: `${IMAGES_DIR}/${path}` };
}

/**
 * The Event currencies: Data:Game.json's `currencies.event`, plus any a
 * running Event in Data:Limited.json charges that the list lacks (the
 * Event's own Currency, or its shop's). Read tolerantly: a page that won't
 * parse adds none. One name per icon path.
 */
export function eventCurrencies(raw: RawPages): string[] {
  const byPath = new Map<string, string>();
  const add = (currency: unknown) => {
    if (typeof currency !== 'string' || squash(currency) === '') return;
    const path = currencyIconPath(currency);
    if (!byPath.has(path)) byPath.set(path, currency.trim());
  };
  const game = parseJson(raw.pages['Data:Game.json']?.content);
  const listed = isRecord(game) && isRecord(game.currencies) ? game.currencies.event : undefined;
  if (Array.isArray(listed)) listed.forEach(add);
  const limited = parseJson(raw.pages['Data:Limited.json']?.content);
  const events = isRecord(limited) && isRecord(limited.events) ? Object.values(limited.events) : [];
  for (const event of events) {
    if (!isRecord(event)) continue;
    add(event.Currency);
    if (isRecord(event.dragons)) for (const entry of Object.values(event.dragons)) if (isRecord(entry)) add(entry.Currency);
  }
  return [...byPath.values()];
}

function parseJson(text: string | undefined): unknown {
  try {
    return text === undefined ? null : (JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

function batches<T>(items: readonly T[], size = BATCH_SIZE): T[][] {
  if (size < 1) throw new Error('Batch size must be at least 1');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** One imageinfo query for up to BATCH_SIZE files, asking for the thumbnail URL as well. */
function imageInfoUrl(files: readonly string[]): string {
  if (files.length > BATCH_SIZE) throw new Error(`imageinfo takes at most ${BATCH_SIZE} titles, got ${files.length}`);
  const params = new URLSearchParams({
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: String(THUMB_WIDTH),
    titles: files.map((f) => `File:${f}`).join('|'),
    redirects: '1',
    format: 'json',
    formatversion: '2',
  });
  return `${API_URL}?${params}`;
}

/** One query for the wikitext of up to BATCH_SIZE templates, following redirects (Template:Iceberry -> Template:Iceberries). */
function templatesUrl(titles: readonly string[]): string {
  if (titles.length > BATCH_SIZE) throw new Error(`a query takes at most ${BATCH_SIZE} titles, got ${titles.length}`);
  const params = new URLSearchParams({
    action: 'query',
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    titles: titles.join('|'),
    redirects: '1',
    format: 'json',
    formatversion: '2',
  });
  return `${API_URL}?${params}`;
}

/**
 * Reads a template query (formatversion=2) into currency -> the file its
 * first existing template shows, or null when neither template exists or
 * shows a TreasureIcon. Normalized and redirected titles are traced back.
 */
function parseTemplates(body: unknown, currencies: readonly string[]): Map<string, string | null> {
  const query = queryOf(body);
  const normalized = new Map((query.normalized ?? []).map(({ from, to }) => [from, to]));
  const redirects = new Map((query.redirects ?? []).map(({ from, to }) => [from, to]));
  const byTitle = new Map((query.pages as TemplatePage[]).map((p) => [p.title, p]));
  const out = new Map<string, string | null>();
  for (const currency of currencies) {
    let file: string | null = null;
    for (const asked of currencyTemplates(currency)) {
      let title = normalized.get(asked) ?? asked;
      title = redirects.get(title) ?? title;
      const content = byTitle.get(title)?.revisions?.[0]?.slots?.main?.content;
      file = typeof content === 'string' ? treasureIconFile(content) : null;
      if (file) break;
    }
    out.set(currency, file);
  }
  return out;
}

type TemplatePage = { title: string; revisions?: { slots?: { main?: { content?: string } } }[] };

/** The `query` of an action=query response; throws on an API error or a response without pages. */
function queryOf(body: unknown): { normalized?: FromTo[]; redirects?: FromTo[]; pages: unknown[] } {
  const b = body as {
    error?: { info?: string };
    query?: { normalized?: FromTo[]; redirects?: FromTo[]; pages?: unknown };
  } | null;
  if (b?.error) throw new Error(`Wiki API error: ${b.error.info ?? JSON.stringify(b.error)}`);
  const query = b?.query;
  if (!query || !Array.isArray(query.pages)) throw new Error('Wiki API response has no query.pages array');
  return { ...query, pages: query.pages };
}

type ResolvedFile = { url: string; thumbUrl: string } | null;

/**
 * Reads an imageinfo response (formatversion=2) into file name -> URLs, for
 * each requested file. The API normalizes titles (underscores, first letter)
 * and follows redirects; both are traced back to the name asked for. A file
 * the wiki doesn't have maps to null.
 */
function parseImageInfo(body: unknown, files: readonly string[]): Map<string, ResolvedFile> {
  const query = queryOf(body);
  const normalized = new Map((query.normalized ?? []).map(({ from, to }) => [from, to]));
  const redirects = new Map((query.redirects ?? []).map(({ from, to }) => [from, to]));
  const byTitle = new Map((query.pages as ImageInfoPage[]).map((p) => [p.title, p]));

  const out = new Map<string, ResolvedFile>();
  for (const file of files) {
    let title = `File:${file}`;
    title = normalized.get(title) ?? title;
    title = redirects.get(title) ?? title;
    const info = byTitle.get(title)?.imageinfo?.[0];
    out.set(file, info?.url ? { url: info.url, thumbUrl: info.thumburl ?? info.url } : null);
  }
  return out;
}

/**
 * The wiki's CDN answers with WebP unless asked for the original format,
 * whatever the Accept header says; format=original keeps the PNG.
 */
function asPng(url: string): string {
  const u = new URL(url);
  u.searchParams.set('format', 'original');
  return u.toString();
}

type FromTo = { from: string; to: string };
type ImageInfoPage = { title: string; missing?: boolean; imageinfo?: { url?: string; thumburl?: string }[] };

/** The snapshot with `image` / `icon` set to the path of each target found on disk, else null. */
function applyImagePaths(snapshot: Snapshot, targets: readonly ImageTarget[], onDisk: ReadonlySet<string>): Snapshot {
  const pathFor = (kind: ImageKind, key: string): string | null => {
    const t = targets.find((x) => x.kind === kind && x.key === key);
    return t && onDisk.has(t.path) ? t.path : null;
  };
  return {
    ...snapshot,
    elements: snapshot.elements.map((e) => ({ ...e, icon: pathFor('element', e.name) })),
    dragons: snapshot.dragons.map((d) => ({ ...d, image: pathFor('dragon', d.name) })),
    pages: snapshot.pages.map((p) => ({ ...p, icon: pathFor('page', p.name) })),
  };
}

// ---- I/O ---------------------------------------------------------------------

export type ImageReport = {
  /** HTTP requests made (imageinfo queries and downloads, retries included). */
  requests: number;
  /** Targets already on disk before this run. */
  existing: number;
  /** Paths written this run. */
  downloaded: string[];
  /** Targets with no file on disk after the run (the wiki lacks them, or downloading was off). */
  missing: ImageTarget[];
  /** One line per missing target, except currency icons. */
  warnings: string[];
};

export type DownloadOptions = {
  /** Repo root; images go to <root>/public/<path>. */
  root: string;
  /** Event currencies to have an icon for (eventCurrencies). */
  currencies?: string[];
  overrides?: ImageOverrides;
  /** false: only use what's on disk, no network. */
  download?: boolean;
  fetch?: typeof fetch;
  /** Pause before every request. */
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
};

export async function downloadImages(
  snapshot: Snapshot,
  options: DownloadOptions,
): Promise<{ snapshot: Snapshot; report: ImageReport }> {
  const { root, currencies = [], overrides = IMAGE_OVERRIDES, download = true, log = () => {} } = options;
  const targets = planImages(snapshot, overrides);
  const icons = currencies.map((name) => ({ name, path: currencyIconPath(name) }));
  const local = (t: { path: string }) => join(root, 'public', t.path);

  const onDisk = new Set<string>();
  for (const t of [...targets, ...icons]) if (await exists(local(t))) onDisk.add(t.path);
  const existing = [...targets, ...icons].filter((t) => onDisk.has(t.path)).length;
  const todo = targets.filter((t) => !onDisk.has(t.path));
  const iconsTodo = icons.filter((c) => !onDisk.has(c.path));
  /** The files tried for each currency icon still to get. */
  const tried = new Map<string, string[]>();
  const downloaded: string[] = [];
  const client = new PoliteClient(options.fetch ?? fetch, options.delayMs ?? 250, options.sleep ?? sleep);

  if (download && todo.length + iconsTodo.length > 0) {
    // Each currency asks for two templates, so 25 currencies fill a query.
    const templateFiles = new Map<string, string | null>();
    for (const batch of batches(iconsTodo.map((c) => c.name), BATCH_SIZE / 2)) {
      log(`Reading the templates of ${batch.length} currencies...`);
      const body = await (await client.get(templatesUrl(batch.flatMap(currencyTemplates)), 'application/json')).json();
      for (const [currency, file] of parseTemplates(body, batch)) templateFiles.set(currency, file);
    }
    for (const c of iconsTodo) tried.set(c.name, currencyFiles(c.name, templateFiles.get(c.name) ?? null));

    const files = [...new Set([...todo.map((t) => t.file), ...[...tried.values()].flat()])];
    log(`Resolving ${files.length} files in ${Math.ceil(files.length / BATCH_SIZE)} imageinfo requests...`);
    const resolved = new Map<string, ResolvedFile>();
    for (const batch of batches(files)) {
      const body = await (await client.get(imageInfoUrl(batch), 'application/json')).json();
      for (const [file, r] of parseImageInfo(body, batch)) resolved.set(file, r);
    }
    const found: { file: string; path: string; crop?: CropBox }[] = todo.filter((t) => resolved.get(t.file));
    for (const c of iconsTodo) {
      const file = tried.get(c.name)!.find((f) => resolved.get(f));
      if (file) found.push({ file, path: c.path });
    }
    log(`Downloading ${found.length} files...`);
    for (const t of found) {
      const r = resolved.get(t.file)!;
      const response = await client.get(asPng(t.crop ? r.url : r.thumbUrl), 'image/png');
      const data = Buffer.from(await response.arrayBuffer());
      if (!isPng(data)) throw new Error(`${t.file} didn't come back as a PNG (${response.headers.get('content-type')})`);
      await mkdir(dirname(local(t)), { recursive: true });
      await writeFile(local(t), t.crop ? cropPng(data, t.crop) : data);
      onDisk.add(t.path);
      downloaded.push(t.path);
    }
  }

  const missing: ImageTarget[] = [
    ...targets.filter((t) => !onDisk.has(t.path)),
    ...icons
      .filter((c) => !onDisk.has(c.path))
      .map((c) => ({
        kind: 'currency' as const,
        key: c.name,
        file: (tried.get(c.name) ?? currencyTemplates(c.name)).join(' / '),
        path: c.path,
      })),
  ];
  const warnings = missing
    .filter((t) => t.kind !== 'currency')
    .map((t) => `image missing: ${t.kind} ${t.key} (File:${t.file})`);
  return {
    snapshot: applyImagePaths(snapshot, targets, onDisk),
    report: { requests: client.requests, existing, downloaded, missing, warnings },
  };
}

const RETRIES = 3;

/** Sequential GETs with a pause before each, and backoff retries on transient errors. */
class PoliteClient {
  requests = 0;
  constructor(
    private readonly fetchFn: typeof fetch,
    private readonly delayMs: number,
    private readonly sleepFn: (ms: number) => Promise<void>,
  ) {}

  async get(url: string, accept: string): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      await this.sleepFn(this.delayMs);
      this.requests++;
      let response: Response;
      try {
        response = await this.fetchFn(url, {
          headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT, Accept: accept },
        });
      } catch (error) {
        if (attempt >= RETRIES) throw error;
        await this.sleepFn(backoff(attempt));
        continue;
      }
      if (response.ok) return response;
      const transient = response.status === 429 || response.status >= 500;
      if (!transient || attempt >= RETRIES) {
        throw new Error(`GET ${url} answered ${response.status} ${response.statusText}`);
      }
      const retryAfter = Number(response.headers.get('retry-after'));
      await this.sleepFn(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff(attempt));
    }
  }
}

function backoff(attempt: number): number {
  return 2000 * 2 ** attempt;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
