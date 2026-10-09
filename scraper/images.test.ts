// downloadImages, tested through its interface: a fake wiki behind the
// injected `fetch`, and a temporary directory as the repo root.

import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, deflateSync, inflateSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MENU_ICONS, SCHEMA_VERSION, eventIconPaths, type Dragon, type Snapshot } from '../src/lib/snapshot';
import { currentEventNames, downloadImages, type DownloadOptions, type ImageOverrides } from './images';
import type { RawPages } from './pages';

const dragon = (name: string): Dragon => ({
  name,
  wikiPage: `${name} Dragon`,
  rarity: 'Primary',
  order: 1,
  elements: ['Fire'],
  breedingElements: ['Fire'],
  isLimited: false,
  traits: { kind: 'none' },
  canBeParent: true,
  image: null,
  routes: [],
});

const snapshot = (dragons: string[], pages: string[] = ['Gemstone All']): Snapshot => ({
  meta: {
    schemaVersion: SCHEMA_VERSION,
    revision: 'r1',
    source: 'https://dragonvale.fandom.com',
    license: 'CC BY-SA 3.0',
    pageRevisions: {},
    fetchedAt: '2026-10-01T00:00:00.000Z',
  },
  elements: [{ name: 'Fire', kind: 'primary', icon: null }],
  opposites: [],
  dragons: dragons.map(dragon),
  pages: pages.map((name) => ({ name, group: 'epic', dragons: [], icon: null })),
  renames: {},
});

const noOverrides: ImageOverrides = { dragons: {}, elements: {}, pages: {} };

// ---- A fake wiki ----------------------------------------------------------------

type FakeWiki = {
  /** Files the wiki doesn't have. */
  absent?: Set<string>;
  /** Answer the very first request with this status. */
  statusFirst?: number;
  /** File -> the file it redirects to. */
  redirects?: Record<string, string>;
  /** What a file's download serves; default a blank 300x300 PNG. */
  files?: Record<string, { body: Uint8Array | string; type?: string }>;
  /** Answer every imageinfo query with this API error. */
  apiError?: string;
};

/**
 * A wiki that knows every file except `absent`. imageinfo normalizes titles
 * the way MediaWiki does (underscores to spaces, first letter upper case) and
 * follows `redirects`; a file downloads from https://cdn/<file> (original) or
 * https://cdn/<file>/120 (thumbnail).
 */
function fakeWiki({ absent = new Set(), statusFirst, redirects = {}, files = {}, apiError }: FakeWiki = {}) {
  const urls: string[] = [];
  /** The titles asked for, one list per imageinfo query. */
  const queries: string[][] = [];
  let failed = false;
  const fetchFn = (async (input: string | URL) => {
    const url = String(input);
    urls.push(url);
    if (statusFirst && !failed) {
      failed = true;
      return new Response('busy', { status: statusFirst });
    }
    if (url.includes('api.php')) {
      if (apiError) return Response.json({ error: { code: 'x', info: apiError } });
      const titles = new URL(url).searchParams.get('titles')!.split('|');
      queries.push(titles);
      const normalized: { from: string; to: string }[] = [];
      const redirected: { from: string; to: string }[] = [];
      const pages = titles.map((asked) => {
        let title = asked.replace(/_/g, ' ').replace(/^File:(.)/, (_, c: string) => `File:${c.toUpperCase()}`);
        if (title !== asked) normalized.push({ from: asked, to: title });
        const to = redirects[title.slice(5)];
        if (to) {
          redirected.push({ from: title, to: `File:${to}` });
          title = `File:${to}`;
        }
        const file = title.slice(5);
        return absent.has(file)
          ? { title, missing: true }
          : { title, imageinfo: [{ url: `https://cdn/${file}`, thumburl: `https://cdn/${file}/120` }] };
      });
      return Response.json({ query: { normalized, redirects: redirected, pages } });
    }
    const file = decodeURIComponent(new URL(url).pathname.split('/')[1]!);
    const served = files[file];
    return new Response(served?.body ?? png(300, 300), { headers: { 'content-type': served?.type ?? 'image/png' } });
  }) as typeof fetch;
  const asked = () => queries.flat().map((t) => t.slice(5));
  return { fetchFn, urls, queries, asked };
}

describe('downloadImages', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dvbh-images-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const options = (fetchFn: typeof fetch, extra: Partial<DownloadOptions> = {}): DownloadOptions => ({
    root,
    fetch: fetchFn,
    sleep: async () => {},
    eventNames: ['Big Event'],
    ...extra,
  });
  const onDisk = async (path: string) =>
    access(join(root, 'public', path)).then(
      () => true,
      () => false,
    );

  // ---- File names ---------------------------------------------------------------

  it('asks for <Name>DragonAdult.png with spaces and punctuation squashed out', async () => {
    const wiki = fakeWiki();
    await downloadImages(snapshot(['Lava', 'Plant Rift', 'Blue Fire']), options(wiki.fetchFn, { overrides: noOverrides }));
    expect(wiki.asked()).toEqual(
      expect.arrayContaining(['LavaDragonAdult.png', 'PlantRiftDragonAdult.png', 'BlueFireDragonAdult.png']),
    );
  });

  it('uses the built-in override list where the wiki breaks the convention', async () => {
    const wiki = fakeWiki();
    const names = ['Kairos', 'Monolith 3', 'Snowflake 7', 'Dracomancy 4', "Ts'aishen", 'Pyros & Glacius', 'Seasonal', 'Lava'];
    await downloadImages(snapshot(names), options(wiki.fetchFn));
    expect(wiki.asked()).toEqual(
      expect.arrayContaining([
        'KairosAdult.png',
        'MonolithDragonAdult3.png',
        'SnowflakeDragonAdult7.png',
        'DracomancyDragonAdult4.png',
        "Ts'aishenAdult.png",
        'Pyros&GlaciusDragonAdult.png',
        'SpringSeasonalDragonAdult.png',
        'LavaDragonAdult.png',
      ]),
    );
  });

  it('names Element, page and Event icons, and saves everything under stable local paths', async () => {
    const wiki = fakeWiki();
    const event = 'Om of Noms: Country Roads II';
    const { snapshot: out } = await downloadImages(
      snapshot(['Drak-E'], ['Gemstone All', 'Om of Noms']),
      options(wiki.fetchFn, { eventNames: [event] }),
    );
    expect(wiki.asked()).toEqual(
      expect.arrayContaining([
        'Drak-EDragonAdult.png',
        'Icon Fire.png',
        'GemstoneAllDragonariumIcon.png',
        'OmofNomsDragonariumIcon.png',
        'OmOfNomsCountryRoadsIIDragonariumIcon.png',
      ]),
    );
    expect(out.dragons[0]!.image).toBe('images/dragons/DrakE.png');
    expect(out.elements[0]!.icon).toBe('images/elements/Fire.png');
    expect(out.pages.map((p) => p.icon)).toEqual(['images/pages/GemstoneAll.png', 'images/pages/OmofNoms.png']);
    // The wiki has the full-name icon here, so it is saved under the full-name key.
    expect(eventIconPaths(event)[0]).toBe('images/events/omofnomscountryroadsii.png');
    for (const path of [...Object.values(MENU_ICONS), out.dragons[0]!.image!, eventIconPaths(event)[0]!]) {
      expect(await onDisk(path), path).toBe(true);
    }
  });

  // ---- Event icons ----------------------------------------------------------------

  const roads = 'Om of Noms: Country Roads II';
  const eventIconFiles = [
    'OmOfNomsCountryRoadsIIDragonariumIcon.png',
    'OmofNomsCountryRoadsIIDragonariumIcon.png',
    'OmOfNomsDragonariumIcon.png',
    'OmofNomsDragonariumIcon.png',
  ];

  it("tries an Event's full name, then its series, title-cased then plain, in one imageinfo query", async () => {
    const wiki = fakeWiki({ absent: new Set(eventIconFiles.filter((f) => f !== 'OmOfNomsDragonariumIcon.png')) });
    const { report } = await downloadImages(snapshot([]), options(wiki.fetchFn, { eventNames: [roads] }));
    expect(wiki.queries).toHaveLength(1);
    expect(wiki.asked().filter((f) => eventIconFiles.includes(f))).toEqual(eventIconFiles);
    // The series' icon, saved under the series key, which the app tries second.
    expect(wiki.urls).toContain('https://cdn/OmOfNomsDragonariumIcon.png/120?format=original');
    expect(report.downloaded).toContain('images/events/omofnoms.png');
    expect(eventIconPaths(roads)[1]).toBe('images/events/omofnoms.png');
    expect(await onDisk('images/events/omofnomscountryroadsii.png')).toBe(false);
    expect(report.missing).toEqual([]);
  });

  it('downloads a series icon once for two Events of the series, and skips it next run', async () => {
    const absent = new Set([...eventIconFiles.slice(0, 2), 'OmOfNomsBigDragonariumIcon.png', 'OmofNomsBigDragonariumIcon.png']);
    const first = fakeWiki({ absent });
    const { report } = await downloadImages(snapshot([]), options(first.fetchFn, { eventNames: [roads, 'Om of Noms: Big'] }));
    expect(report.downloaded.filter((p) => p.startsWith('images/events/'))).toEqual(['images/events/omofnoms.png']);

    const second = fakeWiki({ absent });
    await downloadImages(snapshot([]), options(second.fetchFn, { eventNames: [roads] }));
    expect(second.asked().filter((f) => eventIconFiles.includes(f))).toEqual([]);
  });

  it('reports an Event with no icon as missing, without a warning', async () => {
    const wiki = fakeWiki({ absent: new Set(eventIconFiles) });
    const { report } = await downloadImages(snapshot([]), options(wiki.fetchFn, { eventNames: [roads] }));
    expect(report.missing.map((t) => [t.kind, t.key])).toEqual([['event', roads]]);
    expect(report.warnings).toEqual([]);
  });

  it('honours Dragon, Element and page overrides passed in', async () => {
    const wiki = fakeWiki();
    const overrides: ImageOverrides = {
      dragons: { Lava: 'LavaSpecial.png' },
      elements: { Fire: 'FireIcon.png' },
      pages: { Galactic: 'GalaxyDragonariumIcon.png' },
    };
    await downloadImages(snapshot(['Lava', 'Kairos'], ['Galactic']), options(wiki.fetchFn, { overrides }));
    expect(wiki.asked()).toEqual(
      expect.arrayContaining(['LavaSpecial.png', 'FireIcon.png', 'GalaxyDragonariumIcon.png', 'KairosDragonAdult.png']),
    );
    expect(wiki.asked()).not.toContain('LavaDragonAdult.png');
  });

  it('refuses two names that would share a file', async () => {
    const wiki = fakeWiki();
    await expect(downloadImages(snapshot(['Drak-E', 'DrakE']), options(wiki.fetchFn))).rejects.toThrow(
      /both be saved as images\/dragons\/DrakE.png/,
    );
    expect(wiki.urls).toEqual([]);
  });

  // ---- imageinfo ----------------------------------------------------------------

  it('resolves files in imageinfo queries of at most 50, asking for a 120px thumbnail', async () => {
    const wiki = fakeWiki();
    const names = Array.from({ length: 121 }, (_, i) => `D${i}`);
    await downloadImages(snapshot(names), options(wiki.fetchFn));
    // 121 Dragons + 1 Element + 1 page + 6 menu icons + 1 Event icon
    expect(wiki.queries.map((q) => q.length)).toEqual([50, 50, 30]);
    expect(new Set(wiki.asked()).size).toBe(130);
    for (const url of wiki.urls.filter((u) => u.includes('api.php')).map((u) => new URL(u))) {
      expect(url.origin + url.pathname).toBe('https://dragonvale.fandom.com/api.php');
      expect(url.searchParams.get('prop')).toBe('imageinfo');
      expect(url.searchParams.get('iiprop')).toBe('url');
      expect(url.searchParams.get('iiurlwidth')).toBe('120');
    }
    // 130 fake downloads written to disk: past the 5s default when the whole suite runs at once.
  }, 30_000);

  it('traces normalized and redirected titles back to the file asked for', async () => {
    const wiki = fakeWiki({ redirects: { 'OmofNomsDragonariumIcon.png': 'OmOfNomsDragonariumIcon.png' } });
    const overrides: ImageOverrides = { ...noOverrides, elements: { Fire: 'icon_Fire.png' } };
    const { snapshot: out, report } = await downloadImages(
      snapshot(['Lava'], ['Om of Noms']),
      options(wiki.fetchFn, { overrides }),
    );
    expect(wiki.asked()).toContain('icon_Fire.png');
    expect(out.elements[0]!.icon).toBe('images/elements/Fire.png');
    expect(out.pages[0]!.icon).toBe('images/pages/OmofNoms.png');
    expect(wiki.urls).toContain('https://cdn/OmOfNomsDragonariumIcon.png/120?format=original');
    expect(report.warnings).toEqual([]);
  });

  it('fails on an API error', async () => {
    const wiki = fakeWiki({ apiError: 'bad titles' });
    await expect(downloadImages(snapshot(['Lava']), options(wiki.fetchFn))).rejects.toThrow(/bad titles/);
  });

  // ---- Downloading --------------------------------------------------------------

  it('downloads what the wiki has, warns about the rest, and fills in paths', async () => {
    const { fetchFn, urls } = fakeWiki({ absent: new Set(['NopeDragonAdult.png', 'BigEventDragonariumIcon.png']) });
    const { snapshot: out, report } = await downloadImages(snapshot(['Lava', 'Nope']), options(fetchFn));

    expect(out.dragons.map((d) => d.image)).toEqual(['images/dragons/Lava.png', null]);
    expect(out.elements[0]!.icon).toBe('images/elements/Fire.png');
    expect(out.pages[0]!.icon).toBe('images/pages/GemstoneAll.png');
    expect(report.warnings).toEqual(['image missing: dragon Nope (File:NopeDragonAdult.png)']);
    expect(report.missing.map((t) => t.key)).toEqual(['Nope', 'Big Event']);
    // 1 imageinfo query + 9 downloads (Lava, Fire, the page, 6 menu icons)
    expect(report.requests).toBe(10);
    expect(urls.filter((u) => u.includes('api.php'))).toHaveLength(1);
    // The CDN serves WebP unless asked for the original format.
    expect(urls.filter((u) => !u.includes('api.php')).every((u) => u.endsWith('format=original'))).toBe(true);
    // Thumbnails for everything but the hourglass, which is cropped from the original.
    expect(urls).toContain('https://cdn/LavaDragonAdult.png/120?format=original');
    expect(urls).toContain('https://cdn/LimitedTimeDragonariumHelpIcon.png?format=original');
  });

  it("doesn't resolve or download files already on disk", async () => {
    const first = fakeWiki();
    await downloadImages(snapshot(['Lava']), options(first.fetchFn));
    const second = fakeWiki();
    const { snapshot: out, report } = await downloadImages(snapshot(['Lava', 'Ember']), options(second.fetchFn));
    expect(report.downloaded).toEqual(['images/dragons/Ember.png']);
    expect(report.requests).toBe(2);
    expect(out.dragons.map((d) => d.image)).toEqual(['images/dragons/Lava.png', 'images/dragons/Ember.png']);
  });

  it('makes no requests with download off', async () => {
    await mkdir(join(root, 'public/images/dragons'), { recursive: true });
    await writeFile(join(root, 'public/images/dragons/Lava.png'), png(1, 1));
    const { fetchFn, urls } = fakeWiki();
    const { snapshot: out, report } = await downloadImages(snapshot(['Lava', 'Ember']), options(fetchFn, { download: false }));
    expect(urls).toEqual([]);
    expect(out.dragons.map((d) => d.image)).toEqual(['images/dragons/Lava.png', null]);
    expect(out.elements[0]!.icon).toBeNull();
    expect(report.warnings).toContain('image missing: dragon Ember (File:EmberDragonAdult.png)');
  });

  it('retries a transient error and gives up on a permanent one', async () => {
    const busy = fakeWiki({ statusFirst: 503 });
    const { report } = await downloadImages(snapshot(['Lava']), options(busy.fetchFn));
    // 1 query + 10 downloads (Lava, Fire, the page, 6 menu icons, the Event icon) + 1 retry
    expect(report.requests).toBe(12);

    const gone = fakeWiki({ statusFirst: 404 });
    await rm(join(root, 'public'), { recursive: true });
    await expect(downloadImages(snapshot(['Lava']), options(gone.fetchFn))).rejects.toThrow(/404/);
  });

  // ---- PNG checks and the hourglass crop -----------------------------------------

  const HOURGLASS = 'LimitedTimeDragonariumHelpIcon.png';

  it('refuses a download that is not a PNG', async () => {
    const wiki = fakeWiki({ files: { 'LavaDragonAdult.png': { body: 'RIFF....WEBP', type: 'image/webp' } } });
    await expect(downloadImages(snapshot(['Lava']), options(wiki.fetchFn))).rejects.toThrow(
      /LavaDragonAdult.png didn't come back as a PNG \(image\/webp\)/,
    );
  });

  it('cuts the hourglass out of the original, undoing every row filter', async () => {
    // RGB, pixel (x, y) = [x, y, x ^ y] (mod 256); rows cycle through the five filters.
    const pixel = (x: number, y: number, c: number) => [x, y, x ^ y][c]! & 0xff;
    const original = testPng({ width: 300, height: 300, channels: 3, pixel, filterFor: (row) => row % 5 });
    const wiki = fakeWiki({ files: { [HOURGLASS]: { body: original } } });
    await downloadImages(snapshot(['Lava']), options(wiki.fetchFn));

    const cut = readTestPng(await readFile(join(root, 'public', MENU_ICONS.limited)));
    expect([cut.width, cut.height, cut.colorType]).toEqual([146, 146, 2]);
    for (const [x, y] of [
      [0, 0],
      [145, 0],
      [0, 145],
      [145, 145],
      [70, 33],
    ] as const) {
      expect(cut.at(x, y), `(${x}, ${y})`).toEqual([0, 1, 2].map((c) => pixel(84 + x, 84 + y, c)));
    }
  });

  it('keeps the palette of a palette PNG it crops', async () => {
    const palette = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255]);
    const original = testPng({ width: 300, height: 300, channels: 1, colorType: 3, palette, pixel: (x) => x % 3 });
    const wiki = fakeWiki({ files: { [HOURGLASS]: { body: original } } });
    await downloadImages(snapshot(['Lava']), options(wiki.fetchFn));

    const cut = readTestPng(await readFile(join(root, 'public', MENU_ICONS.limited)));
    expect(cut.colorType).toBe(3);
    expect(cut.chunks.get('PLTE')).toEqual(palette);
    expect(cut.at(0, 0)).toEqual([84 % 3]);
  });

  it('refuses a hourglass file too small for the crop box', async () => {
    const wiki = fakeWiki({ files: { [HOURGLASS]: { body: png(100, 100) } } });
    await expect(downloadImages(snapshot(['Lava']), options(wiki.fetchFn))).rejects.toThrow(/doesn't fit a 100x100 image/);
  });

  it('refuses a PNG it cannot crop (16-bit)', async () => {
    const wiki = fakeWiki({ files: { [HOURGLASS]: { body: testPng({ width: 300, height: 300, channels: 3, bitDepth: 16 }) } } });
    await expect(downloadImages(snapshot(['Lava']), options(wiki.fetchFn))).rejects.toThrow(/Only 8-bit/);
  });
});

describe('currentEventNames', () => {
  const raw = (content: string) => ({ pages: { 'Data:Limited.json': { revision: 1, content } } }) as unknown as RawPages;
  it('reads the Event names', () => {
    expect(currentEventNames(raw('{"events": {"A: B": {}, "C": {}}}'))).toEqual(['A: B', 'C']);
  });
  it('treats a missing or broken events object as none', () => {
    expect(currentEventNames(raw('{"dragons": {}}'))).toEqual([]);
    expect(currentEventNames(raw('not json'))).toEqual([]);
  });
});

// ---- A test-side PNG writer and reader --------------------------------------------

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const COLOR_TYPES: Record<number, number> = { 1: 0, 2: 4, 3: 2, 4: 6 };

function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

/** A PNG whose rows are written with `filterFor(row)` (0 None, 1 Sub, 2 Up, 3 Average, 4 Paeth). */
function testPng({
  width,
  height,
  channels,
  colorType = COLOR_TYPES[channels]!,
  bitDepth = 8,
  palette,
  pixel = () => 0,
  filterFor = () => 0,
}: {
  width: number;
  height: number;
  channels: number;
  colorType?: number;
  bitDepth?: number;
  palette?: Buffer;
  pixel?: (x: number, y: number, channel: number) => number;
  filterFor?: (row: number) => number;
}): Buffer {
  const bpp = channels * (bitDepth / 8);
  const stride = width * bpp;
  const raw = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      for (let c = 0; c < channels; c++) raw[y * stride + x * bpp + c * (bitDepth / 8)] = pixel(x, y, c);

  const rows = Buffer.alloc(height * (1 + stride));
  for (let y = 0; y < height; y++) {
    const type = filterFor(y);
    rows[y * (1 + stride)] = type;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? raw[y * stride + i - bpp]! : 0;
      const b = y > 0 ? raw[(y - 1) * stride + i]! : 0;
      const c = y > 0 && i >= bpp ? raw[(y - 1) * stride + i - bpp]! : 0;
      const p = a + b - c;
      const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const predictor = [0, a, b, (a + b) >> 1, paeth][type]!;
      rows[y * (1 + stride) + 1 + i] = (raw[y * stride + i]! - predictor) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    ...(palette ? [chunk('PLTE', palette)] : []),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A blank w x h RGBA PNG. */
const png = (w: number, h: number): Buffer => testPng({ width: w, height: h, channels: 4 });

/** Reads an 8-bit PNG written with filter None on every row (what the scraper writes). */
function readTestPng(data: Buffer) {
  expect(data.subarray(0, 8).equals(SIGNATURE)).toBe(true);
  const chunks = new Map<string, Buffer>();
  const idat: Buffer[] = [];
  for (let at = 8; at + 8 <= data.length; ) {
    const length = data.readUInt32BE(at);
    const type = data.toString('latin1', at + 4, at + 8);
    const body = data.subarray(at + 8, at + 8 + length);
    expect(data.readUInt32BE(at + 8 + length), `${type} CRC`).toBe(crc32(data.subarray(at + 4, at + 8 + length)));
    if (type === 'IDAT') idat.push(body);
    else chunks.set(type, body);
    at += 12 + length;
  }
  const ihdr = chunks.get('IHDR')!;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const colorType = ihdr[9]!;
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType]!;
  const rows = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  for (let y = 0; y < height; y++) expect(rows[y * (1 + stride)]).toBe(0);
  const at = (x: number, y: number) => [...rows.subarray(y * (1 + stride) + 1 + x * channels, y * (1 + stride) + 1 + (x + 1) * channels)];
  return { width, height, colorType, chunks, at };
}
