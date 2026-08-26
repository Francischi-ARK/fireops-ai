const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

// ponytail: file:// blocks ES modules; SMOKE_APP_ROOT=http://127.0.0.1:4173/ runs against the local server.
const APP_ROOT = process.env.SMOKE_APP_ROOT || pathToFileURL(path.join(__dirname, "../index.html")).href;
const APP_URL = `${APP_ROOT}#/home`;
const INSPECTION_URL = `${APP_ROOT}#/inspections`;

async function main() {
  const errors = [];
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(String(error)));

  try {
  await page.goto(APP_URL);
  await page.waitForLoadState("domcontentloaded");
  await assertVisible(page.getByRole("heading", { name: "消控室值班员工作台" }));
  assert.equal(await page.locator(".role-scope-notice").count(), 0, "hidden dialog controls must not produce a page-level permission warning");
  assert.deepEqual(await page.locator(".primary-nav a:not([hidden])").allTextContents(), ["首页", "应急处置", "日常防控", "分析复盘", "资产与空间"]);
  assert.equal(await page.locator("[data-workspace-link]").count(), 4);
  await page.screenshot({ path: path.join(__dirname, "../workspaces-1440x1024.png") });

  await page.getByRole("button", { name: "评委模式" }).click();
  const judgeTour = page.locator("#judge-tour");
  await assertVisible(judgeTour.getByRole("heading", { name: "报警接入与定位" }));
  assert.match(page.url(), /#\/monitoring$/);
  await page.locator('#judge-tour[data-step-index="1"]').waitFor({ state: "visible", timeout: 5000 });
  await assertVisible(judgeTour.getByRole("heading", { name: "AI 研判与证据补全" }));
  assert.match(page.url(), /#\/copilot$/);
  await judgeTour.getByRole("button", { name: "暂停" }).click();
  await judgeTour.getByRole("button", { name: "下一步" }).click();
  await assertVisible(judgeTour.getByRole("heading", { name: "巡查人员现场核实" }));
  assert.match(page.url(), /#\/monitoring$/);
  assert.equal(await page.locator("#demo-actor").inputValue(), "fire_patrol");
  for (const [title, route, role] of [
    ["消控室升级并调派", /#\/copilot$/, "control_room_operator"],
    ["消防队签收并到场", /#\/station\?crew_id=crew-wx-01$/, "full_time_fire_brigade"],
    ["现场反馈与人工归档", /#\/incidents$/, "control_room_operator"],
    ["流程闭环与出警报告", /#\/workflow$/, "control_room_operator"],
    ["管理层复盘", /#\/review\/OFFLINE-INC-001$/, "company_management"],
  ]) {
    await judgeTour.getByRole("button", { name: "下一步" }).click();
    await assertVisible(judgeTour.getByRole("heading", { name: title }));
    assert.match(page.url(), route);
    assert.equal(await page.locator("#demo-actor").inputValue(), role);
  }
  assert.equal(await judgeTour.getByRole("button", { name: "下一步" }).isDisabled(), true);
  await judgeTour.getByRole("button", { name: "退出演示" }).click();
  await assertVisible(page.getByRole("heading", { name: "消控室值班员工作台" }));

  await page.goto(`${APP_ROOT}#/review/OFFLINE-INC-001`);
  const reviewHeading = page.getByRole("heading", { name: "出警报告与战评准备" });
  assert.equal(await reviewHeading.count(), 1, "出警报告与战评准备 page should exist");
  await assertVisible(reviewHeading);
  assert.equal(await page.locator("[data-review-participant]").count(), 5);
  await page.getByRole("button", { name: "确认并生成会议邀请草稿" }).click();
  await assertVisible(page.getByRole("button", { name: "会议邀请草稿已确认", exact: true }));
  await page.getByRole("button", { name: "确认出警报告" }).click();
  await assertVisible(page.getByRole("button", { name: "出警报告已确认", exact: true }));

  await page.locator("#demo-actor").selectOption("maintenance_contractor");
  await assertVisible(page.getByRole("heading", { name: "消防维保单位工作台" }));
  assert.deepEqual(await page.locator(".primary-nav a:not([hidden])").allTextContents(), ["首页", "设施运维"]);
  await page.goto(`${APP_ROOT}#/incidents`);
  await assertVisible(page.getByRole("heading", { name: "当前角色无权进入此模块" }));

  await page.goto(APP_URL);
  await page.locator("#demo-actor").selectOption("company_management");
  await assertVisible(page.getByRole("heading", { name: "全厂消防态势" }));
  assert.equal(await page.locator("[data-management-kpi]").count(), 4);
  assert.equal(await page.locator("[data-workshop-risk-row]").count(), 5);
  assert.deepEqual(await page.locator(".primary-nav a:not([hidden])").allTextContents(), ["首页", "应急处置", "日常防控", "设施运维", "分析复盘", "资产与空间"]);
  await page.goto(`${APP_ROOT}#/analysis/ent-001`);
  await assertVisible(page.locator(".role-scope-notice"));
  assert.equal(await page.getByRole("button", { name: "保存修订" }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "确认报告" }).isDisabled(), true);
  await page.goto(APP_URL);
  await page.locator("#demo-actor").selectOption("full_time_fire_brigade");
  assert.deepEqual(await page.locator(".primary-nav a:not([hidden])").allTextContents(), ["首页", "应急处置", "资产与空间"]);
  await page.locator("#demo-actor").selectOption("fire_patrol");
  await page.goto(APP_URL);
  await page.locator(".workspace-card", { hasText: "日常防控" }).click();
  assert.match(page.url(), /#\/inspections$/);
  await assertVisible(page.getByRole("heading", { name: "防火巡查与隐患闭环" }));
  assert.equal(await page.locator(".system-strip").count(), 0);
  await assertVisible(page.getByRole("heading", { name: "电池车间（PACK/化成）" }));
  assert.equal(await page.locator("[data-company-id]").count(), 5);
  await assertVisible(page.locator(".plan-canvas img"));
  assert.equal(await page.locator(".map-pin").count(), 3);

  await page.getByRole("button", { name: /隐患 2/ }).click();
  assert.equal(await page.locator('[data-issue-card="hazard-02"]').getAttribute("class").then((value) => value.includes("selected")), true);

  await page.getByRole("tab", { name: "设备设施状态" }).click();
  assert.equal(await page.locator(".equipment-list > button").count(), 5);
  await page.getByRole("tab", { name: "隐患与整改" }).click();

  // CSV import -> validation -> deterministic score
  await page.getByRole("button", { name: "数据导入" }).click();
  const importDialog = page.locator("#import-dialog");
  await assertVisible(importDialog);
  const csvDir = path.join(__dirname, "../demo-data");
  await page.locator("#csv-files").setInputFiles(
    ["enterprises.csv", "alarm_events.csv", "iot_devices.csv", "maintenance_records.csv", "findings.csv"].map((name) => path.join(csvDir, name)),
  );
  await importDialog.getByRole("button", { name: "校验并评分" }).click();
  await importDialog.locator(".import-result.success, .import-result.error").waitFor({ state: "visible" });
  const importResult = await importDialog.locator(".import-result").textContent();
  assert.equal(await importDialog.locator(".import-result.success").count(), 1, importResult);
  assert.match(importResult, /导入成功：\d+ 分/);
  await importDialog.getByRole("button", { name: "取消" }).click();

  // evidence modal
  await page.locator('[data-action="open-evidence"]').first().click();
  const evidenceDialog = page.locator("#evidence-dialog");
  await assertVisible(evidenceDialog.locator("img"));
  await evidenceDialog.locator("[data-dialog-close]").click();

  // workflow timeline + start reinspection
  await page.locator('[data-action="reinspect"]').first().click();
  const workflowDialog = page.locator("#workflow-dialog");
  await assertVisible(workflowDialog.locator(".workflow-timeline"));
  await workflowDialog.getByRole("button", { name: "复查通过并闭环" }).click();
  await assertVisible(page.getByText("演示隐患无后端记录，已本地标记复查发起"));
  await workflowDialog.locator("button.dialog-secondary").click();

  await page.locator("#demo-actor").selectOption("control_room_operator");
  await page.getByRole("link", { name: "AI 分析报告" }).click();
  assert.match(page.url(), /#\/analysis/);
  const editor = page.locator("#report-editor");
  await editor.fill(`${await editor.inputValue()}\n\n人工复核：已确认演示证据。`);
  await page.getByRole("button", { name: "保存修订" }).click();
  await assertVisible(page.getByText("报告修订已保存到当前演示会话"));
  await page.getByRole("button", { name: "重新生成" }).click();
  assert.match(await editor.inputValue(), /消防/);

  await page.goto(INSPECTION_URL);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(__dirname, "../implementation-1440x1024.png") });
  await page.screenshot({ path: path.join(__dirname, "../preview.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await assertVisible(page.locator(".company-rail"));
  await page.goto(APP_URL);
  await page.getByRole("button", { name: "评委模式" }).click();
  await page.locator("#judge-tour").getByRole("button", { name: "暂停" }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await assertVisible(page.locator("#judge-tour").getByRole("heading", { name: "报警接入与定位" }));
  await page.locator("#judge-tour").getByRole("button", { name: "退出演示" }).click();
  } finally {
  await browser.close();
  }
  assert.deepEqual(errors, []);
  console.log("FireOps workbench smoke test: ok");
}

async function assertVisible(locator) {
  assert.equal(await locator.isVisible(), true);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
