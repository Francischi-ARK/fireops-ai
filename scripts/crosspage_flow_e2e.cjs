/**
 * 跨页中枢闭环：监测火警 → 核实台 → 派单 → 班组签收
 * 需 4173 + 8000，且班组 crew-wx-01 处于 available。
 */
const assert = require("node:assert/strict");
const { execSync } = require("node:child_process");
const { chromium } = require("playwright");

const ROOT = "http://127.0.0.1:4173";
const API = "http://127.0.0.1:8000";

function resetDemoDb() {
  try {
    execSync(
      `docker exec fireops-postgres psql -U fireguard -d fireguard -c "TRUNCATE incident_timeline, dispatch_reports, incident_dispatches, fire_incidents, signal_verifications, monitoring_events, copilot_runs, ops_workorders, inspection_findings RESTART IDENTITY CASCADE; UPDATE fire_stations SET status='available';"`,
      { stdio: "ignore" },
    );
  } catch {
    // 无 Docker 时跳过；依赖人工清库
  }
}

async function main() {
  // 预检 API
  const health = await fetch(`${API}/health`).then((r) => r.json());
  assert.equal(health.status, "ok", "backend health");
  resetDemoDb();

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.goto(`${ROOT}/#/monitoring`);
  await page.getByRole("button", { name: /模拟火警帧/ }).waitFor();
  await page.getByRole("button", { name: /模拟火警帧/ }).click();

  // 应跳转到核实台并出现待核实信号
  await page.waitForURL(/#\/incidents/);
  await page.getByRole("heading", { name: /报警核实与工单派发台/ }).waitFor();
  await page.getByRole("button", { name: /确认火警/ }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /确认火警/ }).click();

  // 派发工单
  await page.locator("#dispatch-station").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /派发工单/ }).click();
  await page.locator(".dispatch-card").waitFor({ timeout: 15000 });

  // 班组终端应看到处置工单
  await page.goto(`${ROOT}/#/station`);
  await page.locator("#terminal-crew-select").waitFor();
  await page.locator("#terminal-crew-select").selectOption("crew-wx-01");
  await page.locator("[data-inbox-select]").first().waitFor({ timeout: 15000 });
  assert.ok((await page.locator("[data-inbox-select]").count()) >= 1, "crew inbox has items");

  // 故障链路：注入故障 → 跳转维保组收件箱
  await page.goto(`${ROOT}/#/monitoring`);
  await page.getByRole("button", { name: /模拟主机故障/ }).click();
  await page.waitForURL(/#\/station/, { timeout: 15000 });
  await page.waitForTimeout(800);
  const crew = await page.locator("#terminal-crew-select").inputValue();
  assert.equal(crew, "crew-wb-01");
  await page.getByText(/维修|维保|故障/).first().waitFor({ timeout: 15000 });

  assert.deepEqual(errors, []);
  await browser.close();
  console.log("crosspage flow e2e ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
