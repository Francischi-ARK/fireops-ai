const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = "http://127.0.0.1:4173/";
const OUT = process.argv[2] || __dirname;

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${ROOT}#/home`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(OUT, "shot-home.png") });

  await page.goto(`${ROOT}#/copilot`);
  await page.locator("[data-copilot-scenario]").first().waitFor();
  await page.screenshot({ path: path.join(OUT, "shot-copilot-select.png") });

  await page.locator('[data-copilot-scenario="B-confirmed-fire-full-dispatch"]').click();
  await page.getByRole("button", { name: /运行 Copilot/ }).click();
  await page.locator(".copilot-trace li").first().waitFor();
  await page.screenshot({ path: path.join(OUT, "shot-copilot-run.png"), fullPage: true });

  await page.getByRole("button", { name: /确认属实/ }).click();
  await page.getByRole("button", { name: /下达调派/ }).waitFor();
  await page.screenshot({ path: path.join(OUT, "shot-copilot-briefs.png"), fullPage: true });

  await page.getByRole("button", { name: /下达调派/ }).click();
  await page.getByText(/调派已下达/).waitFor();
  await page.screenshot({ path: path.join(OUT, "shot-copilot-done.png") });

  await browser.close();
  console.log("shots ok");
}

main().catch((error) => { console.error(error); process.exit(1); });
