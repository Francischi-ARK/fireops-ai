// Records the three-act demo as a .webm next to this script.
// Reset the demo database first (see run-guide.md), then:
//   NODE_PATH=<runtime node_modules> node copilot_demo_video.cjs
const path = require("node:path");
const { chromium } = require("playwright");

const APP_URL = "http://127.0.0.1:4173/#/copilot";
const BEAT = 2600; // ms pause so viewers can read each screen

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1024 },
    recordVideo: { dir: path.join(__dirname, ".."), size: { width: 1440, height: 1024 } },
  });
  const page = await context.newPage();

  await page.goto(APP_URL);
  await page.locator("[data-copilot-scenario]").first().waitFor();
  await page.waitForTimeout(BEAT);

  // Act 2 first (main storyline): confirmed fire, full closed loop.
  await page.locator('[data-copilot-scenario="B-confirmed-fire-full-dispatch"]').click();
  await page.waitForTimeout(BEAT);
  await page.getByRole("button", { name: /运行 Copilot/ }).click();
  await page.locator(".copilot-trace li").first().waitFor();
  await page.waitForTimeout(BEAT * 2);
  await page.getByRole("button", { name: /确认属实/ }).click();
  await page.getByRole("button", { name: /下达调派/ }).waitFor();
  await page.waitForTimeout(BEAT * 2);
  await page.getByRole("button", { name: /下达调派/ }).click();
  await page.getByText(/调派已下达/).waitFor();
  await page.waitForTimeout(BEAT * 2);

  // Act 1: maintenance-adjacent alarm, dismissed as false alarm.
  await page.getByRole("button", { name: /重新开始/ }).click();
  await page.locator('[data-copilot-scenario="A-false-alarm-maintenance-adjacent"]').click();
  await page.waitForTimeout(BEAT);
  await page.getByRole("button", { name: /运行 Copilot/ }).click();
  await page.locator(".copilot-trace li").first().waitFor();
  await page.waitForTimeout(BEAT * 2);
  await page.getByRole("button", { name: /确认误报/ }).click();
  await page.getByText("已登记为误报").waitFor();
  await page.waitForTimeout(BEAT);

  // Act 3: insufficient data, safe abstention.
  await page.getByRole("button", { name: /重新开始/ }).click();
  await page.locator('[data-copilot-scenario="C-insufficient-data-safe-abstention"]').click();
  await page.waitForTimeout(BEAT);
  await page.getByRole("button", { name: /运行 Copilot/ }).click();
  await page.locator(".copilot-abstain").waitFor();
  await page.waitForTimeout(BEAT * 2);

  await context.close();
  await browser.close();
  console.log("demo video recorded");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
