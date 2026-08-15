const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const APP_URL = "http://127.0.0.1:4173/#/copilot";

async function waitForTargetHeight(locator, minimum = 44) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const box = await locator.boundingBox();
    if (box?.height >= minimum) return box.height;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`mobile approval target is below ${minimum}px or not visible`);
}

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
  assert.equal(await page.locator("[data-copilot-scenario]").count(), 5);
  await page.screenshot({ path: path.join(__dirname, "../docs/images/judge-demo-entry.png") });

  // Judge demo: two guided approvals, automatic crew simulation, final human archive.
  await page.getByRole("button", { name: "开始评委演示" }).click();
  await page.getByText("人工闸门 1/3").waitFor();
  await page.getByRole("button", { name: "确认火警，建立处置事件" }).click();
  await page.getByText("人工闸门 2/3").waitFor();
  await page.getByRole("button", { name: "派发工单（人工确认）" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(__dirname, "../docs/images/judge-demo-approval.png") });
  await page.getByRole("button", { name: "派发工单（人工确认）" }).click();
  await page.waitForURL(/#\/incidents\?incident_id=/, { timeout: 15000 });
  await page.getByText("人工闸门 3/3").waitFor();
  await page.getByRole("button", { name: "核验反馈并归档" }).click();
  await page.getByText("评委演示闭环完成").waitFor();
  await page.screenshot({ path: path.join(__dirname, "../docs/images/judge-demo-complete-viewport.png") });
  await page.screenshot({ path: path.join(__dirname, "../docs/images/judge-demo-complete.png"), fullPage: true });

  await page.goto(APP_URL);
  await page.getByRole("button", { name: /重新开始/ }).click();
  await page.locator("[data-copilot-scenario]").first().waitFor();

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
  await page.getByRole("button", { name: "交接给班组并继续" }).waitFor();
  await page.getByRole("button", { name: "交接给班组并继续" }).click();
  // 人工交接后进入统一班组收件箱。
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
  await page.getByRole("button", { name: "交接给班组并继续" }).click();
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
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(__dirname, "../docs/images/copilot-desktop.png"), fullPage: true });

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
  assert.ok(await waitForTargetHeight(dismissButton) >= 44, "mobile approval target");
  await dismissButton.click();
  await page.getByText("已登记为误报").waitFor();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /导出可审计事件包/ }).click(),
  ]);
  const auditPack = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
  assert.equal(auditPack.schema_version, "fireops-audit-pack/v1");
  assert.equal(auditPack.human_decisions[0].value, "dismissed");
  assert.equal(auditPack.human_decisions[0].actor_id, "duty-demo");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: path.join(__dirname, "../copilot-mobile-390x844.png"), fullPage: true });

  await browser.close();
  console.log("copilot e2e ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
