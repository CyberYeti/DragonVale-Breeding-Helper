// The scheduled refresh's PR description (`npm run snapshot -- --ci --report
// <file>`): what changed on the wiki, what the new snapshot adds and removes,
// what still needs a person, and what's still missing (the wiki may not have
// it yet; the next refresh after the wiki changes picks it up).

import type { BuildReport } from './build';
import type { ImageReport } from './images';
import type { PageTitle } from './pages';

export type RefreshReport = {
  /** The pages whose revision changed since the committed snapshot. */
  changed: readonly PageTitle[];
  build: BuildReport;
  images: ImageReport;
};

const list = (items: readonly string[]) => (items.length ? items.join(', ') : 'none');

/** The report as Markdown. */
export function refreshReportMarkdown({ changed, build, images }: RefreshReport): string {
  const out: string[] = ['## Snapshot refresh', ''];
  out.push(`Wiki pages changed: ${list(changed)}`, '');
  out.push(`- Added Dragons (${build.added.length}): ${list(build.added)}`);
  out.push(`- Removed Dragons (${build.removed.length}): ${list(build.removed)}`);
  out.push(`- Images downloaded: ${images.downloaded.length}`);
  out.push('');

  if (build.renameCandidates.length > 0) {
    out.push('### ⚠️ Rename candidates (not applied)', '');
    out.push(
      'The refresh never answers rename prompts. Before merging, run `npm run snapshot -- --offline` on this branch, ' +
        'answer them, and push. Otherwise owned flags for these Dragons stay under the old name.',
      '',
    );
    for (const { from, to, reason } of build.renameCandidates) out.push(`- ${from} → ${to} (${reason})`);
    out.push('');
  }

  const eventIcons = images.missing.filter((t) => t.kind === 'event');
  const otherImages = images.missing.filter((t) => t.kind !== 'event');
  if (eventIcons.length > 0 || otherImages.length > 0) {
    out.push('### Still missing', '');
    out.push('The wiki may not have these yet. A later refresh picks them up once the wiki changes.', '');
    for (const t of eventIcons) out.push(`- Event icon for ${t.key} (File:${t.file}); the app shows the generic one`);
    for (const t of otherImages) out.push(`- ${t.kind} image for ${t.key} (File:${t.file})`);
    out.push('');
  }

  if (build.warnings.length > 0) {
    out.push('### Warnings', '');
    for (const w of build.warnings) out.push(`- ${w}`);
    out.push('');
  }
  return out.join('\n');
}
