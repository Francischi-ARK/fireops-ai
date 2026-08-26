const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  parseCsv,
  validateBundle,
  scoreBundle,
  incidentStatusLabel,
  stationStatusLabel,
  nextStationAction,
  buildFirstResponsePack,
  roleDefinitions,
  canRolePerform,
  transitionWorkflow,
} = require("../engine.cjs");

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

function testFirstResponsePack() {
  assert.equal(typeof buildFirstResponsePack, "function", "buildFirstResponsePack is missing");
  const pack = buildFirstResponsePack({
    enterprise: { id: "ent-001", name: "电池车间（PACK/化成）" },
    profile: {
      address: "星澜新能源汽车工厂（虚拟）西区 电池车间厂房",
      hazards: ["锂电池模组半成品缓存区（合成）"],
      access_points: ["车间南门（合成）"],
      water_sources: [],
      facilities: ["自动喷水灭火系统（合成）"],
    },
    devicePoints: [{ point_id: "pt-01", device_type: "点型感烟探测器" }],
    evidenceRefs: ["monitoring_events/1"],
  });
  assert.equal(pack.schema_version, "fireops-first-response-pack/v1");
  assert.equal(pack.readiness.score, 83);
  assert.deepEqual(pack.readiness.missing_fields, ["可用水源"]);
  assert.ok(pack.agent.tool_trace.every((entry) => entry.evidence_refs.length));
  assert.ok(pack.boundaries.includes("对外共享与报警由授权人员确认"));
}

function testRoleWorkflows() {
  const roles = roleDefinitions();
  assert.equal(roles.length, 8, "the enterprise workflow must expose eight fixed roles");
  assert.equal(new Set(roles.map((role) => role.id)).size, 8, "role IDs must be unique");
  assert.deepEqual(
    roles.find((role) => role.id === "company_management").modules,
    ["home", "emergency", "prevention", "operations", "analysis", "assets"],
    "management must see the whole factory fire-safety picture",
  );
  assert.equal(canRolePerform("company_management", "dispatch_response"), false, "management is read-only for dispatch");
  assert.equal(canRolePerform("maintenance_contractor", "accept_maintenance"), false, "contractors cannot accept their own maintenance");
  assert.equal(canRolePerform("workshop_liaison", "pass_recheck"), false, "workshop liaisons cannot close their own findings");
  assert.equal(canRolePerform("control_room_operator", "dispatch_response"), true);

  assert.deepEqual(
    transitionWorkflow("alarm_response", "signal_pending", "dispatch_verification", "control_room_operator"),
    { allowed: true, changed: true, state: "verification_dispatched" },
  );
  assert.deepEqual(
    transitionWorkflow("alarm_response", "verification_enroute", "confirm_fire", "fire_patrol"),
    { allowed: true, changed: true, state: "fire_confirmed" },
  );
  assert.equal(
    transitionWorkflow("alarm_response", "fire_confirmed", "dispatch_response", "company_management").code,
    "forbidden_role",
  );

  assert.deepEqual(
    transitionWorkflow("maintenance", "in_progress", "submit_maintenance_result", "maintenance_contractor"),
    { allowed: true, changed: true, state: "acceptance_pending" },
  );
  assert.equal(
    transitionWorkflow("maintenance", "acceptance_pending", "accept_maintenance", "maintenance_contractor").code,
    "forbidden_role",
  );
  assert.deepEqual(
    transitionWorkflow("maintenance", "acceptance_pending", "accept_maintenance", "facility_department"),
    { allowed: true, changed: true, state: "closed" },
  );
  assert.deepEqual(
    transitionWorkflow("maintenance", "closed", "accept_maintenance", "facility_department"),
    { allowed: true, changed: false, state: "closed" },
    "repeated terminal actions must be idempotent",
  );

  assert.deepEqual(
    transitionWorkflow("inspection_rectification", "rectifying", "submit_rectification", "workshop_liaison"),
    { allowed: true, changed: true, state: "recheck_pending" },
  );
  assert.equal(
    transitionWorkflow("inspection_rectification", "recheck_pending", "pass_recheck", "workshop_liaison").code,
    "forbidden_role",
  );
  assert.deepEqual(
    transitionWorkflow("inspection_rectification", "recheck_pending", "fail_recheck", "fire_patrol"),
    { allowed: true, changed: true, state: "assigned" },
  );
}

if (mode === "parser" || mode === "all") testParser();
if (mode === "scoring" || mode === "all") testScoring();
if (mode === "incident" || mode === "all") testIncidentUi();
if (mode === "response-pack" || mode === "all") testFirstResponsePack();
if (mode === "roles" || mode === "all") testRoleWorkflows();
console.log(`engine tests (${mode}): ok`);
