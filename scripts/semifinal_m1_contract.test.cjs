"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const engine = require("../engine.cjs");

const mode = process.argv[2];

if (mode === "monitoring") {
  assert.equal(typeof engine.monitoringEvents, "function", "monitoring fixture helper is missing");
  assert.equal(typeof engine.filterMonitoringEvents, "function", "monitoring filter helper is missing");
  assert.equal(typeof engine.createMonitoringEvent, "function", "offline event helper is missing");

  const events = engine.monitoringEvents();
  assert.ok(events.length >= 5, "fixed review fixture needs at least five events");
  for (const event of events) {
    assert.ok(event.floor && event.point && event.devices?.length, "each event needs floor, point and devices");
  }
  assert.ok(engine.filterMonitoringEvents(events, "pending").every((event) => event.status === "pending"));
  assert.ok(engine.filterMonitoringEvents(events, "processing").every((event) => event.status === "processing"));

  const created = engine.createMonitoringEvent(events, "fault", "ent-001");
  assert.equal(created[0].type, "fault");
  assert.equal(created[0].status, "pending");
  assert.equal(created.length, events.length + 1);
  assert.equal(events.length, engine.monitoringEvents().length, "fixture must not be mutated");
  console.log("semifinal M1 monitoring contract: ok");
} else if (mode === "spatial") {
  assert.equal(fs.existsSync("assets/buildings/factory.glb"), true, "factory.glb is missing");
  assert.ok(fs.statSync("assets/buildings/factory.glb").size > 1000, "factory.glb is empty");
  const app = fs.readFileSync("app.js", "utf8");
  const scene = fs.readFileSync("monitoring-3d.js", "utf8");
  assert.match(app, /data-enter-workshop="ent-001"/, "factory overview needs a battery-workshop action");
  assert.match(app, /data-return-factory/, "workshop needs a return action");
  assert.match(scene, /assets\/buildings\/factory\.glb/, "scene must load the factory GLB");
  assert.equal(new URL("assets/buildings/factory.glb", "https://example.test/fireops-ai/").pathname, "/fireops-ai/assets/buildings/factory.glb", "GLB path must remain subpath-safe");
  console.log("semifinal M1 spatial contract: ok");
} else if (mode === "language") {
  const app = fs.readFileSync("app.js", "utf8");
  const html = fs.readFileSync("index.html", "utf8");
  for (const text of ["查看运行记录", "下载原始 JSON", "整改待办", "消防健康报告", "使用演示数据"]) {
    assert.ok(app.includes(text) || html.includes(text), `${text} is missing`);
  }
  assert.match(html, /data-mobile-nav="owner"/, "mobile rectification route is missing");
  assert.match(app, /data-copilot-run-section="input"[\s\S]*data-copilot-run-section="evidence"[\s\S]*data-copilot-run-section="tools"[\s\S]*data-copilot-run-section="human"[\s\S]*data-copilot-run-section="result"/, "run record sections are missing or out of order");
  console.log("semifinal M1 language contract: ok");
} else {
  assert.fail("expected monitoring, spatial or language mode");
}
