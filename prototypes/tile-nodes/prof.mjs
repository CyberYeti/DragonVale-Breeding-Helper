// PROTOTYPE: CPU-profile the benchmark for one variant and print the top self-time functions.
import puppeteer from "puppeteer-core";
const [v = "A", extra = ""] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, defaultViewport: { width: 1400, height: 900 } });
const page = await browser.newPage();
await page.goto(`http://localhost:5173/?variant=${v}&mode=whole&target=Mesmer&focused=1${extra}`, { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 3000));
const cdp = await page.createCDPSession();
await cdp.send("Profiler.enable"); await cdp.send("Profiler.start");
await page.evaluate(() => window.__bench(1500));
const { profile } = await cdp.send("Profiler.stop");
const self = new Map(); const dt = profile.timeDeltas; const idx = new Map(profile.nodes.map((n) => [n.id, n]));
profile.samples.forEach((id, i) => { const n = idx.get(id); const k = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").slice(-2).join("/")}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0)); });
[...self].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, t]) => console.log((t / 1000).toFixed(0).padStart(7), "ms", k));
await browser.close();
