/**
 * 跨页中枢闭环：监测火警 → 核实台 → 派单 → 班组签收
 * 需 4173 + 8000，且班组 crew-wx-01 处于 available。
 */
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const ROOT = "http://127.0.0.1:4173";
const API = "http://127.0.0.1:8000";

async function waitForOverview(predicate, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const overview = await fetch(`${API}/incidents/overview`).then((response) => response.json());
    if (predicate(overview)) return overview;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("incident overview did not reach the expected state");
}

async function main() {
  // 预检 API
  const health = await fetch(`${API}/health`).then((r) => r.json());
  assert.equal(health.status, "ok", "backend health");

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
  await page.waitForURL(/#\/incidents\?enterprise_id=ent-001&event_id=\d+/);
  const fireEventId = Number(new URL(page.url()).hash.match(/event_id=(\d+)/)[1]);
  await page.getByRole("heading", { name: /报警核实与工单派发台/ }).waitFor();
  await page.getByRole("button", { name: /确认火警/ }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /确认火警/ }).click();

  // 派发工单
  await page.locator("#dispatch-station").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /派发工单/ }).click();
  await page.locator(".dispatch-card").waitFor({ timeout: 15000 });

  // 班组终端应看到处置工单
  await page.goto(`${ROOT}/#/station`);
  await page.locator("#demo-actor").selectOption("crew-demo");
  await page.locator("#terminal-crew-select").waitFor();
  await page.locator("#terminal-crew-select").selectOption("crew-wx-01");
  await page.locator("[data-inbox-select]").first().waitFor({ timeout: 15000 });
  assert.ok((await page.locator("[data-inbox-select]").count()) >= 1, "crew inbox has items");

  // 班组签收 → 出动 → 到场 → 首报，形成完整处置时间线。
  for (const label of ["签收任务", "确认出动", "确认到场"]) {
    const button = page.getByRole("button", { name: label });
    await button.waitFor({ timeout: 15000 });
    await button.click();
  }
  await page.locator("#report-situation").waitFor({ timeout: 15000 });
  await page.locator("#report-situation").fill("现场确认无人员被困，已完成初期处置并持续监护。");
  await page.locator("#report-people").selectOption("no_risk");
  await page.getByRole("button", { name: "提交反馈" }).click();
  const incidentOverview = await waitForOverview((overview) => overview.incidents.some((item) => item.source_event_id === fireEventId && item.report));
  const completedIncident = incidentOverview.incidents.find((item) => item.source_event_id === fireEventId);
  assert.equal(completedIncident.dispatch.status, "arrived");
  assert.match(completedIncident.report.situation, /无人员被困/);

  // 流程监管给出下一责任人；值班员核验反馈后归档并释放班组。
  await page.goto(`${ROOT}/#/workflow`);
  await page.locator(`[data-workflow-continue][data-incident-id="${completedIncident.id}"]`).click();
  await page.waitForURL(/#\/incidents/);
  await page.getByRole("button", { name: "核验反馈并归档" }).click();
  const closedOverview = await waitForOverview((overview) => overview.incidents.some((item) => item.id === completedIncident.id && item.status === "closed"));
  assert.equal(closedOverview.stations.find((item) => item.id === "crew-wx-01").status, "available");

  // 故障链路：注入故障 → 跳转维保组收件箱
  await page.goto(`${ROOT}/#/monitoring`);
  await page.locator("#demo-actor").selectOption("duty-demo");
  await page.getByRole("button", { name: /模拟主机故障/ }).click();
  await page.waitForURL(/#\/station/, { timeout: 15000 });
  await page.waitForTimeout(800);
  const crew = await page.locator("#terminal-crew-select").inputValue();
  assert.equal(crew, "crew-wb-01");
  await page.getByText(/维修|维保|故障/).first().waitFor({ timeout: 15000 });
  const repairItem = page.locator('[data-inbox-select^="workorder-"]').first();
  await repairItem.waitFor({ timeout: 15000 });
  const repairWorkorderId = Number((await repairItem.getAttribute("data-inbox-select")).replace("workorder-", ""));
  await repairItem.click();
  await page.getByRole("button", { name: "确认派发（人工）" }).click();
  await page.locator("#demo-actor").selectOption("crew-demo");
  await page.getByRole("button", { name: "开始处理" }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "开始处理" }).click();
  await page.getByRole("button", { name: "完成核验（人工）" }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "完成核验（人工）" }).click();
  await page.waitForTimeout(500);
  const repairWorkorders = await fetch(`${API}/workorders`).then((response) => response.json());
  assert.equal(repairWorkorders.items.find((item) => item.id === repairWorkorderId).status, "done");

  // 巡查识别 → 人工派发 → 网格整改 → 复查关闭。
  await page.goto(`${ROOT}/#/inspections?enterprise_id=ent-001`);
  await page.locator("#demo-actor").selectOption("inspector-demo");
  await page.getByRole("button", { name: "新建巡查识别" }).click();
  await page.getByRole("button", { name: "识别隐患草稿" }).click();
  await page.locator(".inspect-draft-card").waitFor({ timeout: 15000 });
  assert.match(await page.locator(".inspect-draft-card").innerText(), /local-demo \/ deterministic-image-catalog-v1/);
  await page.getByRole("button", { name: "确认派发网格责任人" }).click();
  await page.waitForURL(/#\/owner/, { timeout: 15000 });
  await page.locator("#demo-actor").selectOption("owner-demo");
  await page.getByRole("button", { name: "开始整改" }).waitFor({ timeout: 15000 });
  const ownerItem = page.locator('[data-inbox-select^="workorder-"]').first();
  const rectificationWorkorderId = Number((await ownerItem.getAttribute("data-inbox-select")).replace("workorder-", ""));
  await page.getByRole("button", { name: "开始整改" }).click();
  await page.getByRole("button", { name: "标记整改完成（待复查）" }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "标记整改完成（待复查）" }).click();
  const findings = await fetch(`${API}/inspection/findings?enterprise_id=ent-001`).then((response) => response.json());
  const finding = findings.items.find((item) => item.workorder_id === rectificationWorkorderId) || findings.items[0];
  assert.ok(finding?.id, "rectification finding is traceable");
  await page.goto(`${ROOT}/#/inspections?enterprise_id=ent-001&finding_id=${finding.id}&workorder_id=${rectificationWorkorderId}`);
  await page.locator("#demo-actor").selectOption("inspector-demo");
  const findingCard = page.locator(`[data-issue-card="finding-${finding.id}"]`);
  await findingCard.waitFor({ timeout: 15000 });
  await findingCard.locator('[data-action="reinspect"]').click();
  await page.getByRole("button", { name: "复查通过并闭环" }).click();
  await page.getByText(new RegExp(`隐患 #${finding.id} 复查通过`)).waitFor({ timeout: 15000 });
  const closedFinding = await fetch(`${API}/inspection/findings?enterprise_id=ent-001`).then((response) => response.json());
  assert.equal(closedFinding.items.find((item) => item.id === finding.id).status, "closed");

  assert.deepEqual(errors, []);
  await browser.close();
  console.log("crosspage flow e2e ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
