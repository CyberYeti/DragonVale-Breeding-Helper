// PROTOTYPE (throwaway): resolve each Dragon's <Name>DragonAdult.png to a CDN thumbnail URL and write images.js.
// Special:FilePath answers 403 to scripts and headless browsers, so the imageinfo API is used instead.
// Run: node prototypes/menu-layout/fetch-images.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "../graph-views/data.js"), "utf8");
const S = JSON.parse(src.slice(src.indexOf("=") + 1).trim().replace(/;$/, ""));
const file = (n) => `File:${n.replace(/[^A-Za-z0-9]/g, "")}DragonAdult.png`;
const out = {};
const names = S.dragons.map((d) => d.name);
for (let i = 0; i < names.length; i += 50) {
  const batch = names.slice(i, i + 50);
  const url = "https://dragonvale.fandom.com/api.php?action=query&prop=imageinfo&iiprop=url&iiurlwidth=120&format=json&formatversion=2&titles=" + encodeURIComponent(batch.map(file).join("|"));
  const j = await (await fetch(url, { headers: { "User-Agent": "DragonValeBreedingHelper-prototype/0.1 (personal tool)" } })).json();
  const byTitle = new Map(j.query.pages.map((p) => [p.title, p.imageinfo?.[0]?.thumburl]));
  const norm = new Map((j.query.normalized || []).map((n) => [n.from, n.to]));
  for (const n of batch) { const t = byTitle.get(norm.get(file(n)) || file(n)); if (t) out[n] = t; }
}
// Element icons: File:Icon <Element>.png
const elems = new Set();
for (const d of S.dragons) { d.breedingElements.forEach((e) => elems.add(e)); d.elements.forEach((e) => elems.add(e)); for (const r of d.routes) (r.elements || []).concat(r.elementOnBothParents || []).forEach((e) => elems.add(e)); }
const icons = {};
const eurl = "https://dragonvale.fandom.com/api.php?action=query&prop=imageinfo&iiprop=url&iiurlwidth=64&format=json&formatversion=2&titles=" + encodeURIComponent([...elems].map((e) => `File:Icon ${e}.png`).join("|"));
const ej = await (await fetch(eurl, { headers: { "User-Agent": "DragonValeBreedingHelper-prototype/0.1 (personal tool)" } })).json();
for (const p of ej.query.pages) if (p.imageinfo) icons[p.title.replace(/^File:Icon /, "").replace(/\.png$/, "")] = p.imageinfo[0].thumburl || p.imageinfo[0].url;
console.log("element icons:", Object.keys(icons).length, "of", elems.size, "missing:", [...elems].filter((e) => !icons[e]).join(", "));

// Menu icons from the game: Dragonarium page/group icons, the egg tab, the limited hourglass,
// and an event's icon guessed from its name ("Om of Noms: …" -> OmOfNomsDragonariumIcon.png).
globalThis.window = {};
await import("file://" + join(here, "pages.js").replace(/\\/g, "/"));
const squash = (s) => s.replace(/[^A-Za-z0-9]/g, "");
const want = { breedable: "BreedingHeartIcon.png", limited: "LimitedTimeDragonariumHelpIcon.png", dragonarium: "DragonariumBasic.png", unavailable: "UnavailableDragonariumHourGlass.png",
  "cave:normal": "BreedingCave2015.png", "cave:rift": "RiftBreedingCave.png", "cave:coop": "CooperativeBreedingCave2015.png" };
for (const g of ["Elemental", "Epic", "Special"]) want["group:" + g.toLowerCase()] = `${g}DragonariumIcon.png`;
for (const p of window.PAGES) want["page:" + p.name] = `${squash(p.name)}DragonariumIcon.png`;
for (const ev of Object.keys(S.limitedRaw.events || {})) want["event:" + ev] = `${squash(ev.split(":")[0])}DragonariumIcon.png`;
const ui = {};
const keys = Object.keys(want);
for (let i = 0; i < keys.length; i += 50) {
  const batch = keys.slice(i, i + 50);
  const u = "https://dragonvale.fandom.com/api.php?action=query&prop=imageinfo&iiprop=url&iiurlwidth=96&format=json&formatversion=2&titles=" + encodeURIComponent(batch.map((k) => "File:" + want[k]).join("|"));
  const j = await (await fetch(u, { headers: { "User-Agent": "DragonValeBreedingHelper-prototype/0.1 (personal tool)" } })).json();
  const norm = new Map((j.query.normalized || []).map((n) => [n.from, n.to]));
  const byTitle = new Map(j.query.pages.map((p) => [p.title, p.imageinfo && (p.imageinfo[0].thumburl || p.imageinfo[0].url)]));
  for (const k of batch) { const t = byTitle.get(norm.get("File:" + want[k]) || "File:" + want[k]); if (t) ui[k] = t; }
}
console.log("menu icons:", Object.keys(ui).length, "of", keys.length, "missing:", keys.filter((k) => !ui[k]).join(", "));
writeFileSync(join(here, "images.js"), "// PROTOTYPE (throwaway): Dragon -> thumbnail URL, Element -> icon URL, menu key -> icon URL\nwindow.IMAGES = " + JSON.stringify(out) + ";\nwindow.ELEMENT_ICONS = " + JSON.stringify(icons) + ";\nwindow.UI_ICONS = " + JSON.stringify(ui) + ";\n");
console.log(Object.keys(out).length, "of", names.length, "resolved; missing:", names.filter((n) => !out[n]).join(", "));
