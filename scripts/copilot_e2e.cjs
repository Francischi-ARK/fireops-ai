const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
const { chromium } = require("playwright");

const APP_URL = "http://127.0.0.1:4173/#/copilot";

function resetDemoDb() {
  try {
    execSync(
      `docker exec fireops-postgres psql -U fireguard -d fireguard -c "TRUNCATE incident_timeline, dispatch_reports, incident_dispatches, fire_incidents, signal_verifications, monitoring_events, copilot_runs, ops_workorders, inspection_findings RESTART IDENTITY CASCADE; UPDATE fire_stations SET status='available';"`,
      { stdio: "ignore" },
    );
  } catch {
    // ignore
  }
}

async function main() {
  resetDemoDb();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.goto(APP_URL);
  await page.locator("[data-copilot-scenario]").first().waitFor();
  assert.equal(await page.locator("[data-copilot-scenario]").count(), 5);

  // Scenario A: maintenance-adjacent alarm -> dismissed, no incident.
  await page.locator('[data-copilot-scenario="A-false-alarm-paint-shop"]').click();
  await page.getByRole("button", { name: /运行 Copilot/ }).click();
  await page.locator(".copilot-trace li").first().waitFor();
  assert.ok((await page.locator(".copilot-trace li").count()) >= 4, "scenario A trace");
  await page.getByRole("button", { name: "确认误报，不建事件" }).click();
  await page.getByText("已登记为误报").waitFor();

  // Scenario B: confirmed fire -> workorder draft -> three role briefs -> dispatch.
  await page.getByRole("button", { name: /重新开始/ }).click();
  await page.locator('[data-copilot-scenario="B-confirmed-fire-battery-workorder"]').click();
  await page.getByRole("button", { name: /运行 Copilot/ }).click();
  await page.getByRole("button", { name: "确认火警，建立处置事件" }).waitFor();
  await page.getByRole("button", { name: "确认火警，建立处置事件" }).click();
  await page.getByRole("button", { name: "派发工单（人工确认）" }).waitFor();
  assert.equal(await page.locator(".copilot-brief").count(), 3);
  await page.getByRole("button", { name: "派发工单（人工确认）" }).click();
  // 派发成功后跳转统一班组收件箱（中枢串联）
  await page.waitForURL(/#\/station/, { timeout: 15000 });
  await page.locator("[data-inbox-select]").first().waitFor({ timeout: 15000 });

  // Scenario C: controller fault diagnosis -> repair workorder approval without incident.
  await page.goto("http://127.0.0.1:4173/#/copilot");
  await page.getByRole("button", { name: /重新开始/ }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /重新开始/ }).click();
  await page.locator("[data-copilot-scenario]").first().waitFor();
  await page.locator('[data-copilot-scenario="C-controller-fault-diagnosis"]').click();
  await page.getByRole("button", { name: /运行 Copilot/ }).click();
  await page.getByRole("button", { name: "派发工单（人工确认）" }).waitFor();
  await page.getByText(/维修工单派发/).waitFor();
  assert.ok((await page.locator(".copilot-evidence li").count()) >= 3, "scenario C cited evidence");
  await page.getByRole("button", { name: "派发工单（人工确认）" }).click();
  await page.waitForURL(/#\/station/, { timeout: 15000 });

  // Scenario D: insufficient data -> safe abstention.
  await page.goto("http://127.0.0.1:4173/#/copilot");
  await page.getByRole("button", { name: /重新开始/ }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /重新开始/ }).click();
  await page.locator("[data-copilot-scenario]").first().waitFor();
  await page.locator('[data-copilot-scenario="D-insufficient-data-safe-abstention"]').click();
  await page.getByRole("button", { name: /运行 Copilot/ }).click();
  await page.locator(".copilot-abstain").waitFor();
  assert.ok((await page.locator(".copilot-missing span").count()) >= 5, "scenario D missing fields");

  // Scenario E: gas release delay advisory — cite emergency-stop manual, no workorder.
  await page.goto("http://127.0.0.1:4173/#/copilot");
  await page.getByRole("button", { name: /重新开始/ }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /重新开始/ }).click();
  await page.locator("[data-copilot-scenario]").first().waitFor();
  await page.locator('[data-copilot-scenario="E-gas-release-delay-advisory"]').click();
  await page.getByRole("button", { name: /运行 Copilot/ }).click();
  await page.locator(".copilot-trace li").first().waitFor();
  assert.ok((await page.locator(".copilot-evidence li").count()) >= 1, "scenario E cited evidence");
  assert.equal(await page.getByRole("button", { name: "派发工单（人工确认）" }).count(), 0);

  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(__dirname, "../copilot-e2e.png"), fullPage: true });

  // Mobile Web: persistent navigation, human confirmation and downloadable audit evidence.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4173/#/home");
  await page.reload();
  await page.locator('[data-mobile-nav="copilot"]').waitFor();
  assert.equal(await page.locator('[data-mobile-nav="copilot"]').isVisible(), true);
  await page.locator('[data-mobile-nav="copilot"]').click();
  await page.locator('[data-copilot-scenario="A-false-alarm-paint-shop"]').waitFor();
  await page.locator('[data-copilot-scenario="A-false-alarm-paint-shop"]').click();
  await page.getByRole("button", { name: /运行 Copilot/ }).click();
  const dismissButton = page.getByRole("button", { name: "确认误报，不建事件" });
  await dismissButton.waitFor();
  assert.ok((await dismissButton.boundingBox()).height >= 44, "mobile approval target");
  await dismissButton.click();
  await page.getByText("已登记为误报").waitFor();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /导出可审计事件包/ }).click(),
  ]);
  const auditPack = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
  assert.equal(auditPack.schema_version, "fireops-audit-pack/v1");
  assert.equal(auditPack.human_decisions[0].value, "dismissed");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: path.join(__dirname, "../copilot-mobile-390x844.png"), fullPage: true });

  await browser.close();
  console.log("copilot e2e ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
