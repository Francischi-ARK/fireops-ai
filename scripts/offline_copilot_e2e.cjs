const assert = require("node:assert/strict");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(() => { window.FIREGUARD_API_BASE = "http://127.0.0.1:8999"; });
  await page.goto("http://127.0.0.1:4174/#/copilot", { waitUntil: "networkidle" });
  await page.getByText("离线评委演示", { exact: true }).waitFor();
  assert.equal(await page.getByText("无法连接后端").count(), 0);

  await page.getByRole("button", { name: "开始评委演示" }).click();
  await page.getByText("人工闸门 1/3", { exact: true }).waitFor();
  await page.getByRole("button", { name: "确认火警，建立处置事件" }).click();
  await page.getByText("人工闸门 2/3", { exact: true }).waitFor();
  await page.getByRole("button", { name: "派发工单（人工确认）" }).click();
  await page.getByText("人工闸门 3/3", { exact: true }).waitFor();
  await page.getByRole("button", { name: "核验反馈并归档" }).click();
  await page.getByText("离线评委演示已闭环", { exact: true }).waitFor();
  await page.screenshot({ path: "/tmp/fireops-offline-complete.png", fullPage: true });
  await browser.close();
  console.log("offline copilot e2e: ok");
})().catch((error) => { console.error(error); process.exitCode = 1; });
