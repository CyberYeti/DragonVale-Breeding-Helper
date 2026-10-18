import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  changedPages,
  fetchPages,
  fetchRevisions,
  PAGE_TITLES,
  readManifestRevisions,
  writeRawPages,
} from './pages';

function apiBody(titles: readonly string[] = PAGE_TITLES) {
  return {
    batchcomplete: true,
    query: {
      pages: titles.map((title, i) => ({
        pageid: i + 1,
        ns: 112,
        title,
        revisions: [{ revid: 1000 + i, parentid: 999, slots: { main: { contentmodel: 'json', content: `{"page":${i}}` } } }],
      })),
    },
  };
}

function stubFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe('fetchPages, live', () => {
  it('makes one request for all five pages, with a descriptive User-Agent', async () => {
    const fetchFn = stubFetch(apiBody());
    await fetchPages({ kind: 'live', fetch: fetchFn });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const params = new URL(url).searchParams;
    expect(url.startsWith('https://dragonvale.fandom.com/api.php?')).toBe(true);
    expect(params.get('action')).toBe('query');
    expect(params.get('prop')).toBe('revisions');
    expect(params.get('rvprop')).toBe('content|ids');
    expect(params.get('rvslots')).toBe('main');
    expect(params.get('titles')?.split('|')).toEqual([
      'Data:Dragons.json',
      'Data:BreedingHints.json',
      'Data:Game.json',
      'Data:Dragonarium.json',
      'Data:Limited.json',
    ]);
    const headers = init.headers as Record<string, string>;
    expect(headers['User-Agent']).toMatch(/^DragonValeBreedingHelper\/\S+ \(https:\/\/github\.com\/.+\)$/);
    expect(headers['Api-User-Agent']).toBe(headers['User-Agent']);
  });

  it('returns each page text and revision ID, with the fetch time', async () => {
    const raw = await fetchPages({
      kind: 'live',
      fetch: stubFetch(apiBody()),
      now: () => new Date('2026-10-05T12:00:00Z'),
    });
    expect(raw.source).toBe('https://dragonvale.fandom.com');
    expect(raw.fetchedAt).toBe('2026-10-05T12:00:00.000Z');
    expect(raw.pages['Data:Game.json']).toEqual({ revision: 1002, content: '{"page":2}' });
    expect(raw.pages['Data:Limited.json'].revision).toBe(1004);
  });

  it('fails when a page is missing', async () => {
    const body = apiBody(PAGE_TITLES.slice(0, 4));
    body.query.pages.push({ title: 'Data:Limited.json', missing: true } as never);
    await expect(fetchPages({ kind: 'live', fetch: stubFetch(body) })).rejects.toThrow(/Data:Limited.json is missing/);
  });

  it('fails when a page is absent from the response', async () => {
    const body = apiBody(PAGE_TITLES.slice(0, 4));
    await expect(fetchPages({ kind: 'live', fetch: stubFetch(body) })).rejects.toThrow(/lacks Data:Limited.json/);
  });

  it('fails on an HTTP error or an API error', async () => {
    await expect(fetchPages({ kind: 'live', fetch: stubFetch({}, 503) })).rejects.toThrow(/503/);
    await expect(
      fetchPages({ kind: 'live', fetch: stubFetch({ error: { code: 'x', info: 'bad titles' } }) }),
    ).rejects.toThrow(/bad titles/);
  });
});

describe('fetchPages, offline', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads back what writeRawPages wrote', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'raw-pages-'));
    try {
      const raw = await fetchPages({ kind: 'live', fetch: stubFetch(apiBody()), now: () => new Date(0) });
      await writeRawPages(dir, raw);
      expect(await fetchPages({ kind: 'offline', dir })).toEqual(raw);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('the revision check', () => {
  it('fetchRevisions asks for revision IDs only, in one request', async () => {
    const fetchFn = stubFetch(apiBody());
    expect(await fetchRevisions(fetchFn)).toEqual({
      'Data:Dragons.json': 1000,
      'Data:BreedingHints.json': 1001,
      'Data:Game.json': 1002,
      'Data:Dragonarium.json': 1003,
      'Data:Limited.json': 1004,
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url] = fetchFn.mock.calls[0] as unknown as [string];
    const params = new URL(url).searchParams;
    expect(params.get('rvprop')).toBe('ids');
    expect(params.has('rvslots')).toBe(false);
    expect(params.get('titles')?.split('|')).toEqual(PAGE_TITLES);
  });

  it('fetchRevisions fails on a missing page or revision ID', async () => {
    const body = apiBody(PAGE_TITLES.slice(0, 4));
    await expect(fetchRevisions(stubFetch(body))).rejects.toThrow(/Data:Limited.json/);
    body.query.pages.push({ title: 'Data:Limited.json', missing: true } as never);
    await expect(fetchRevisions(stubFetch(body))).rejects.toThrow(/Data:Limited.json is missing/);
  });

  it('changedPages lists the pages whose revision differs or is unknown', async () => {
    const current = await fetchRevisions(stubFetch(apiBody()));
    expect(changedPages(current, { ...current })).toEqual([]);
    expect(changedPages(current, { ...current, 'Data:Limited.json': 1 })).toEqual(['Data:Limited.json']);
    const noGame = Object.fromEntries(Object.entries(current).filter(([title]) => title !== 'Data:Game.json'));
    expect(changedPages(current, noGame)).toEqual(['Data:Game.json']);
  });

  it('readManifestRevisions reads back the revisions writeRawPages wrote', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'raw-pages-'));
    try {
      const raw = await fetchPages({ kind: 'live', fetch: stubFetch(apiBody()), now: () => new Date(0) });
      await writeRawPages(dir, raw);
      expect(await readManifestRevisions(join(dir, 'pages.json'))).toEqual(await fetchRevisions(stubFetch(apiBody())));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
