const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parseCsv, validateBundle, scoreBundle, incidentStatusLabel, stationStatusLabel, nextStationAction } = require("../engine.cjs");

const mode = process.argv[2] || "all";

function loadBundle() {
  const directory = path.join(__dirname, "../demo-data");
  const bundle = Object.fromEntries(
    ["enterprises.csv", "alarm_events.csv", "iot_devices.csv", "maintenance_records.csv", "findings.csv"].map((name) => [
      name,
      parseCsv(fs.readFileSync(path.join(directory, name), "utf8")),
    ]),
  );
  // 导入包按单企业校验：种子目录同时服务多企业场景，这里裁成 enterprises.csv 声明的主体。
  const primary = bundle["enterprises.csv"][0].enterprise_id;
  for (const name of Object.keys(bundle)) {
    if (name !== "enterprises.csv") bundle[name] = bundle[name].filter((row) => row.enterprise_id === primary);
  }
  return bundle;
}

function testParser() {
  const rows = parseCsv('name,note\n"皓源新能源（虚拟）","含逗号,仍为一列"\n');
  assert.equal(rows.length, 1, "CSV parser should return one data row");
  assert.equal(rows[0].note, "含逗号,仍为一列");
}

function testScoring() {
  const bundle = loadBundle();
  assert.deepEqual(validateBundle(bundle), { valid: true, errors: [] });
  const first = scoreBundle(bundle);
  const second = scoreBundle(bundle);
  assert.equal(first.totalScore, 48, "expected FireOps demo score 48");
  assert.equal(first.riskLevel, "high");
  assert.deepEqual(first.triggeredRules.map((rule) => rule.code), ["FG-ALARM-01", "FG-IOT-01", "FG-MAINT-01", "FG-RECT-01", "FG-REPEAT-01"]);
  assert.ok(first.triggeredRules.every((rule) => rule.evidence.length > 0));
  assert.deepEqual(first, second, "same input and ruleset must be deterministic");
  const changedBundle = structuredClone(bundle);
  changedBundle["alarm_events.csv"][0].occurred_at = "2026-07-01T08:11:00+08:00";
  assert.notEqual(scoreBundle(changedBundle).inputHash, first.inputHash, "input hash must change when a source row changes");

  const incomplete = { ...bundle };
  delete incomplete["iot_devices.csv"];
  const unrated = scoreBundle(incomplete);
  assert.equal(unrated.riskLevel, "unrated");
  assert.equal(unrated.totalScore, null);
  assert.equal(unrated.triggeredRules[0].code, "FG-DATA-01");
}

function testIncidentUi() {
  assert.equal(typeof incidentStatusLabel, "function");
  assert.equal(typeof stationStatusLabel, "function");
  assert.equal(typeof nextStationAction, "function");
  assert.equal(incidentStatusLabel("pending_dispatch"), "待调派");
  assert.equal(stationStatusLabel("awaiting_ack"), "待签收");
  assert.deepEqual(nextStationAction("issued"), { action: "acknowledge", label: "签收任务" });
  assert.equal(nextStationAction("arrived"), null);
}

if (mode === "parser" || mode === "all") testParser();
if (mode === "scoring" || mode === "all") testScoring();
if (mode === "incident" || mode === "all") testIncidentUi();
console.log(`engine tests (${mode}): ok`);
