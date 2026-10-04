// PROTOTYPE: reuse the real snapshot + rules from the earlier prototypes (they set window globals).
import "../../../graph-views/data.js";
import "../../../graph-views/logic.js";
import "../../../menu-layout/images.js";
import "../../../menu-layout/pages.js";
export const DV = window.DV;
export const S = DV.S;
export const PAGES = window.PAGES;
export const RC = { Primary: "#cfe8cf", Hybrid: "#88ff77", Rare: "#0099FF", Epic: "#8811EE", Galaxy: "#00DDFF", Gemstone: "#FF7711", Legendary: "#EE2200", Mythic: "#FF22BB" };
const SIL = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#888" opacity=".35"/></svg>');
export const IMG = (d) => window.IMAGES[d.name] || SIL;
export const EIMG = (e) => window.ELEMENT_ICONS[e] || SIL;
export const formLbl = (d, form) => (form === "rift" && !d.isRiftDragon ? " (Rift form)" : "");
