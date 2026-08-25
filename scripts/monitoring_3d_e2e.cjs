const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const URL = "http://127.0.0.1:4173/#/monitoring";
const executablePath = process.env.PLAYWRIGHT_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  await page.goto(URL);
  await page.locator('#monitoring-3d[data-spatial-level="factory"]').waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /进入电池车间/ }).click();
  const floorplan = page.locator(".monitoring-floorplan");
  await floorplan.waitFor({ timeout: 10000 });
  assert.equal(await floorplan.locator("img").evaluate((img) => img.complete && img.naturalWidth > 0), true, "floorplan image is unavailable");
  assert.equal(await floorplan.locator(".monitoring-alarm-pin").count(), 1, "alarm point is missing");

  await page.getByRole("button", { name: "返回工厂总览" }).click();
  await page.locator('#monitoring-3d[data-spatial-level="factory"]').waitFor();

  const fallback = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  await fallback.route("**/monitoring-3d.js*", (route) => route.abort());
  await fallback.goto(URL);
  await fallback.getByRole("button", { name: /进入电池车间/ }).last().waitFor({ timeout: 6000 });
  await fallback.getByRole("button", { name: /进入电池车间/ }).last().click();
  await fallback.locator(".monitoring-floorplan").waitFor();
  assert.equal(await fallback.locator(".monitoring-floorplan").isVisible(), true, "floorplan must remain visible without 3D");

  await browser.close();
  console.log("monitoring 3d e2e: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
