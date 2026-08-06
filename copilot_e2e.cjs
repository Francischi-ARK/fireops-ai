const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const APP_URL = "http://127.0.0.1:4173/#/copilot";

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.goto(APP_URL);
  await page.locator("[data-copilot-scenario]").first().waitFor();
  assert.equal(await page.locator("[data-copilot-scenario]").count(), 3);

  // Scenario A: maintenance-adjacent alarm -> dismissed, no incident.
  await page.locator('[data-copilot-scenario="A-false-alarm-maintenance-adjacent"]').click();
  await page.getByRole("button", { name: /运行 Copilot/ }).click();
  await page.locator(".copilot-trace li").first().waitFor();
  assert.ok((await page.locator(".copilot-trace li").count()) >= 4, "scenario A trace");
  await page.getByRole("button", { name: /确认误报/ }).click();
  await page.getByText("已登记为误报").waitFor();

  // Scenario B: confirmed fire -> dispatch draft -> three role briefs -> dispatch.
  await page.getByRole("button", { name: /重新开始/ }).click();
  await page.locator('[data-copilot-scenario="B-confirmed-fire-full-dispatch"]').click();
  await page.getByRole("button", { name: /运行 Copilot/ }).click();
  await page.getByRole("button", { name: /确认属实/ }).waitFor();
  await page.getByRole("button", { name: /确认属实/ }).click();
  await page.getByRole("button", { name: /下达调派/ }).waitFor();
  assert.equal(await page.locator(".copilot-brief").count(), 3);
  await page.getByRole("button", { name: /下达调派/ }).click();
  await page.getByText(/调派已下达/).waitFor();

  // Scenario C: insufficient data -> safe abstention.
  await page.getByRole("button", { name: /重新开始/ }).click();
  await page.locator('[data-copilot-scenario="C-insufficient-data-safe-abstention"]').click();
  await page.getByRole("button", { name: /运行 Copilot/ }).click();
  await page.locator(".copilot-abstain").waitFor();
  assert.ok((await page.locator(".copilot-missing span").count()) >= 5, "scenario C missing fields");

  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(__dirname, "copilot-e2e.png"), fullPage: true });

  // Mobile Web: persistent navigation, human confirmation and downloadable audit evidence.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4173/#/home");
  await page.reload();
  await page.locator('[data-mobile-nav="copilot"]').waitFor();
  assert.equal(await page.locator('[data-mobile-nav="copilot"]').isVisible(), true);
  await page.locator('[data-mobile-nav="copilot"]').click();
  await page.locator('[data-copilot-scenario="A-false-alarm-maintenance-adjacent"]').waitFor();
  await page.locator('[data-copilot-scenario="A-false-alarm-maintenance-adjacent"]').click();
  await page.getByRole("button", { name: /运行 Copilot/ }).click();
  const dismissButton = page.getByRole("button", { name: /确认误报/ });
  await dismissButton.waitFor();
  assert.ok((await dismissButton.boundingBox()).height >= 44, "mobile approval target");
  await dismissButton.click();
  await page.getByText("已登记为误报").waitFor();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /导出可审计事件包/ }).click(),
  ]);
  const auditPack = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
  assert.equal(auditPack.schema_version, "fireguard-audit-pack/v1");
  assert.equal(auditPack.human_decisions[0].value, "dismissed");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: path.join(__dirname, "copilot-mobile-390x844.png"), fullPage: true });

  await browser.close();
  console.log("copilot e2e ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
