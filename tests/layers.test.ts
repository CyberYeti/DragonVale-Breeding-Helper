// Checks the layer rules in eslint.config.js by linting small snippets as if
// they lived at a given path. The files don't need to exist.
import { ESLint } from 'eslint';
import { describe, expect, it, vi } from 'vitest';

// Spinning up ESLint is slow on a cold start; the 5s default isn't enough.
vi.setConfig({ testTimeout: 30_000 });

const eslint = new ESLint();

async function layerErrors(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? [])
    .filter((m) =>
      ['no-restricted-imports', 'no-restricted-globals', 'no-restricted-properties'].includes(
        m.ruleId ?? '',
      ),
    )
    .map((m) => m.message);
}

const blocked = async (filePath: string, code: string) =>
  expect(await layerErrors(filePath, code)).not.toEqual([]);
const allowed = async (filePath: string, code: string) =>
  expect(await layerErrors(filePath, code)).toEqual([]);

describe('core layer', () => {
  it('blocks Svelte, Svelte Flow, src/ui and the scraper', async () => {
    await blocked('src/lib/core/world.ts', "import { mount } from 'svelte';\nmount;");
    await blocked('src/lib/core/world.ts', "import { writable } from 'svelte/store';\nwritable;");
    await blocked('src/lib/core/world.ts', "import x from '../../ui/App.svelte';\nx;");
    await blocked('src/lib/core/world/index.ts', "import x from '../../../ui/store.svelte';\nx;");
    await blocked('src/lib/core/graph.ts', "import { SvelteFlow } from '@xyflow/svelte';\nSvelteFlow;");
    await blocked('src/lib/core/world.ts', "import x from '../../../scraper/cli';\nx;");
  });

  it('blocks fetch and localStorage', async () => {
    await blocked('src/lib/core/limited.ts', "fetch('x');");
    await blocked('src/lib/core/limited.ts', "window.fetch('x');");
    await blocked('src/lib/core/collection.ts', "localStorage.getItem('x');");
    await blocked('src/lib/core/collection.ts', "globalThis.localStorage.getItem('x');");
  });

  it('allows snapshot and lower core modules', async () => {
    await allowed('src/lib/core/world.ts', "import x from '../snapshot';\nimport y from './limited';\nimport z from './collection';\nx; y; z;");
    await allowed('src/lib/core/breeding/index.ts', "import x from '../world';\nx;");
    await allowed('src/lib/core/graph.ts', "import x from './layout';\nimport y from './breeding';\nx; y;");
    await allowed('src/lib/core/layout.ts', "import dagre from '@dagrejs/dagre';\ndagre;");
  });

  it('blocks imports up or across the module graph', async () => {
    await blocked('src/lib/core/world.ts', "import x from './breeding';\nx;");
    await blocked('src/lib/core/limited.ts', "import x from './collection';\nx;");
    await blocked('src/lib/core/breeding/index.ts', "import x from '../tile';\nx;");
    await blocked('src/lib/core/tile.ts', "import x from './menu';\nx;");
    await blocked('src/lib/core/layout.ts', "import x from './graph';\nx;");
    await blocked('src/lib/core/world.ts', "import x from './testing/fixtures';\nx;");
    await blocked('src/lib/core/world.ts', "import dagre from '@dagrejs/dagre';\ndagre;");
  });

  it('lets tests use the test builders', async () => {
    await allowed('src/lib/core/world.test.ts', "import x from './testing/fixtures';\nimport y from './world';\nx; y;");
  });
});

describe('snapshot layer', () => {
  it('imports nothing app-side', async () => {
    await blocked('src/lib/snapshot/index.ts', "import x from '../core/world';\nx;");
    await blocked('src/lib/snapshot/index.ts', "import x from '../../ui/App.svelte';\nx;");
  });
});

describe('scraper layer', () => {
  it('imports only snapshot', async () => {
    await blocked('scraper/build.ts', "import x from '../src/lib/core/world';\nx;");
    await blocked('scraper/build.ts', "import x from '../src/ui/store.svelte';\nx;");
    await allowed('scraper/build.ts', "import x from '../src/lib/snapshot';\nx;");
  });
});

describe('ui layer', () => {
  it('may import core and snapshot but not the scraper', async () => {
    await allowed('src/ui/store.ts', "import x from '../lib/core/world';\nimport y from '../lib/snapshot';\nx; y;");
    await blocked('src/ui/store.ts', "import x from '../../scraper/cli';\nx;");
  });

  it('keeps Svelte Flow inside src/ui/graph', async () => {
    await blocked('src/ui/nav.svelte.ts', "import { MarkerType } from '@xyflow/svelte';\nMarkerType;");
    await blocked('src/ui/menu/thing.ts', "import { MarkerType } from '@xyflow/svelte';\nMarkerType;");
    await allowed('src/ui/graph/flow.ts', "import { MarkerType } from '@xyflow/svelte';\nMarkerType;");
  });
});
