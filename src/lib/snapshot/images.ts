// Where the downloaded images live (spec §4 Images). The scraper saves them
// under public/images/ and the app serves public/ at its base URL, so every
// path here is relative to public/ and has no leading slash: the app prefixes
// it with import.meta.env.BASE_URL.
//
// Dragon images and Element and page icons are stored in the snapshot
// (`image` / `icon`). The menu and event icons aren't, so their paths are
// fixed here for both sides to share.

/** The folder under public/ that holds every downloaded image. */
export const IMAGES_DIR = 'images';

/** A name with everything but ASCII letters and digits removed: "Om of Noms: Country Roads II" -> "OmofNomsCountryRoadsII". */
export function squash(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, '');
}

/** The fixed menu icons, by what they mark. */
export const MENU_ICONS = {
  /** Breedable now. */
  breedable: `${IMAGES_DIR}/menu/breedable.png`,
  /** Limited rotation (the hourglass). */
  limited: `${IMAGES_DIR}/menu/limited.png`,
  /** Dragonarium. */
  dragonarium: `${IMAGES_DIR}/menu/dragonarium.png`,
  normalCave: `${IMAGES_DIR}/menu/normal-cave.png`,
  riftCave: `${IMAGES_DIR}/menu/rift-cave.png`,
  coopCave: `${IMAGES_DIR}/menu/coop-cave.png`,
} as const;

export type MenuIcon = keyof typeof MENU_ICONS;

/** Shipped with the app (not downloaded); used for any Event without its own icon. */
export const GENERIC_EVENT_ICON = `${IMAGES_DIR}/events/generic.svg`;

/**
 * An Event's series: the part of its name before the first ":" ("Om of Noms:
 * Country Roads II" -> "Om of Noms"), or the whole name when it has no ":".
 */
export function eventSeries(eventName: string): string {
  const colon = eventName.indexOf(':');
  return (colon < 0 ? eventName : eventName.slice(0, colon)).trim();
}

/** The key an Event icon is saved under: the name squashed and lower-cased ("Om of Noms" -> "omofnoms"). */
export function eventIconKey(name: string): string {
  return squash(name).toLowerCase();
}

/**
 * Where an Event's icon may be saved, in the order to try: its own (full
 * name), then its series'. The wiki names most Event icons after the series,
 * so usually only the second exists; neither may (a newer Event, or none on
 * the wiki), so the app falls back to GENERIC_EVENT_ICON after both.
 */
export function eventIconPaths(eventName: string): string[] {
  const keys = [eventIconKey(eventName), eventIconKey(eventSeries(eventName))].filter((k) => k !== '');
  return [...new Set(keys)].map((key) => `${IMAGES_DIR}/events/${key}.png`);
}
