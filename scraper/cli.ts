// Entry point for `npm run snapshot`.
//
//   npm run snapshot -- --fetch-only   fetch the raw pages (one request) and write them
//   npm run snapshot -- --offline      read the committed raw pages, no network
//   add --fixture to (re)cut fixtures/real-records.json from the pages read
//
// The snapshot is built and its report printed; writing public/data/snapshot.json
// comes with Routes, renames and images (#26-#28).

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { loadSnapshot, type Snapshot } from '../src/lib/snapshot';
import { buildSnapshot, type BuildReport } from './build';
import { fetchPages, writeRawPages, PAGE_TITLES, RAW_DIR, type RawPages } from './pages';
import { cutRealRecords, REAL_RECORDS_FILE } from './fixture';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = join(root, RAW_DIR);
const SNAPSHOT_FILE = 'public/data/snapshot.json';

async function main(args: string[]): Promise<void> {
  const offline = args.includes('--offline');
  const fetchOnly = args.includes('--fetch-only');
  const fixture = args.includes('--fixture');
  if (offline && fetchOnly) throw new Error('--offline and --fetch-only exclude each other');

  let raw: RawPages;
  if (offline) {
    raw = await fetchPages({ kind: 'offline', dir: rawDir });
    console.log(`Read the committed raw pages from ${RAW_DIR} (fetched ${raw.fetchedAt}).`);
  } else {
    console.log('Fetching the Data: pages from the wiki (one request)...');
    raw = await fetchPages({ kind: 'live' });
    await writeRawPages(rawDir, raw);
    console.log(`Wrote the raw pages to ${RAW_DIR}.`);
  }
  for (const title of PAGE_TITLES) {
    const page = raw.pages[title];
    console.log(`  ${title.padEnd(26)} rev ${page.revision}  ${page.content.length} chars`);
  }

  if (fixture) {
    const records = cutRealRecords(raw);
    await writeFile(join(root, REAL_RECORDS_FILE), JSON.stringify(records, null, 2) + '\n', 'utf8');
    console.log(`Wrote ${REAL_RECORDS_FILE}.`);
  }

  if (fetchOnly) return;
  const { report } = buildSnapshot(raw, await readPrevious());
  printReport(report);
  console.log('Writing the snapshot is not implemented yet.');
}

/** The committed snapshot, if there is one: renames carry over from it. */
async function readPrevious(): Promise<Snapshot | null> {
  let text: string;
  try {
    text = await readFile(join(root, SNAPSHOT_FILE), 'utf8');
  } catch {
    return null;
  }
  return loadSnapshot(JSON.parse(text));
}

function printReport({ counts, warnings }: BuildReport): void {
  const { pages, traits } = counts;
  console.log(`Built the snapshot: ${counts.dragons} Dragons, ${counts.limited} limited.`);
  console.log(`  pages: ${pages.elemental} Elemental, ${pages.epic} Epic, ${pages.special} Special`);
  console.log(`  traits: ${traits.all} all, ${traits.fixed} fixed, ${traits.none} none`);
  console.log(`  never parents: ${counts.cannotBeParent} (Gemstone + Crystalline: ${counts.gemstoneAndCrystalline})`);
  if (warnings.length === 0) console.log('No warnings.');
  for (const warning of warnings) console.log(`warning: ${warning}`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
