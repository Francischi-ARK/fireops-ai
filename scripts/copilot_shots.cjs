const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const APP = "http://127.0.0.1:4173";
const API = "http://127.0.0.1:8000";
const TIMELINE = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/submission/video/timeline.json"), "utf8"));
const OUTPUT = path.join(ROOT, "docs/submission/video/shots");
const SVG_DIR = process.env.FIREOPS_DECK_SVG_DIR;
const START_AT = process.env.FIREOPS_SHOT_START;
const ONLY = process.env.FIREOPS_SHOT_ONLY;
let rectificationWorkorderId = null;
let faultWorkorderId = null;

function resetDemo() {
  const result = spawnSync(
    path.join(ROOT, "backend/.venv/bin/python"),
    [path.join(ROOT, "backend/tests/reset_demo_database.py")],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        FIREGUARD_DATABASE_URL: "postgresql://fireguard:fireguard-demo@127.0.0.1:54330/fireguard",
        PYTHONPATH: path.join(ROOT, "backend"),
      },
      encoding: "utf8",
    },
  );
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "demo reset failed");
}

async function highlight(locator) {
  await locator.evaluate((element) => {
    element.style.outline = "4px solid #f4a62a";
    element.style.outlineOffset = "4px";
    element.style.boxShadow = "0 0 0 10px rgba(244,166,42,.16)";
    element.scrollIntoView({ block: "center", inline: "center" });
  });
}

async function addVideoOverlay(page, cue) {
  await page.evaluate(({ title, subtitle }) => {
    document.querySelector("#fireops-video-overlay")?.remove();
    const isSvg = document.documentElement.namespaceURI === "http://www.w3.org/2000/svg";
    if (isSvg) {
      const ns = "http://www.w3.org/2000/svg";
      const group = document.createElementNS(ns, "g");
      group.id = "fireops-video-overlay";
      const parts = [
        ["rect", { x: 1120, y: 34, width: 740, height: 62, rx: 10, fill: "#071018", "fill-opacity": 0.88, stroke: "#263843" }],
        ["text", { x: 1828, y: 76, "text-anchor": "end", "font-family": "Hiragino Sans GB", "font-size": 30, "font-weight": 600, fill: "#F4A62A" }, title],
        ["rect", { x: 120, y: 952, width: 1680, height: 86, rx: 10, fill: "#071018", "fill-opacity": 0.90, stroke: "#263843" }],
        ["text", { x: 960, y: 1008, "text-anchor": "middle", "font-family": "Hiragino Sans GB", "font-size": 42, fill: "#FFFFFF" }, subtitle],
      ];
      for (const [tag, attrs, text] of parts) {
        const element = document.createElementNS(ns, tag);
        for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
        if (text) element.textContent = text;
        group.appendChild(element);
      }
      document.documentElement.appendChild(group);
      return;
    }
    const overlay = document.createElement("div");
    overlay.id = "fireops-video-overlay";
    overlay.innerHTML = `<div class="fireops-video-title"></div><div class="fireops-video-subtitle"></div>`;
    overlay.querySelector(".fireops-video-title").textContent = title;
    overlay.querySelector(".fireops-video-subtitle").textContent = subtitle;
    const style = document.createElement("style");
    style.textContent = `
      #fireops-video-overlay{position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:"Hiragino Sans GB",sans-serif}
      .fireops-video-title{position:absolute;right:60px;top:34px;min-width:640px;padding:15px 28px;text-align:right;color:#f4a62a;background:rgba(7,16,24,.9);border:1px solid #263843;border-radius:10px;font-size:30px;font-weight:600}
      .fireops-video-subtitle{position:absolute;left:120px;right:120px;bottom:42px;padding:18px 32px;text-align:center;color:#fff;background:rgba(7,16,24,.92);border:1px solid #263843;border-radius:10px;font-size:42px;line-height:1.15}
    `;
    overlay.appendChild(style);
    document.body.appendChild(overlay);
  }, { title: cue.title, subtitle: cue.subtitle });
}

async function main() {
  assert.equal(await fetch(`${API}/health`).then((response) => response.ok), true, "backend health");
  assert.ok(SVG_DIR && fs.existsSync(SVG_DIR), "set FIREOPS_DECK_SVG_DIR to the final SVG directory");
  if (!START_AT && !ONLY) resetDemo();
  fs.mkdirSync(OUTPUT, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on("pageerror", (error) => console.error(`pageerror: ${error}`));

  const handlers = {
    cover: async () => page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:#071018}img{display:block;width:1920px;height:1080px}</style><img src="data:image/svg+xml;base64,${fs.readFileSync(path.join(SVG_DIR, "P01-cover.svg"), "base64")}">`),
    monitoring: async () => {
      await page.goto(`${APP}/#/monitoring`);
      const button = page.getByRole("button", { name: /模拟火警帧/ });
      await button.waitFor();
      await page.waitForTimeout(2200);
      await highlight(button);
    },
    fire_verify: async () => {
      await page.getByRole("button", { name: /模拟火警帧/ }).click();
      await page.waitForURL(/#\/incidents\?enterprise_id=ent-001&event_id=\d+/);
      const button = page.getByRole("button", { name: /确认火警/ });
      await button.waitFor({ timeout: 15000 });
      await highlight(button);
    },
    fire_dispatch: async () => {
      await page.getByRole("button", { name: /确认火警/ }).click();
      const button = page.getByRole("button", { name: /派发工单/ });
      await button.waitFor({ timeout: 15000 });
      await highlight(button);
      return async () => {
        await button.click();
        await page.locator(".dispatch-card").waitFor({ timeout: 15000 });
      };
    },
    crew_arrival: async () => {
      await page.goto(`${APP}/#/station`);
      await page.locator("#terminal-crew-select").selectOption("crew-wx-01");
      for (const label of ["签收任务", "确认出动", "确认到场"]) {
        const button = page.getByRole("button", { name: label });
        await button.waitFor({ timeout: 15000 });
        await button.click();
      }
      const report = page.locator(".first-report");
      await report.waitFor({ timeout: 15000 });
      await highlight(report);
    },
    first_report: async () => {
      await page.locator("#report-situation").fill("现场确认无人员被困，已完成初期处置并持续监护。");
      await page.locator("#report-people").selectOption("no_risk");
      await page.getByRole("button", { name: "提交反馈" }).click();
      const report = page.locator(".report-received");
      await report.waitFor({ timeout: 15000 });
      await highlight(report);
    },
    copilot_evidence: async () => {
      await page.goto(`${APP}/#/copilot`);
      await page.locator('[data-copilot-scenario="C-controller-fault-diagnosis"]').waitFor();
      await page.locator('[data-copilot-scenario="C-controller-fault-diagnosis"]').click();
      await page.getByRole("button", { name: /运行 Copilot/ }).click();
      const evidence = page.locator(".copilot-evidence");
      await evidence.waitFor({ timeout: 15000 });
      await highlight(evidence);
    },
    fault_draft: async () => {
      await page.goto(`${APP}/#/monitoring`);
      await page.getByRole("button", { name: /模拟主机故障/ }).click();
      await page.waitForURL(/#\/station/, { timeout: 15000 });
      const item = page.locator('[data-inbox-select^="workorder-"]').first();
      await item.waitFor({ timeout: 15000 });
      faultWorkorderId = Number((await item.getAttribute("data-inbox-select")).replace("workorder-", ""));
      await item.click();
      const button = page.getByRole("button", { name: "确认派发（人工）" });
      await button.waitFor({ timeout: 15000 });
      await highlight(button);
    },
    fault_done: async () => {
      await page.getByRole("button", { name: "确认派发（人工）" }).click();
      await page.getByRole("button", { name: "开始处理" }).waitFor({ timeout: 15000 });
      await page.getByRole("button", { name: "开始处理" }).click();
      await page.getByRole("button", { name: "完成核验（人工）" }).waitFor({ timeout: 15000 });
      await page.getByRole("button", { name: "完成核验（人工）" }).click();
      let completed = false;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const workorders = await fetch(`${API}/workorders`).then((response) => response.json());
        if (workorders.items.find((item) => item.id === faultWorkorderId)?.status === "done") {
          completed = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      assert.equal(completed, true, "fault workorder reached done");
      await page.goto(`${APP}/#/station`);
      await page.locator("#terminal-crew-select").selectOption("crew-wb-01");
      const item = page.locator(`[data-inbox-select="workorder-${faultWorkorderId}"]`);
      await item.waitFor({ timeout: 15000 });
      await item.click();
      const done = page.locator(".station-task-detail .report-received");
      await done.waitFor({ timeout: 15000 });
      await highlight(done);
    },
    inspection_draft: async () => {
      await page.goto(`${APP}/#/inspections?enterprise_id=ent-001`);
      await page.getByRole("button", { name: "新建巡查识别" }).click();
      await page.getByRole("button", { name: "识别隐患草稿" }).click();
      await page.locator(".inspect-draft-card").waitFor({ timeout: 15000 });
      const button = page.getByRole("button", { name: "确认派发网格责任人" });
      await highlight(button);
      return async () => {
        await button.click();
        await page.waitForURL(/#\/owner/, { timeout: 15000 });
      };
    },
    owner_rectification: async () => {
      const item = page.locator('[data-inbox-select^="workorder-"]').first();
      rectificationWorkorderId = Number((await item.getAttribute("data-inbox-select")).replace("workorder-", ""));
      await page.getByRole("button", { name: "开始整改" }).click();
      const button = page.getByRole("button", { name: "标记整改完成（待复查）" });
      await button.waitFor({ timeout: 15000 });
      await highlight(button);
      return async () => button.click();
    },
    inspection_closed: async () => {
      const findings = await fetch(`${API}/inspection/findings?enterprise_id=ent-001`).then((response) => response.json());
      const finding = findings.items.find((item) => item.workorder_id === rectificationWorkorderId) || findings.items[0];
      await page.goto(`${APP}/#/inspections?enterprise_id=ent-001&finding_id=${finding.id}&workorder_id=${rectificationWorkorderId}`);
      const card = page.locator(`[data-issue-card="finding-${finding.id}"]`);
      await card.waitFor({ timeout: 15000 });
      await card.locator('[data-action="reinspect"]').click();
      await page.getByRole("button", { name: "复查通过并闭环" }).click();
      const closed = page.getByText(new RegExp(`隐患 #${finding.id} 复查通过`));
      await closed.waitFor({ timeout: 15000 });
      await highlight(closed);
    },
    dossier: async () => {
      await page.goto(`${APP}/#/enterprises/ent-001`);
      const dossier = page.locator(".enterprise-dossier");
      await dossier.waitFor({ timeout: 15000 });
      await highlight(page.locator(".dossier-flow"));
    },
    safe_abstention: async () => {
      await page.goto(`${APP}/#/copilot`);
      await page.locator('[data-copilot-scenario="D-insufficient-data-safe-abstention"]').waitFor();
      await page.locator('[data-copilot-scenario="D-insufficient-data-safe-abstention"]').click();
      await page.getByRole("button", { name: /运行 Copilot/ }).click();
      const abstain = page.locator(".copilot-abstain");
      await abstain.waitFor({ timeout: 15000 });
      await highlight(abstain);
    },
    closing: async () => page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:#071018}img{display:block;width:1920px;height:1080px}</style><img src="data:image/svg+xml;base64,${fs.readFileSync(path.join(SVG_DIR, "P12-ending.svg"), "base64")}">`),
  };

  const startIndex = START_AT ? TIMELINE.cues.findIndex((cue) => cue.id === START_AT) : 0;
  assert.ok(startIndex >= 0, `unknown FIREOPS_SHOT_START: ${START_AT}`);
  const cues = ONLY ? TIMELINE.cues.filter((cue) => cue.id === ONLY) : TIMELINE.cues.slice(startIndex);
  assert.ok(cues.length, `unknown FIREOPS_SHOT_ONLY: ${ONLY}`);
  for (const cue of cues) {
    const handler = handlers[cue.capture];
    assert.ok(handler, `missing capture handler: ${cue.capture}`);
    const after = await handler();
    await addVideoOverlay(page, cue);
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(OUTPUT, `${cue.id}.png`), fullPage: false });
    if (after) await after();
    console.log(`captured ${cue.id}`);
  }

  await browser.close();
  console.log(`shots: ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
