// Where the downloaded images live (spec §4 Images). The scraper saves them
// under public/images/ and the app serves public/ at its base URL, so every
// path here is relative to public/ and has no leading slash: the app prefixes
// it with import.meta.env.BASE_URL.
//
// Dragon images and Element and page icons are stored in the snapshot
// (`image` / `icon`). The menu and currency icons aren't, so their paths are
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

/** Shipped with the app (not downloaded); used for an Event whose currency has no icon. */
export const GENERIC_EVENT_ICON = `${IMAGES_DIR}/events/generic.svg`;

/**
 * Where an Event currency's icon is saved: the name squashed and lower-cased
 * ("Candy" -> images/currencies/candy.png, "Pine Cone" -> .../pinecone.png).
 * The app shows the running Event's currency icon, and GENERIC_EVENT_ICON
 * when there is none on disk.
 */
export function currencyIconPath(currency: string): string {
  return `${IMAGES_DIR}/currencies/${squash(currency).toLowerCase()}.png`;
}
