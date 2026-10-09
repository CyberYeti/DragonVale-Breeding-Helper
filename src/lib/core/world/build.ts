import type { Dragon, Snapshot } from '../../snapshot';
import { isOwned, type Collection } from '../collection';
import type { EndDate, Overlay } from '../limited';
import type { Breeding, ParentSet, World } from './types';

/**
 * Builds the World for one snapshot, Collection and overlay at `now`.
 *
 * The overlay is normally already cut to what is live when it was parsed;
 * anything whose end date is before `now`'s local day is dropped again here,
 * so an overlay parsed yesterday (a cached page, or the app left open past
 * midnight) doesn't keep a Dragon Available past its countdown.
 */
export function buildWorld(snapshot: Snapshot, collection: Collection, overlay: Overlay, now: Date): World {
  const dragons = new Map(snapshot.dragons.map((d) => [d.name, d]));
  const { available, purchaseOnly } = liveLimited(snapshot.dragons, overlay, localDay(now));

  return Object.freeze({
    snapshot,
    collection,
    overlay,
    now,
    dragons,
    carriers: carriersByElement(snapshot.dragons),
    parents: Object.freeze({
      normal: parentSet(snapshot.dragons, collection, 'normal'),
      rift: parentSet(snapshot.dragons, collection, 'rift'),
    }),
    available,
    purchaseOnly,
  });
}

function carriersByElement(dragons: readonly Dragon[]): Map<string, readonly Dragon[]> {
  const carriers = new Map<string, Dragon[]>();
  for (const dragon of dragons) {
    for (const element of new Set(dragon.breedingElements)) {
      let list = carriers.get(element);
      if (!list) carriers.set(element, (list = []));
      list.push(dragon);
    }
  }
  for (const list of carriers.values()) {
    list.sort((a, b) => a.breedingElements.length - b.breedingElements.length || a.order - b.order);
  }
  return carriers;
}

/**
 * Normal breeding: any owned Dragon, either form. Rift breeding: owned Rift
 * forms and Rift dragons, i.e. owned in the `rift` form (a Rift dragon's one
 * form). Orphans aren't snapshot Dragons, so they never get in.
 */
function parentSet(dragons: readonly Dragon[], collection: Collection, breeding: Breeding): ParentSet {
  const form = breeding === 'rift' ? 'rift' : undefined;
  const members = dragons.filter((d) => d.canBeParent && isOwned(collection, d, form));
  return Object.freeze({ dragons: members, names: new Set(members.map((d) => d.name)) });
}

function liveLimited(
  dragons: readonly Dragon[],
  overlay: Overlay,
  today: string,
): { available: Set<string>; purchaseOnly: Set<string> } {
  const live = (ends: EndDate) => ends === null || ends >= today;
  const limitedLive = new Set<string>();
  const purchaseOnly = new Set<string>();

  for (const entry of overlay.rotation) {
    if (live(entry.ends)) limitedLive.add(entry.dragon);
  }
  for (const event of overlay.events) {
    if (!live(event.ends)) continue;
    for (const entry of event.shop) {
      if (!live(entry.ends)) continue;
      limitedLive.add(entry.dragon);
      if (!entry.breedable) purchaseOnly.add(entry.dragon);
    }
  }

  const available = new Set(
    dragons.filter((d) => !d.isLimited || evolutionOnly(d) || limitedLive.has(d.name)).map((d) => d.name),
  );
  return { available, purchaseOnly };
}

/**
 * A Dragon obtained only by evolving. Evolving isn't tied to a window (it
 * costs gems outside events), so such a Dragon is always Available even when
 * the wiki marks it limited. Matches `noBreeding`'s 'evolution-only'.
 */
const evolutionOnly = (dragon: Dragon) => {
  const kinds = new Set(dragon.routes.map((route) => route.kind));
  return kinds.has('evolved') && !kinds.has('bred') && !kinds.has('coop') && !kinds.has('summoned');
};

const pad = (n: number) => String(n).padStart(2, '0');

/** `now`'s calendar day in local time, `YYYY-MM-DD`; compares as a string with EndDate. */
const localDay = (now: Date) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
