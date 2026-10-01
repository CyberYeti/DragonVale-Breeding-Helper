// PROTOTYPE (throwaway): fetch the wiki's Data: pages once and write data.js
// in roughly the snapshot shape decided in the data-model ticket (#4).
// Run: node prototypes/graph-views/fetch-data.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const url =
  "https://dragonvale.fandom.com/api.php?action=query&prop=revisions&rvprop=content|ids&rvslots=main" +
  "&titles=Data:Dragons.json|Data:BreedingHints.json|Data:Game.json|Data:Limited.json&format=json&formatversion=2";
const res = await fetch(url, { headers: { "User-Agent": "DragonValeBreedingHelper-prototype/0.1 (personal tool)" } });
const pages = Object.fromEntries(
  (await res.json()).query.pages.map((p) => [p.title, JSON.parse(p.revisions[0].slots.main.content)])
);
const dragonsRaw = pages["Data:Dragons.json"].dragons;
const hints = pages["Data:BreedingHints.json"].breedingHints;
const game = pages["Data:Game.json"];
const limited = pages["Data:Limited.json"];

const epic = new Set(game.Elements?.Epic ?? game.elements?.epic ?? []);
const PRIMARIES = ["Plant", "Fire", "Earth", "Cold", "Lightning", "Water", "Air", "Metal", "Light", "Dark"];

const dragons = dragonsRaw.map((d) => {
  const h = hints[d.Name];
  const breeding = new Set(d.BreedingElements ?? d.Elements);
  for (const e of d.Elements) if (!PRIMARIES.includes(e)) breeding.add(e);
  const routes = [];
  if (!h) {
    if (d.Tags?.includes("RiftPrimary")) routes.push({ kind: "Purchased" });
    else routes.push({ kind: "Bred", elements: [...d.Elements] }, { kind: "Purchased" });
  } else if (h.IsEvolution) {
    routes.push({ kind: "Evolved", from: d.Devolution, decorations: h.RequiredDecorations });
  } else if (h.RequiredArtifacts) {
    routes.push({ kind: "Summoned", artifacts: h.RequiredArtifacts });
  } else if (h.Any && h.RequiredDragons?.length === 1 && d.Rarity === "Galaxy") {
    routes.push({ kind: "Co-op bred", friendsDragon: h.RequiredDragons[0] });
  } else {
    const r = { kind: "Bred" };
    if (h.RequiredDragons) r.parents = h.RequiredDragons;
    if (h.RequiredElements) r.elements = h.RequiredElements;
    if (h.MinimumRequiredElements) r.minDistinctElements = h.MinimumRequiredElements;
    if (h.RequiredElementsForBothParents) r.elementOnBothParents = h.RequiredElementsForBothParents;
    if (h.Any) r.anyPair = true;
    if (d.Elements.includes("Rift")) r.rift = "only";
    const c = {};
    if (h.RequiredTime) c.time = h.RequiredTime;
    if (h.RequiredWeather) c.weather = h.RequiredWeather;
    if (h.RiftAlignment) c.alignment = h.RiftAlignment;
    if (h.RequiredTraits) c.parentTrait = h.RequiredTraits;
    if (h.RequiredDragonTraits) c.namedParentTrait = h.RequiredDragonTraits;
    if (h.Prerequisites) c.prerequisite = h.Prerequisites;
    if (Object.keys(c).length) r.conditions = c;
    routes.push(r);
  }
  if (d.Name === "Air") routes.push({ kind: "Purchased" });
  return {
    name: d.Name,
    rarity: d.Rarity,
    order: d.Order,
    elements: d.Elements,
    breedingElements: [...breeding],
    isLimited: !!d.IsLimited,
    traits: d.Traits ? (d.Traits.Available ? "all" : d.Traits.Default) : null,
    canBeParent: !["Gemstone", "Legendary", "Mythic"].includes(d.Rarity),
    routes,
  };
});

const snapshot = {
  meta: { fetched: new Date().toISOString(), license: "CC BY-SA 3.0, DragonVale Fandom wiki" },
  opposites: [["Plant", "Metal"], ["Fire", "Cold"], ["Earth", "Air"], ["Lightning", "Water"], ["Light", "Dark"]],
  dragons,
  limitedRaw: limited,
};
writeFileSync(join(here, "data.js"), "window.SNAPSHOT = " + JSON.stringify(snapshot) + ";\n");
console.log(dragons.length, "dragons;", "limited keys:", Object.keys(limited), "game keys:", Object.keys(game));
