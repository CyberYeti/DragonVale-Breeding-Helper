import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchPages, RAW_DIR } from './pages';
import { cutRealRecords, REAL_RECORD_NAMES, REAL_RECORDS_FILE } from './fixture';

const root = join(import.meta.dirname, '..');

describe('fixtures/real-records.json', () => {
  it('matches a fresh cut from the committed raw pages', async () => {
    const raw = await fetchPages({ kind: 'offline', dir: join(root, RAW_DIR) });
    const committed = JSON.parse(await readFile(join(root, REAL_RECORDS_FILE), 'utf8'));
    expect(committed).toEqual(cutRealRecords(raw));
  });

  it('holds the eight real Dragons with their hints, and what their hints name', async () => {
    const raw = await fetchPages({ kind: 'offline', dir: join(root, RAW_DIR) });
    const records = cutRealRecords(raw);

    expect(records.dragons.map((d) => d.Name)).toEqual([...REAL_RECORD_NAMES]);
    expect(Object.keys(records.breedingHints).sort()).toEqual([...REAL_RECORD_NAMES].sort());
    expect(records.breedingHints.Zaffer).toMatchObject({ RequiredDragons: ['Blue Fire', 'Plasma'] });

    const supporting = records.supporting.dragons.map((d) => d.Name);
    expect(supporting).toEqual(expect.arrayContaining(['Blue Fire', 'Plasma', 'Plant', 'Metal']));
    expect(records.elements.primary).toHaveLength(10);
    expect(records.opposites).toContainEqual(['Plant', 'Metal']);
  });
});
