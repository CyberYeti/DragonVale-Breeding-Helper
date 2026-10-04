// PROTOTYPE: drive the spike in a real (headed) Chrome, screenshot each variant, run the scripted benchmark.
// Usage: npm run dev (in another shell), then: node bench.mjs [mode] [headless]
import puppeteer from "puppeteer-core";
const mode = process.argv[2] || "whole";
const headless = process.argv[3] === "headless";
const extra = process.argv[4] || "";
const only = (process.argv[5] || "ABC").split("");
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless, defaultViewport: { width: 1400, height: 900 }, args: ["--window-size=1420,1000"] });
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text().slice(0, 300)); });
const out = {};
for (const v of only) {
  await page.goto(`http://localhost:5173/?variant=${v}&mode=${mode}&target=Mesmer&preset=mid&focused=1${extra}`, { waitUntil: "load", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: `bench-${mode}-${v}${extra.replace(/[&=]/g, "")}.png` });
  const r = await page.evaluate(() => window.__bench(3000));
  const dom = await page.evaluate(() => ({ tiles: document.querySelectorAll(".tile,.etile").length, dom: document.getElementsByTagName("*").length }));
  out[v] = { ...r, ...dom };
  console.log(v, JSON.stringify(out[v]));
}
console.log(errs.slice(0, 15).join("\n") || "no console errors");
await browser.close();
