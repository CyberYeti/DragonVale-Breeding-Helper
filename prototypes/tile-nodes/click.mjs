// PROTOTYPE: click a Route pill in the Focus tree, screenshot the popover, then open Details.
import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, defaultViewport: { width: 1400, height: 900 } });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));
for (const v of ["B", "C"]) {
  await page.goto(`http://localhost:5173/?variant=${v}&mode=focus&target=Mesmer&preset=mid`, { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 2500));
  const pills = await page.$$(".pill");
  const box = await pills[1].boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + 6);
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: `bench-click-${v}.png` });
  const det = await page.$(".pop button.primary");
  console.log(v, "popover:", !!(await page.$(".pop")), "details btn:", !!det);
  if (det) { await det.click(); await new Promise((r) => setTimeout(r, 600)); console.log(v, "sheet:", !!(await page.$(".sheet"))); await page.screenshot({ path: `bench-sheet-${v}.png` }); }
}
await browser.close();
