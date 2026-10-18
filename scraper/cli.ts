// Entry point for `npm run snapshot`.
//
//   npm run snapshot -- --fetch-only   fetch the raw pages (one request) and write them
//   npm run snapshot -- --offline      read the committed raw pages, no network
//   add --fixture to (re)cut fixtures/real-records.json from the pages read
//       (by hand only: the refresh leaves that frozen sample alone)
//   add --no-download to use only the images already under public/images/
//   add --ci to never prompt: rename candidates are left unapplied and listed
//   (with --ci, a run that removed a Dragon leaves snapshot.json unchanged)
//   add --report <file> to write the run's Markdown report (the refresh PR's body)
//       and, under $GITHUB_OUTPUT, needs_review=true|false: true when a Dragon
//       was removed (a possible rename), so a person must look before it ships
//
//   npm run snapshot -- --check [--baseline <pages.json>]...
//       one small request for the pages' revision IDs. "Changed" unless they
//       match the committed public/data/raw/pages.json or a --baseline one
//       (the open refresh PR's), so an unchanged wiki is never scraped again.
//       Prints the result and writes changed=true|false to $GITHUB_OUTPUT.
//
// The snapshot is built against the committed public/data/snapshot.json (if
// any), the person running it confirms or rejects each rename candidate, the
// images not yet under public/images/ are downloaded (--offline applies to the
// pages only), and the snapshot is written to public/data/snapshot.json with
// its report printed.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { SCHEMA_VERSION, isRecord, loadSnapshot, type Snapshot } from '../src/lib/snapshot';
import { buildSnapshot, type BuildReport } from './build';
import { applyRenames, confirmRenames, type AskRename, type RenameCandidate } from './renames';
import {
  changedPages,
  fetchPages,
  fetchRevisions,
  readManifestRevisions,
  writeRawPages,
  PAGE_TITLES,
  RAW_DIR,
  type PageTitle,
  type RawPages,
} from './pages';
import { cutRealRecords, REAL_RECORDS_FILE } from './fixture';
import { downloadImages, eventCurrencies, type ImageReport } from './images';
import { needsReview, refreshReportMarkdown } from './report';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = join(root, RAW_DIR);
const SNAPSHOT_FILE = 'public/data/snapshot.json';
const MANIFEST_FILE = join(rawDir, 'pages.json');

async function main(args: string[]): Promise<void> {
  if (args.includes('--check')) return check(valuesOf(args, '--baseline'));

  const offline = args.includes('--offline');
  const fetchOnly = args.includes('--fetch-only');
  const fixture = args.includes('--fixture');
  const download = !args.includes('--no-download');
  const ci = args.includes('--ci');
  const reportFile = valuesOf(args, '--report').at(-1);
  if (offline && fetchOnly) throw new Error('--offline and --fetch-only exclude each other');

  const committed = await readManifestRevisions(MANIFEST_FILE).catch(() => ({}));
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
  const built = buildSnapshot(raw, await readPrevious());
  const { report } = built;
  printReport(report);

  let snapshot = built.snapshot;
  if (report.renameCandidates.length > 0 && ci) {
    console.log('--ci: rename candidates left unapplied (listed in the report).');
  } else if (report.renameCandidates.length > 0) {
    const confirmed = await withTerminalPrompt((ask) => confirmRenames(report.renameCandidates, ask));
    snapshot = applyRenames(snapshot, confirmed);
    for (const { from, to } of confirmed) console.log(`Renamed: ${from} -> ${to}`);
    if (confirmed.length === 0) console.log('No renames confirmed.');
  }

  const images = await downloadImages(snapshot, {
    root,
    currencies: eventCurrencies(raw),
    download,
    log: (line) => console.log(line),
  });
  snapshot = images.snapshot;
  printImageReport(images.report);

  const json = JSON.stringify(snapshot, null, 2) + '\n';
  loadSnapshot(JSON.parse(json));
  if (ci && needsReview(report)) {
    // The new raw pages, images and report are kept for the reviewer, but the
    // committed snapshot stays the old one, so `--offline` on the branch
    // compares against it and finds the renames.
    console.log(`--ci: a Dragon was removed, so ${SNAPSHOT_FILE} is left as it was for the reviewer.`);
  } else {
    await mkdir(dirname(join(root, SNAPSHOT_FILE)), { recursive: true });
    await writeFile(join(root, SNAPSHOT_FILE), json, 'utf8');
    console.log(`Wrote ${SNAPSHOT_FILE}.`);
  }

  if (reportFile) {
    const current = Object.fromEntries(PAGE_TITLES.map((t) => [t, raw.pages[t].revision])) as Record<PageTitle, number>;
    const markdown = refreshReportMarkdown({ changed: changedPages(current, committed), build: report, images: images.report });
    await writeFile(reportFile, markdown, 'utf8');
    console.log(`Wrote the report to ${reportFile}.`);
    const review = needsReview(report);
    console.log(`needs_review=${review}`);
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `needs_review=${review}
`, 'utf8');
  }
}

/** `--check`: whether any page changed since the committed snapshot and every --baseline (see the file comment). */
async function check(baselineFiles: string[]): Promise<void> {
  const current = await fetchRevisions();
  const committed = await readManifestRevisions(MANIFEST_FILE);
  const changed = changedPages(current, committed);
  const baselines = await Promise.all(baselineFiles.map((f) => readManifestRevisions(f)));
  const caughtUp = baselines.some((b) => changedPages(current, b).length === 0);
  const result = changed.length > 0 && !caughtUp;

  if (changed.length === 0) console.log('No wiki page changed since the committed snapshot.');
  else console.log(`Changed since the committed snapshot: ${changed.join(', ')}`);
  if (changed.length > 0 && caughtUp) console.log('A --baseline already has these revisions (the open refresh PR).');
  console.log(result ? 'changed=true' : 'changed=false');
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${result}\n`, 'utf8');
}

/** Every value given after `flag` (`--flag value`, repeatable). */
function valuesOf(args: string[], flag: string): string[] {
  const values: string[] = [];
  args.forEach((arg, i) => {
    const next = args[i + 1];
    if (arg === flag && next !== undefined) values.push(next);
  });
  return values;
}

/**
 * The committed snapshot, if there is one: renames carry over from it. One
 * from an older schema is still read, since only its renames and its
 * Dragons' names and order are used, which every schema so far has.
 */
async function readPrevious(): Promise<Snapshot | null> {
  let text: string;
  try {
    text = await readFile(join(root, SNAPSHOT_FILE), 'utf8');
  } catch {
    return null;
  }
  const json: unknown = JSON.parse(text);
  const meta = isRecord(json) ? json.meta : undefined;
  const version = isRecord(meta) ? meta.schemaVersion : undefined;
  if (typeof version === 'number' && version < SCHEMA_VERSION) {
    console.log(`The committed snapshot is schema version ${version}; reading only its renames and Dragon names.`);
    return json as Snapshot;
  }
  return loadSnapshot(json);
}

function printReport({ counts, warnings, added, removed, renameCandidates }: BuildReport): void {
  const { pages, traits } = counts;
  console.log(`Built the snapshot: ${counts.dragons} Dragons, ${counts.limited} limited.`);
  console.log(`  pages: ${pages.elemental} Elemental, ${pages.epic} Epic, ${pages.special} Special`);
  console.log(`  traits: ${traits.all} all, ${traits.fixed} fixed, ${traits.none} none`);
  console.log(`  never parents: ${counts.cannotBeParent} (Gemstone + Crystalline: ${counts.gemstoneAndCrystalline})`);
  const r = counts.routes;
  console.log(`  Dragons with a Route that is: ${r.bred} Bred, ${r.coop} Co-op bred, ${r.evolved} Evolved, ` +
    `${r.summoned} Summoned, ${r.purchased} Purchased`);
  if (warnings.length === 0) console.log('No warnings.');
  for (const warning of warnings) console.log(`warning: ${warning}`);
  console.log(`Added since the previous snapshot (${added.length}): ${added.join(', ') || 'none'}`);
  console.log(`Removed since the previous snapshot (${removed.length}): ${removed.join(', ') || 'none'}`);
  if (renameCandidates.length > 0) console.log(`Rename candidates to confirm: ${renameCandidates.length}`);
}

function printImageReport({ requests, existing, downloaded, missing, warnings }: ImageReport): void {
  console.log(`Images: ${existing} already on disk, ${downloaded.length} downloaded, ${missing.length} missing, ` +
    `${requests} requests.`);
  for (const t of missing.filter((m) => m.kind === 'currency')) {
    console.log(`  no icon for the ${t.key} currency (File:${t.file}); an Event paying in it shows the generic one`);
  }
  for (const warning of warnings) console.log(`warning: ${warning}`);
}

const REASONS: Record<RenameCandidate['reason'], string> = {
  'same-order': 'same Order',
  'only-change': 'the only Dragon removed and the only one added',
};

/**
 * Runs `use` with an AskRename that asks on the terminal. It takes only y or
 * n and asks again otherwise; if input ends before an answer, the run fails
 * rather than guessing.
 */
async function withTerminalPrompt<T>(use: (ask: AskRename) => Promise<T>): Promise<T> {
  // Reading lines through the iterator buffers them, so piped answers aren't lost.
  const rl = createInterface({ input: process.stdin });
  const lines = rl[Symbol.asyncIterator]();
  const question = async (text: string): Promise<string> => {
    process.stdout.write(text);
    const line = await lines.next();
    if (line.done) throw new Error('Input ended before every rename candidate was answered.');
    return line.value;
  };
  const ask: AskRename = async ({ from, to, reason }) => {
    for (;;) {
      const answer = (await question(`Rename ${from} -> ${to} (${REASONS[reason]})? [y/n] `)).trim().toLowerCase();
      if (answer === 'y' || answer === 'yes') return true;
      if (answer === 'n' || answer === 'no') return false;
      console.log('Please answer y or n.');
    }
  };
  try {
    return await use(ask);
  } finally {
    rl.close();
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
