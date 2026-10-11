// Safe localStorage access. Storage can be missing, blocked (private
// windows, disabled site data) or full, and the app must work without it,
// so every access is wrapped: a read gives null, a write reports failure.

/** Every key this app stores starts with this. */
const PREFIX = 'dvbh:';

/** The stored string for `key`, or null when there is none or storage can't be read. */
export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

/** The stored value for `key` parsed as JSON, or null when missing, unreadable or not JSON. */
export function readStoredJson(key: string): unknown {
  const text = readStored(key);
  if (text === null) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Removes `key`. Returns false when storage refused it. */
export function removeStored(key: string): boolean {
  try {
    localStorage.removeItem(PREFIX + key);
    return true;
  } catch {
    return false;
  }
}

/** Stores `value` under `key`. Returns false when storage refused it. */
export function writeStored(key: string, value: string): boolean {
  try {
    localStorage.setItem(PREFIX + key, value);
    return true;
  } catch {
    return false;
  }
}
