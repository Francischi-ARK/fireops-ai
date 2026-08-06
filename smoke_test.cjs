const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

// ponytail: file:// blocks ES modules; SMOKE_APP_ROOT=http://127.0.0.1:4173/ runs against the local server.
const APP_ROOT = process.env.SMOKE_APP_ROOT || pathToFileURL(path.join(__dirname, "index.html")).href;
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

  await page.goto(APP_URL);
  await page.waitForLoadState("networkidle");
  await assertVisible(page.getByRole("heading", { name: "选择工作台" }));
  assert.equal(await page.locator("[data-workspace-link]").count(), 5);
  await page.screenshot({ path: path.join(__dirname, "workspaces-1440x1024.png") });
  await page.getByRole("link", { name: /消防监督检查工具/ }).click();
  assert.match(page.url(), /#\/inspections$/);
  await assertVisible(page.getByRole("heading", { name: "监督检查与隐患闭环" }));
  assert.equal(await page.locator(".system-strip").count(), 0);
  await assertVisible(page.getByRole("heading", { name: "皓源新能源（虚拟）" }));
  assert.equal(await page.locator("[data-company-id]").count(), 5);
  await assertVisible(page.locator(".plan-canvas img"));
  assert.equal(await page.locator(".map-pin").count(), 3);

  await page.getByRole("button", { name: /隐患 2/ }).click();
  assert.equal(await page.locator('[data-issue-card="hazard-02"]').getAttribute("class").then((value) => value.includes("selected")), true);

  await page.getByRole("tab", { name: "设备设施状态" }).click();
  assert.equal(await page.locator(".equipment-list > button").count(), 5);
  await page.getByRole("tab", { name: "隐患与整改" }).click();

  await page.getByRole("button", { name: /恒泽材料/ }).click();
  await assertVisible(page.getByRole("heading", { name: "恒泽材料（虚拟）" }));

  // CSV import -> validation -> deterministic score
  await page.getByRole("button", { name: "数据导入" }).click();
  const importDialog = page.locator("#import-dialog");
  await assertVisible(importDialog);
  const csvDir = path.join(__dirname, "demo-data");
  await page.locator("#csv-files").setInputFiles(
    ["enterprises.csv", "alarm_events.csv", "iot_devices.csv", "maintenance_records.csv", "findings.csv"].map((name) => path.join(csvDir, name)),
  );
  await importDialog.getByRole("button", { name: "校验并评分" }).click();
  await importDialog.locator(".import-result.success").waitFor({ state: "visible" });
  assert.match(await importDialog.locator(".import-result").textContent(), /58 分/);
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
  await workflowDialog.getByRole("button", { name: "发起专项复查" }).click();
  await assertVisible(page.getByText("专项复查已发起，操作记录已追加到时间线"));
  await workflowDialog.locator("button.dialog-secondary").click();

  await page.getByRole("link", { name: "AI 分析报告" }).click();
  assert.match(page.url(), /#\/analysis/);
  const editor = page.locator("#report-editor");
  await editor.fill(`${await editor.inputValue()}\n\n人工复核：已确认演示证据。`);
  await page.getByRole("button", { name: "保存修订" }).click();
  await assertVisible(page.getByText("报告修订已保存到当前演示会话"));
  await page.getByRole("button", { name: "重新生成" }).click();
  assert.match(await editor.inputValue(), /消防/);

  await page.goto(INSPECTION_URL);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(__dirname, "implementation-1440x1024.png") });
  await page.screenshot({ path: path.join(__dirname, "preview.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.waitForLoadState("networkidle");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await assertVisible(page.locator(".company-rail"));

  await browser.close();
  assert.deepEqual(errors, []);
  console.log("fire inspection workbench smoke test: ok");
}

async function assertVisible(locator) {
  assert.equal(await locator.isVisible(), true);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
