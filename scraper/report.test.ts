import { describe, expect, it } from 'vitest';
import type { BuildReport } from './build';
import type { ImageReport } from './images';
import { needsReview, refreshReportMarkdown } from './report';

const build = (over: Partial<BuildReport> = {}): BuildReport => ({
  added: [],
  removed: [],
  renameCandidates: [],
  warnings: [],
  counts: {
    dragons: 1,
    pages: { elemental: 0, epic: 0, special: 0 },
    traits: { all: 0, fixed: 0, none: 0 },
    gemstoneAndCrystalline: 0,
    cannotBeParent: 0,
    limited: 0,
    routes: { bred: 0, coop: 0, evolved: 0, summoned: 0, purchased: 0 },
  },
  ...over,
});

const images = (over: Partial<ImageReport> = {}): ImageReport => ({
  requests: 0,
  existing: 0,
  downloaded: [],
  missing: [],
  warnings: [],
  ...over,
});

describe('refreshReportMarkdown', () => {
  it('lists the changed pages, added and removed Dragons and the downloads', () => {
    const md = refreshReportMarkdown({
      changed: ['Data:Limited.json', 'Data:Dragons.json'],
      build: build({ added: ['Sunflare', 'Moonpetal'], removed: ['Old'] }),
      images: images({ downloaded: ['images/dragons/Sunflare.png'] }),
    });
    expect(md).toContain('Wiki pages changed: Data:Limited.json, Data:Dragons.json');
    expect(md).toContain('- Added Dragons (2): Sunflare, Moonpetal');
    expect(md).toContain('- Removed Dragons (1): Old');
    expect(md).toContain('- Images downloaded: 1');
    expect(md).not.toContain('Rename candidates');
    expect(md).not.toContain('Still missing');
  });

  it('flags unapplied rename candidates, missing images and warnings', () => {
    const md = refreshReportMarkdown({
      changed: ['Data:Dragons.json'],
      build: build({ renameCandidates: [{ from: 'Old', to: 'New', reason: 'same-order' }], warnings: ['odd record'] }),
      images: images({
        missing: [
          { kind: 'currency', key: 'Ring', file: 'RingFilterOn.png', path: 'images/currencies/ring.png' },
          { kind: 'dragon', key: 'Sunflare', file: 'Sunflare Dragon.png', path: 'images/dragons/Sunflare.png' },
        ],
      }),
    });
    expect(md).toContain('Rename candidates (not applied)');
    expect(md).toContain('- Old → New (same-order)');
    expect(md).toContain('- Currency icon for Ring (File:RingFilterOn.png)');
    expect(md).toContain('- dragon image for Sunflare (File:Sunflare Dragon.png)');
    expect(md).toContain('- odd record');
  });
});

describe('needsReview', () => {
  it('is false when Dragons were only added', () => {
    expect(needsReview(build({ added: ['Sunflare'] }))).toBe(false);
  });

  it('is true when any Dragon was removed, since it may be a rename', () => {
    expect(needsReview(build({ removed: ['Old'] }))).toBe(true);
  });
});
