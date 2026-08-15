const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const ROOT = "http://127.0.0.1:4173";
const routes = ["home", "monitoring", "incidents", "station", "owner", "inspections", "enterprises/ent-001", "copilot"];

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  for (const route of routes) {
    await page.goto(ROOT + "/#/" + route);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      text: document.querySelector("main")?.innerText.trim() || "",
    }));
    assert.ok(metrics.text.length > 20, route + " has an empty main region");
    assert.ok(metrics.scrollWidth <= metrics.viewport + 1, route + " overflows horizontally");
  }

  await page.goto(ROOT + "/#/home");
  const mobileNav = page.locator(".mobile-nav a");
  assert.ok(await mobileNav.count() >= 5, "mobile navigation must expose field workflows");
  assert.equal(await page.locator('[data-mobile-nav="owner"]').isVisible(), true, "owner inbox missing from mobile nav");

  await page.goto(ROOT + "/#/monitoring");
  const targets = page.locator(".monitoring-primary, .primary-action, .station-action, .copilot-run-button");
  const boxes = await targets.evaluateAll((elements) => elements
    .filter((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
    })
    .map((element) => ({ text: element.textContent.trim(), height: element.getBoundingClientRect().height })));
  for (const box of boxes) assert.ok(box.height >= 44, box.text + " mobile target is below 44px");

  assert.deepEqual(errors, []);
  await browser.close();
  console.log("mobile e2e: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
