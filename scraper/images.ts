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
//   Events    for each running Event, the first the wiki has of
//             <Name>DragonariumIcon.png for its full name, then for its series
//             (the part before ":"), each with words title-cased and then
//             plainly squashed; saved under the key the app looks up
//             (eventIconPaths in src/lib/snapshot/images)
//
// Network etiquette: one imageinfo request per 50 files, every request
// sequential with a pause between, a descriptive User-Agent, and retries with
// backoff only on 429, 5xx and network errors. Files already on disk are
// neither resolved nor downloaded again. Static files are downloaded once and
// served from this repo; the app never hotlinks the wiki's CDN.
//
// A missing image is a warning and a null path; a missing Event icon is not
// (the app shows the generic one).

import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { IMAGES_DIR, MENU_ICONS, eventIconPaths, eventSeries, squash, type MenuIcon, type Snapshot } from '../src/lib/snapshot';
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

export type ImageKind = 'dragon' | 'element' | 'page' | 'menu' | 'event';

/** One image to have on disk. */
export type ImageTarget = {
  kind: ImageKind;
  /** The Dragon, Element, page, menu icon or Event it's for. */
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

/** Each word's first letter upper-cased, then squashed: "Om of Noms" -> "OmOfNoms". */
function titleSquash(name: string): string {
  return squash(name.replace(/(^|[^A-Za-z0-9])([a-z])/g, (_, before: string, c: string) => before + c.toUpperCase()));
}

/** One file to try for an Event's icon, and where it's saved if found. */
type EventCandidate = { file: string; path: string };

/**
 * The files to try for an Event's icon, in order: the full name title-cased,
 * then plainly squashed (saved under the full-name key), then the same for
 * the series (saved under the series key). The wiki names Event icons after
 * the series with every word capitalised ("OmOfNomsDragonariumIcon.png").
 */
function eventCandidates(eventName: string): EventCandidate[] {
  const [fullPath, seriesPath = fullPath] = eventIconPaths(eventName);
  const out: EventCandidate[] = [];
  for (const [name, path] of [
    [eventName, fullPath],
    [eventSeries(eventName), seriesPath],
  ] as const) {
    if (path === undefined) continue;
    for (const stem of [titleSquash(name), squash(name)]) {
      const file = `${stem}DragonariumIcon.png`;
      if (stem !== '' && !out.some((c) => c.file === file)) out.push({ file, path });
    }
  }
  return out;
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

/** The Events in Data:Limited.json, read tolerantly: no `events` object means none. */
export function currentEventNames(raw: RawPages): string[] {
  try {
    const events = (JSON.parse(raw.pages['Data:Limited.json'].content) as { events?: unknown }).events;
    return events && typeof events === 'object' && !Array.isArray(events) ? Object.keys(events) : [];
  } catch {
    return [];
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

type ResolvedFile = { url: string; thumbUrl: string } | null;

/**
 * Reads an imageinfo response (formatversion=2) into file name -> URLs, for
 * each requested file. The API normalizes titles (underscores, first letter)
 * and follows redirects; both are traced back to the name asked for. A file
 * the wiki doesn't have maps to null.
 */
function parseImageInfo(body: unknown, files: readonly string[]): Map<string, ResolvedFile> {
  const b = body as {
    error?: { info?: string };
    query?: { normalized?: FromTo[]; redirects?: FromTo[]; pages?: ImageInfoPage[] };
  } | null;
  if (b?.error) throw new Error(`Wiki API error: ${b.error.info ?? JSON.stringify(b.error)}`);
  const query = b?.query;
  if (!query || !Array.isArray(query.pages)) throw new Error('imageinfo response has no query.pages array');

  const normalized = new Map((query.normalized ?? []).map(({ from, to }) => [from, to]));
  const redirects = new Map((query.redirects ?? []).map(({ from, to }) => [from, to]));
  const byTitle = new Map(query.pages.map((p) => [p.title, p]));

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
  /** One line per missing target, except Event icons. */
  warnings: string[];
};

export type DownloadOptions = {
  /** Repo root; images go to <root>/public/<path>. */
  root: string;
  eventNames?: string[];
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
  const { root, eventNames = [], overrides = IMAGE_OVERRIDES, download = true, log = () => {} } = options;
  const targets = planImages(snapshot, overrides);
  const events = eventNames.map((name) => ({ name, candidates: eventCandidates(name) }));
  const local = (t: { path: string }) => join(root, 'public', t.path);

  const onDisk = new Set<string>();
  for (const t of [...targets, ...events.flatMap((e) => e.candidates)]) if (await exists(local(t))) onDisk.add(t.path);
  const hasIcon = (e: (typeof events)[number]) => e.candidates.some((c) => onDisk.has(c.path));
  const existing = targets.filter((t) => onDisk.has(t.path)).length + events.filter(hasIcon).length;
  const todo = targets.filter((t) => !onDisk.has(t.path));
  const eventsTodo = events.filter((e) => !hasIcon(e));
  const downloaded: string[] = [];
  const client = new PoliteClient(options.fetch ?? fetch, options.delayMs ?? 250, options.sleep ?? sleep);

  if (download && todo.length + eventsTodo.length > 0) {
    const files = [...new Set([...todo.map((t) => t.file), ...eventsTodo.flatMap((e) => e.candidates.map((c) => c.file))])];
    log(`Resolving ${files.length} files in ${Math.ceil(files.length / BATCH_SIZE)} imageinfo requests...`);
    const resolved = new Map<string, ResolvedFile>();
    for (const batch of batches(files)) {
      const body = await (await client.get(imageInfoUrl(batch), 'application/json')).json();
      for (const [file, r] of parseImageInfo(body, batch)) resolved.set(file, r);
    }
    const found: { file: string; path: string; crop?: CropBox }[] = todo.filter((t) => resolved.get(t.file));
    for (const e of eventsTodo) {
      const first = e.candidates.find((c) => resolved.get(c.file));
      if (first && !found.some((f) => f.path === first.path)) found.push(first);
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
    ...events
      .filter((e) => !hasIcon(e))
      .map((e) => ({ kind: 'event' as const, key: e.name, file: e.candidates.map((c) => c.file).join(' / '), path: e.candidates[0]?.path ?? '' })),
  ];
  const warnings = missing
    .filter((t) => t.kind !== 'event')
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
