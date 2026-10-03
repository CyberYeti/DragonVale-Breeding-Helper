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
writeFileSync(join(here, "images.js"), "// PROTOTYPE (throwaway): Dragon -> thumbnail URL\nwindow.IMAGES = " + JSON.stringify(out) + ";\n");
console.log(Object.keys(out).length, "of", names.length, "resolved; missing:", names.filter((n) => !out[n]).join(", "));
