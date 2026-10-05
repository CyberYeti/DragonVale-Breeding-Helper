import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MENU_ICONS, SCHEMA_VERSION, type Dragon, type Snapshot } from '../src/lib/snapshot';
import {
  IMAGE_OVERRIDES,
  applyImagePaths,
  asPng,
  batches,
  currentEventNames,
  downloadImages,
  dragonImageFile,
  elementIconFile,
  imageInfoUrl,
  pageIconFile,
  parseImageInfo,
  planImages,
  type ImageOverrides,
} from './images';
import type { RawPages } from './pages';
import { encodePng } from './png';

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

const snapshot = (dragons: string[]): Snapshot => ({
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
  pages: [{ name: 'Gemstone All', group: 'epic', dragons: [], icon: null }],
  renames: {},
});

const noOverrides: ImageOverrides = { dragons: {}, elements: {}, pages: {} };

describe('file names', () => {
  it('squashes spaces and punctuation out of Dragon names', () => {
    expect(dragonImageFile('Lava', noOverrides)).toBe('LavaDragonAdult.png');
    expect(dragonImageFile('Plant Rift', noOverrides)).toBe('PlantRiftDragonAdult.png');
    expect(dragonImageFile('Blue Fire', noOverrides)).toBe('BlueFireDragonAdult.png');
  });

  it('uses an override where the wiki breaks the convention', () => {
    expect(dragonImageFile('Kairos')).toBe('KairosAdult.png');
    expect(dragonImageFile('Monolith 3')).toBe('MonolithDragonAdult3.png');
    expect(dragonImageFile('Snowflake 7')).toBe('SnowflakeDragonAdult7.png');
    expect(dragonImageFile('Dracomancy 4')).toBe('DracomancyDragonAdult4.png');
    expect(dragonImageFile("Ts'aishen")).toBe("Ts'aishenAdult.png");
    expect(dragonImageFile('Pyros & Glacius')).toBe('Pyros&GlaciusDragonAdult.png');
    expect(dragonImageFile('Lava')).toBe('LavaDragonAdult.png');
  });

  it('names Element and page icons', () => {
    expect(elementIconFile('Fire')).toBe('Icon Fire.png');
    expect(pageIconFile('Gemstone All')).toBe('GemstoneAllDragonariumIcon.png');
    expect(pageIconFile('Om of Noms')).toBe('OmofNomsDragonariumIcon.png');
  });

  it('honours Element and page overrides', () => {
    const overrides = { ...noOverrides, elements: { Fire: 'FireIcon.png' }, pages: { Galactic: 'GalaxyDragonariumIcon.png' } };
    expect(elementIconFile('Fire', overrides)).toBe('FireIcon.png');
    expect(pageIconFile('Galactic', overrides)).toBe('GalaxyDragonariumIcon.png');
  });

  it('has overrides for the 27 Dragons off the convention', () => {
    expect(Object.keys(IMAGE_OVERRIDES.dragons)).toHaveLength(27);
  });
});

describe('planImages', () => {
  it('lists Dragons, Elements, pages, menu and Event icons under stable local paths', () => {
    const targets = planImages(snapshot(['Lava', 'Drak-E']), ['Om of Noms: Country Roads II']);
    expect(targets).toContainEqual({ kind: 'dragon', key: 'Lava', file: 'LavaDragonAdult.png', path: 'images/dragons/Lava.png' });
    expect(targets).toContainEqual({ kind: 'dragon', key: 'Drak-E', file: 'Drak-EDragonAdult.png', path: 'images/dragons/DrakE.png' });
    expect(targets).toContainEqual({ kind: 'element', key: 'Fire', file: 'Icon Fire.png', path: 'images/elements/Fire.png' });
    expect(targets).toContainEqual({
      kind: 'page',
      key: 'Gemstone All',
      file: 'GemstoneAllDragonariumIcon.png',
      path: 'images/pages/GemstoneAll.png',
    });
    expect(targets).toContainEqual({
      kind: 'event',
      key: 'Om of Noms: Country Roads II',
      file: 'OmofNomsCountryRoadsIIDragonariumIcon.png',
      path: 'images/events/OmofNomsCountryRoadsII.png',
    });
    const menu = targets.filter((t) => t.kind === 'menu');
    expect(menu.map((t) => t.path).sort()).toEqual(Object.values(MENU_ICONS).sort());
    expect(menu.find((t) => t.key === 'limited')?.crop).toBeDefined();
  });

  it('refuses two names that would share a file', () => {
    expect(() => planImages(snapshot(['Drak-E', 'DrakE']), [])).toThrow(/both be saved as images\/dragons\/DrakE.png/);
  });
});

describe('batches', () => {
  it('splits into chunks of at most 50', () => {
    const items = Array.from({ length: 121 }, (_, i) => i);
    expect(batches(items).map((b) => b.length)).toEqual([50, 50, 21]);
    expect(batches(items).flat()).toEqual(items);
    expect(batches([])).toEqual([]);
  });
});

describe('imageInfoUrl', () => {
  it('asks for URLs and a 120px thumbnail of each file', () => {
    const url = new URL(imageInfoUrl(['LavaDragonAdult.png', 'Icon Fire.png']));
    expect(url.origin + url.pathname).toBe('https://dragonvale.fandom.com/api.php');
    expect(url.searchParams.get('prop')).toBe('imageinfo');
    expect(url.searchParams.get('iiprop')).toBe('url');
    expect(url.searchParams.get('iiurlwidth')).toBe('120');
    expect(url.searchParams.get('titles')).toBe('File:LavaDragonAdult.png|File:Icon Fire.png');
  });

  it('refuses more than 50 titles', () => {
    expect(() => imageInfoUrl(Array.from({ length: 51 }, (_, i) => `${i}.png`))).toThrow();
  });
});

describe('parseImageInfo', () => {
  it('traces normalized and redirected titles back to the file asked for', () => {
    const body = {
      query: {
        normalized: [{ from: 'File:Icon Fire.png', to: 'File:Icon Fire.png' }],
        redirects: [{ from: 'File:OmofNomsDragonariumIcon.png', to: 'File:OmOfNomsDragonariumIcon.png' }],
        pages: [
          { title: 'File:Icon Fire.png', imageinfo: [{ url: 'https://x/fire', thumburl: 'https://x/fire/120' }] },
          { title: 'File:OmOfNomsDragonariumIcon.png', imageinfo: [{ url: 'https://x/om' }] },
          { title: 'File:NopeDragonAdult.png', missing: true },
        ],
      },
    };
    const out = parseImageInfo(body, ['Icon Fire.png', 'OmofNomsDragonariumIcon.png', 'NopeDragonAdult.png']);
    expect(out.get('Icon Fire.png')).toEqual({ url: 'https://x/fire', thumbUrl: 'https://x/fire/120' });
    expect(out.get('OmofNomsDragonariumIcon.png')).toEqual({ url: 'https://x/om', thumbUrl: 'https://x/om' });
    expect(out.get('NopeDragonAdult.png')).toBeNull();
  });

  it('throws on an API error', () => {
    expect(() => parseImageInfo({ error: { info: 'bad' } }, [])).toThrow(/bad/);
  });
});

describe('asPng', () => {
  it('asks the CDN for the original format', () => {
    expect(asPng('https://static.example/a.png/revision/latest/scale-to-width-down/120?cb=1')).toBe(
      'https://static.example/a.png/revision/latest/scale-to-width-down/120?cb=1&format=original',
    );
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

describe('applyImagePaths', () => {
  it('stores the path of each image on disk and null for the rest', () => {
    const s = snapshot(['Lava', 'Fire']);
    const targets = planImages(s, []);
    const out = applyImagePaths(s, targets, new Set(['images/dragons/Lava.png', 'images/elements/Fire.png']));
    expect(out.dragons.map((d) => d.image)).toEqual(['images/dragons/Lava.png', null]);
    expect(out.elements[0]!.icon).toBe('images/elements/Fire.png');
    expect(out.pages[0]!.icon).toBeNull();
  });
});

// ---- downloadImages with a fake wiki ------------------------------------------

/** A blank w x h RGBA PNG. */
const png = (w: number, h: number): Buffer =>
  encodePng({ width: w, height: h, colorType: 6, channels: 4, pixels: Buffer.alloc(w * h * 4), kept: [] });

describe('downloadImages', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dvbh-images-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  /** Knows every file except those in `absent`; serves 300x300 PNGs. */
  function fakeWiki(absent: Set<string>, statusFirst?: number) {
    const urls: string[] = [];
    let failed = false;
    const fetchFn = (async (input: string | URL) => {
      const url = String(input);
      urls.push(url);
      if (statusFirst && !failed) {
        failed = true;
        return new Response('busy', { status: statusFirst });
      }
      if (url.includes('api.php')) {
        const titles = new URL(url).searchParams.get('titles')!.split('|');
        return Response.json({
          query: {
            pages: titles.map((title) =>
              absent.has(title.slice(5))
                ? { title, missing: true }
                : { title, imageinfo: [{ url: `https://cdn/${title.slice(5)}`, thumburl: `https://cdn/${title.slice(5)}/120` }] },
            ),
          },
        });
      }
      return new Response(png(300, 300), { headers: { 'content-type': 'image/png' } });
    }) as typeof fetch;
    return { fetchFn, urls };
  }

  const options = (fetchFn: typeof fetch) => ({ root, fetch: fetchFn, sleep: async () => {}, eventNames: ['Big Event'] });

  it('downloads what the wiki has, warns about the rest, and fills in paths', async () => {
    const { fetchFn, urls } = fakeWiki(new Set(['NopeDragonAdult.png', 'BigEventDragonariumIcon.png']));
    const { snapshot: out, report } = await downloadImages(snapshot(['Lava', 'Nope']), options(fetchFn));

    expect(out.dragons.map((d) => d.image)).toEqual(['images/dragons/Lava.png', null]);
    expect(out.elements[0]!.icon).toBe('images/elements/Fire.png');
    expect(out.pages[0]!.icon).toBe('images/pages/GemstoneAll.png');
    expect(report.warnings).toEqual(['image missing: dragon Nope (File:NopeDragonAdult.png)']);
    expect(report.missing.map((t) => t.key)).toEqual(['Nope', 'Big Event']);
    // 1 imageinfo query + 9 downloads (Lava, Fire, the page, 6 menu icons)
    expect(report.requests).toBe(10);
    expect(urls.filter((u) => u.includes('api.php'))).toHaveLength(1);
    expect(urls.filter((u) => !u.includes('api.php')).every((u) => u.endsWith('format=original'))).toBe(true);
    // thumbnails for everything but the hourglass, which is cropped from the original
    expect(urls).toContain('https://cdn/LavaDragonAdult.png/120?format=original');
    expect(urls).toContain('https://cdn/LimitedTimeDragonariumHelpIcon.png?format=original');
    const hourglass = await readFile(join(root, 'public', MENU_ICONS.limited));
    expect(hourglass.readUInt32BE(16)).toBe(146);
  });

  it("doesn't resolve or download files already on disk", async () => {
    const first = fakeWiki(new Set());
    await downloadImages(snapshot(['Lava']), options(first.fetchFn));
    const second = fakeWiki(new Set());
    const { snapshot: out, report } = await downloadImages(snapshot(['Lava', 'Ember']), options(second.fetchFn));
    expect(report.downloaded).toEqual(['images/dragons/Ember.png']);
    expect(report.requests).toBe(2);
    expect(out.dragons.map((d) => d.image)).toEqual(['images/dragons/Lava.png', 'images/dragons/Ember.png']);
  });

  it('makes no requests with download off', async () => {
    await mkdir(join(root, 'public/images/dragons'), { recursive: true });
    await writeFile(join(root, 'public/images/dragons/Lava.png'), png(1, 1));
    const { fetchFn, urls } = fakeWiki(new Set());
    const { snapshot: out, report } = await downloadImages(snapshot(['Lava', 'Ember']), { ...options(fetchFn), download: false });
    expect(urls).toEqual([]);
    expect(out.dragons.map((d) => d.image)).toEqual(['images/dragons/Lava.png', null]);
    expect(report.warnings).toContain('image missing: dragon Ember (File:EmberDragonAdult.png)');
  });

  it('retries a transient error and gives up on a permanent one', async () => {
    const busy = fakeWiki(new Set(), 503);
    const { report } = await downloadImages(snapshot(['Lava']), options(busy.fetchFn));
    // 1 query + 10 downloads (Lava, Fire, the page, 6 menu icons, the Event icon) + 1 retry
    expect(report.requests).toBe(12);

    const gone = fakeWiki(new Set(), 404);
    await rm(join(root, 'public'), { recursive: true });
    await expect(downloadImages(snapshot(['Lava']), options(gone.fetchFn))).rejects.toThrow(/404/);
  });
});
