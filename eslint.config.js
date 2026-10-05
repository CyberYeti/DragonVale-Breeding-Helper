// @ts-check
import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import svelteConfig from './svelte.config.js';

/*
 * Layer rules (issue #19). Imports are matched by path segment, so they work
 * for relative imports (`../world`, `../../ui/App.svelte`) as well as bare ones.
 *
 *   src/lib/snapshot/  imports nothing app-side
 *   src/lib/core/      imports snapshot, lower core modules and dagre; never
 *                      Svelte, @xyflow, src/ui or scraper; no fetch/localStorage
 *   src/ui/            imports core and snapshot
 *   scraper/           imports snapshot only
 *
 * A core module is either `src/lib/core/<name>.ts` or a folder
 * `src/lib/core/<name>/`. Inside a core module, don't name a file after
 * another core module: `./tile` from inside core/graph/ would read as an
 * import of core/tile.
 */

/** @param {string[]} names @param {string} message */
const banSegments = (names, message) => ({
  regex: `(^|/)(${names.join('|')})(\\.[jt]s)?(/|$)`,
  caseSensitive: true,
  message,
});

const svelteBan = {
  regex: '^svelte(/|$)|\\.svelte(\\.[jt]s)?$',
  caseSensitive: true,
  message: 'Only src/ui may use Svelte.',
};
const xyflowBan = {
  regex: '^@xyflow/',
  caseSensitive: true,
  message: 'Only src/ui/graph may use Svelte Flow.',
};
const dagreBan = {
  regex: '^@dagrejs/',
  caseSensitive: true,
  message: 'Only core/layout may use dagre.',
};

/**
 * Core module graph, bottom to top. Each module may import modules listed
 * in `below` (and snapshot); everything else in core is off limits.
 * `testing` holds test builders; only *.test.ts files may import it.
 * @type {Record<string, string[]>}
 */
const coreBelow = {
  limited: [],
  collection: [],
  world: ['limited', 'collection'],
  breeding: ['world', 'limited', 'collection'],
  layout: [],
  tile: ['breeding', 'world', 'limited', 'collection'],
  menu: ['breeding', 'world', 'limited', 'collection'],
  panel: ['breeding', 'world', 'limited', 'collection'],
  graph: ['layout', 'breeding', 'world', 'limited', 'collection'],
};
const coreModules = [...Object.keys(coreBelow), 'testing'];

const coreLayerBans = [
  svelteBan,
  xyflowBan,
  banSegments(['ui'], 'core must not import src/ui.'),
  banSegments(['scraper'], 'core must not import the scraper.'),
];

/** @param {string} name */
const coreFiles = (name) => [`src/lib/core/${name}.ts`, `src/lib/core/${name}/**/*.ts`];

/** @param {object[]} patterns */
const restrict = (patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

const coreModuleConfigs = Object.entries(coreBelow).map(([name, below]) => {
  const banned = coreModules.filter((m) => m !== name && !below.includes(m));
  return {
    name: `layers/core/${name}`,
    files: coreFiles(name),
    ignores: ['**/*.test.ts'],
    rules: restrict([
      ...coreLayerBans,
      ...(name === 'layout' ? [] : [dagreBan]),
      banSegments(banned, `core/${name} may only import: ${below.join(', ') || 'no other core module'} (and snapshot).`),
    ]),
  };
});

export default defineConfig(
  { ignores: ['dist/', 'node_modules/', 'public/', 'fixtures/'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
        svelteConfig,
      },
    },
  },
  {
    files: ['scraper/**/*.ts', 'tests/**/*.ts', '*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },

  // ---- Layers -------------------------------------------------------------
  {
    name: 'layers/snapshot',
    files: ['src/lib/snapshot/**/*.ts'],
    rules: restrict([
      svelteBan,
      xyflowBan,
      dagreBan,
      banSegments(['core', 'ui', 'scraper'], 'snapshot imports nothing app-side.'),
    ]),
  },
  {
    name: 'layers/core',
    files: ['src/lib/core/**/*.ts'],
    rules: {
      ...restrict([...coreLayerBans, dagreBan]),
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'core is pure: fetch in src/ui and pass the data in.' },
        { name: 'localStorage', message: 'core is pure: storage lives in src/ui/store.' },
        { name: 'sessionStorage', message: 'core is pure: storage lives in src/ui/store.' },
      ],
      'no-restricted-properties': [
        'error',
        ...['window', 'globalThis', 'self'].flatMap((object) =>
          ['fetch', 'localStorage', 'sessionStorage'].map((property) => ({
            object,
            property,
            message: 'core is pure: no network or storage access.',
          })),
        ),
      ],
    },
  },
  ...coreModuleConfigs,
  {
    name: 'layers/core/testing',
    files: coreFiles('testing'),
    rules: restrict(coreLayerBans),
  },
  {
    name: 'layers/core/tests',
    files: ['src/lib/core/**/*.test.ts'],
    rules: restrict(coreLayerBans),
  },
  {
    name: 'layers/ui',
    files: ['src/ui/**/*.{ts,svelte}', 'src/main.ts'],
    rules: restrict([banSegments(['scraper'], 'The app must not import the scraper.')]),
  },
  {
    name: 'layers/scraper',
    files: ['scraper/**/*.ts'],
    rules: restrict([
      svelteBan,
      xyflowBan,
      dagreBan,
      banSegments(['core', 'ui'], 'scraper imports only src/lib/snapshot.'),
    ]),
  },
);
