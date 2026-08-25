"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");

const ROOT = "http://127.0.0.1:4173";
const mode = process.argv[2];

async function openReviewPage(browser, viewport = { width: 1440, height: 900 }) {
  const page = await browser.newPage({ viewport });
  await page.route("http://127.0.0.1:8000/**", (route) => route.abort());
  await page.goto(`${ROOT}/#/monitoring`);
  await page.waitForLoadState("domcontentloaded");
  return page;
}

async function testMonitoring(browser) {
  const page = await openReviewPage(browser);
  await page.getByText("评审演示模式 · 本地合成数据", { exact: true }).waitFor();
  await page.getByRole("button", { name: /进入电池车间/ }).click();
  const body = await page.locator("body").innerText();
  assert.equal(/Failed to fetch|后端未连接/.test(body), false, "raw connection errors must stay hidden");
  const eventIds = async () => page.locator("[data-monitoring-event]").evaluateAll((nodes) => nodes.map((node) => node.dataset.monitoringEvent));
  assert.deepEqual(await eventIds(), ["evt-fire-001", "evt-smoke-002", "evt-fault-003", "evt-restored-004", "evt-data-005"], "all filter must show the exact fixed fixture");

  await page.getByRole("button", { name: /待核实/ }).first().click();
  assert.deepEqual(await eventIds(), ["evt-fire-001", "evt-data-005"], "pending filter set is wrong");
  assert.equal(await page.locator('[data-monitoring-event]:not([data-status="pending"])').count(), 0);
  for (const [floor, points, devices] of [["全部楼层",1,3],["3F",0,0],["2F",1,3],["1F",0,0]]) {
    await page.getByRole("button", { name: floor, exact: true }).click();
    assert.match(await page.locator(".monitoring-floor-summary").innerText(), new RegExp(`${floor} · ${points} 个事件点.*${devices} 台关联设备`, "s"));
    assert.equal(await page.locator(".monitoring-event-pin").count(), points, `${floor} point set is wrong`);
    assert.equal(await page.locator(".monitoring-alarm-pin").count(), floor === "2F" || floor === "全部楼层" ? 1 : 0, `${floor} selected marker visibility is wrong`);
  }

  await page.getByRole("button", { name: /处理中/ }).first().click();
  assert.deepEqual(await eventIds(), ["evt-smoke-002", "evt-fault-003"], "processing filter set is wrong");
  await page.locator("[data-monitoring-event]").first().click();
  await page.locator('#monitoring-3d[data-spatial-level="factory"]').waitFor();
  await page.getByRole("button", { name: /进入电池车间/ }).click();

  await page.getByRole("button", { name: /模拟火警/ }).click();
  assert.match(await page.locator("[data-monitoring-event]").first().innerText(), /火警.*待核实/s);
  assert.equal(await page.locator(".monitoring-event-pin.active").count(), 1);
  await page.getByRole("tab", { name: "历史事件" }).press("Enter");
  assert.equal(await page.getByRole("tab", { name: "历史事件" }).getAttribute("aria-selected"), "true");
  assert.match(await page.locator('[data-monitoring-panel="history"]').innerText(), /电池车间.*本地模拟火警/s);

  await page.getByRole("button", { name: /模拟故障/ }).click();
  assert.match(await page.locator("[data-monitoring-event]").first().innerText(), /故障|待核实/);
  await page.getByRole("tab", { name: "历史事件" }).click();
  assert.match(await page.locator('[data-monitoring-panel="history"]').innerText(), /电池车间.*本地模拟故障/s);

  for (const [name, key, press] of [["信号趋势","trend","Enter"],["联动设备","devices","Space"],["历史事件","history","Enter"],["现场位置","location","Space"]]) {
    await page.getByRole("tab", { name }).press(press);
    assert.equal(await page.getByRole("tab", { name }).getAttribute("aria-selected"), "true");
    await page.locator(`[data-monitoring-panel="${({ 信号趋势: "trend", 联动设备: "devices", 历史事件: "history", 现场位置: "location" })[name]}"]`).waitFor();
    assert.match(await page.locator(`[data-monitoring-panel="${key}"]`).innerText(), /电池车间/);
  }

  for (const floor of ["全部楼层", "3F", "2F", "1F"]) {
    await page.getByRole("button", { name: floor, exact: true }).click();
    assert.equal(await page.getByRole("button", { name: floor, exact: true }).getAttribute("aria-pressed"), "true");
  }

  await page.evaluate(() => window.FireOpsReview.setMonitoringEvents(window.FireGuardEngine.monitoringEvents().filter((event) => event.status === "processing")));
  await page.getByRole("button", { name: /待核实/ }).first().click();
  await page.getByText("当前筛选暂无事件").waitFor();
  await page.getByRole("button", { name: "查看全部" }).click();
  assert.ok(await page.locator("[data-monitoring-event]").count() > 0, "empty-state recovery must restore all events");
  assert.equal(await page.getByRole("button", { name: /全部/ }).first().getAttribute("aria-pressed"), "true");

  await page.evaluate(() => window.FireOpsReview.setMonitoringEvents(window.FireGuardEngine.monitoringEvents()));
  await page.getByRole("button", { name: /待核实/ }).first().click();
  await page.locator('[data-monitoring-event="evt-fire-001"]').click();
  const eventCount = await page.locator("[data-monitoring-event]").count();
  await page.getByRole("button", { name: "进入 Copilot 核实处置" }).click();
  await page.waitForURL(/#\/copilot\?source_event=evt-fire-001$/);
  await page.goto(`${ROOT}/#/monitoring`);
  await page.getByRole("button", { name: /全部/ }).first().click();
  assert.equal(await page.locator("[data-monitoring-event]").count(), 5, "verification must not create a duplicate event");
  assert.equal(eventCount, 2, "pending fixture count changed before verification");

  await page.evaluate(() => window.FireOpsReview.setMonitoringEvents(window.FireGuardEngine.monitoringEvents()));
  await page.getByRole("button", { name: /待核实/ }).first().click();
  await page.locator('[data-monitoring-event="evt-fire-001"]').click();
  await page.getByRole("button", { name: "登记误报并关闭" }).click();
  await page.getByText("事件已恢复", { exact: true }).waitFor();
  assert.equal(await page.locator('[data-action="open-monitoring-copilot"], [data-action="dismiss-monitoring-event"]').count(), 0, "closed events must not expose verification actions");

  await page.evaluate(() => window.FireOpsReview.setMonitoringEvents(window.FireGuardEngine.monitoringEvents()));
  await page.getByRole("button", { name: /处理中/ }).first().click();
  await page.locator('[data-monitoring-event="evt-fault-003"]').click();
  await page.getByText("故障处理中", { exact: true }).waitFor();
  assert.equal(await page.locator('[data-action="open-monitoring-copilot"], [data-action="dismiss-monitoring-event"]').count(), 0, "processing faults must not expose fire actions");

  await page.getByRole("button", { name: /全部/ }).first().click();
  await page.locator('[data-monitoring-event="evt-restored-004"]').click();
  await page.getByText("事件已恢复", { exact: true }).waitFor();
  assert.equal(await page.locator('[data-action="open-monitoring-copilot"], [data-action="dismiss-monitoring-event"]').count(), 0, "restored events must not expose fire actions");
  await page.close();
}

async function testSpatial(browser) {
  const subpath = "fireops-ai";
  if (!fs.existsSync(subpath)) fs.symlinkSync(".", subpath, "dir");
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.route("http://127.0.0.1:8000/**", (route) => route.abort());
    await page.goto(`${ROOT}/${subpath}/#/monitoring`);
    await page.locator('#monitoring-3d[data-spatial-level="factory"][data-3d-state="ready"]').waitFor({ timeout: 10000 });
    assert.equal(await page.evaluate(() => performance.getEntriesByType("resource").some((entry) => entry.name.includes("/fireops-ai/assets/buildings/factory.glb"))), true, "scene did not request factory.glb from the deployment subpath");
    const response = await page.request.get(`${ROOT}/${subpath}/assets/buildings/factory.glb`);
    assert.equal(response.status(), 200, "factory.glb must resolve under the deployed subpath");
    await page.getByRole("button", { name: /进入电池车间/ }).click();
    await page.locator('[data-spatial-level="workshop"]').waitFor();
    assert.equal(await page.locator(".monitoring-floorplan").isVisible(), true);
    await page.getByRole("button", { name: "返回工厂总览" }).click();
    await page.locator('#monitoring-3d[data-spatial-level="factory"]').waitFor();
  } finally {
    if (fs.existsSync(subpath)) fs.unlinkSync(subpath);
  }

  const fallback = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await fallback.route("**/monitoring-3d.js*", (route) => route.abort());
  await fallback.route("http://127.0.0.1:8000/**", (route) => route.abort());
  await fallback.goto(`${ROOT}/#/monitoring`);
  await fallback.getByRole("button", { name: /进入电池车间/ }).last().waitFor({ timeout: 6000 });
  await fallback.getByRole("button", { name: /进入电池车间/ }).last().click();
  await fallback.locator('[data-spatial-level="workshop"]').waitFor();
  await fallback.close();
  await page.close();
}

async function testSurfaces(browser) {
  const owner = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await owner.route("http://127.0.0.1:8000/**", (route) => route.abort());
  await owner.goto(`${ROOT}/#/owner`);
  await owner.getByRole("heading", { name: "整改待办", exact: true }).waitFor();
  await owner.getByText(/接收防火巡查发现的隐患/).waitFor();
  const before = await owner.locator(".station-task-list button").count();
  await owner.getByRole("button", { name: /去防火巡查/ }).press("Enter");
  assert.match(owner.url(), /#\/inspections$/);
  assert.equal(before, 0, "empty action must not create a work order");

  await owner.goto(`${ROOT}/#/analysis/ent-004`);
  await owner.getByRole("heading", { name: /消防健康报告/ }).waitFor();
  assert.equal(await owner.locator("#report-editor").count(), 0, "empty report must not expose an editor");
  assert.equal(await owner.locator('[data-action="confirm-report"], [data-action="regenerate"]').count(), 0, "empty report must disable generation actions");
  await owner.getByRole("button", { name: "使用演示数据" }).click();
  await owner.locator("#report-editor").waitFor();
  assert.match(await owner.locator(".report-facts").innerText(), /触发规则\s*4.*累计扣分\s*42/s);
  assert.match(await owner.locator("#report-editor").getAttribute("value") || await owner.locator("#report-editor").textContent(), /消防健康指数为 58/);

  await owner.goto(`${ROOT}/#/copilot`);
  await owner.getByRole("button", { name: /开始评委演示/ }).waitFor();
  await owner.getByRole("button", { name: /开始评委演示/ }).click();
  await owner.getByRole("button", { name: "查看运行记录" }).waitFor({ timeout: 5000 });
  assert.match(await owner.getByRole("button", { name: "查看运行记录" }).getAttribute("class"), /primary-action/);
  assert.match(await owner.getByRole("button", { name: "下载原始 JSON" }).getAttribute("class"), /secondary-action/);
  await owner.getByRole("button", { name: "查看运行记录" }).click();
  const dialog = owner.locator("#run-record-dialog");
  await dialog.waitFor();
  assert.equal(await dialog.getAttribute("aria-labelledby"), "run-record-title");
  assert.equal(await dialog.locator("#run-record-title").innerText(), "运行记录");
  assert.deepEqual(await dialog.locator("[data-copilot-run-section] h3").allTextContents(), ["输入", "证据", "工具调用", "人工确认", "结果"]);
  assert.equal(await dialog.getByRole("button", { name: "下载原始 JSON" }).count(), 1);
  await dialog.getByRole("button", { name: "完成" }).click();

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await owner.setViewportSize(viewport);
    for (const route of ["monitoring", "owner", "analysis/ent-004", "copilot"]) {
      await owner.goto(`${ROOT}/#/${route}`);
      const overflow = await owner.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1, `${route} at ${viewport.width}px overflows by ${overflow}px`);
    }
    for (const key of ["Enter", "Space"]) {
      await owner.goto(`${ROOT}/#/owner`);
      await owner.waitForTimeout(700);
      const cta = owner.getByRole("button", { name: /去防火巡查/ });
      await cta.focus();
      const outline = await cta.evaluate((button) => getComputedStyle(button).outlineStyle);
      assert.notEqual(outline, "none", `${viewport.width}px primary action focus is not visible`);
      await cta.press(key);
      await owner.waitForURL(/#\/inspections$/);
    }
  }
  await owner.goto(`${ROOT}/#/monitoring`);
  const allFilter = owner.getByRole("button", { name: /全部/ }).first();
  await allFilter.press("Tab");
  const focused = await owner.evaluate(() => ({ tag: document.activeElement?.tagName, outline: getComputedStyle(document.activeElement).outlineStyle }));
  assert.equal(focused.tag, "BUTTON");
  assert.notEqual(focused.outline, "none", "keyboard focus must remain visible");
  await owner.close();
}

async function main() {
  assert.ok(["monitoring", "spatial", "surfaces"].includes(mode), "expected monitoring, spatial or surfaces mode");
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  if (mode === "monitoring") await testMonitoring(browser);
  else if (mode === "spatial") await testSpatial(browser);
  else await testSurfaces(browser);
  await browser.close();
  console.log(`semifinal M1 ${mode} e2e: ok`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
