// Entry point for `npm run snapshot`.
//
//   npm run snapshot -- --fetch-only   fetch the raw pages (one request) and write them
//   npm run snapshot -- --offline      read the committed raw pages, no network
//   add --fixture to (re)cut fixtures/real-records.json from the pages read
//
// Building the snapshot from the pages comes in later tickets.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { fetchPages, writeRawPages, PAGE_TITLES, RAW_DIR, type RawPages } from './pages';
import { cutRealRecords, REAL_RECORDS_FILE } from './fixture';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = join(root, RAW_DIR);

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

  if (!fetchOnly) console.log('Building the snapshot is not implemented yet.');
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
