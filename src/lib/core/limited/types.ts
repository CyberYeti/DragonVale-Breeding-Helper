// The overlay parsed from Data:Limited.json (spec §5). Only what is
// Available today is in it: expired entries are already dropped.

export type Overlay = {
  /** The Limited rotation: limited Dragons breedable now outside any Event. */
  rotation: RotationEntry[];
  /** Running Events. */
  events: LimitedEvent[];
  /** Names that matched no snapshot Dragon, once each, in page order. */
  notRecognised: string[];
};

/**
 * A calendar day, `YYYY-MM-DD`. Something that ends on a day is Available
 * until the end of that day, local time. `null` = no end date known.
 */
export type EndDate = string | null;

export type RotationEntry = {
  dragon: string;
  ends: EndDate;
};

export type LimitedEvent = {
  name: string;
  ends: EndDate;
  /** The shop's currency (e.g. Spice), or null if the page doesn't say. */
  currency: string | null;
  shop: ShopEntry[];
};

export type ShopEntry = {
  dragon: string;
  /** Price in the Event's currency; null if the page's Cost isn't a number. */
  cost: number | null;
  /** false = Purchase only. */
  breedable: boolean;
  /**
   * When the Dragon leaves the shop: its own countdown if it has a valid
   * one, else the Event's.
   */
  ends: EndDate;
};
