import type { Snapshot } from './types';

/** The snapshot schema this app reads. Bump it when the shape changes. */
export const SCHEMA_VERSION = 1;

/**
 * Checks that `json` is a snapshot this app can read and returns it typed.
 * Only the schema version is checked; the scraper validates the content.
 * Throws when `meta.schemaVersion` is missing or isn't SCHEMA_VERSION.
 */
export function loadSnapshot(json: unknown): Snapshot {
  const meta = isRecord(json) ? json.meta : undefined;
  const version = isRecord(meta) ? meta.schemaVersion : undefined;
  if (version === undefined) {
    throw new Error(
      `Snapshot has no meta.schemaVersion; this app reads schema version ${SCHEMA_VERSION}.`,
    );
  }
  if (version !== SCHEMA_VERSION) {
    throw new Error(
      `Snapshot schema version ${JSON.stringify(version)} can't be read; this app reads schema version ${SCHEMA_VERSION}.`,
    );
  }
  return json as Snapshot;
}

/** A plain JSON object: not null, not an array. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
