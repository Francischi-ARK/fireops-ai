#!/usr/bin/env node
// 复赛合成数据合同校验。仅使用 Node.js 标准库。
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const FILES = {
  roles: "demo-data/semifinal/role_permissions.json",
  spatial: "demo-data/semifinal/site_spatial.json",
  scenarios: [
    "demo-data/semifinal/scenarios/fire-confirmed.json",
    "demo-data/semifinal/scenarios/false-alarm-maintenance.json",
    "demo-data/semifinal/scenarios/inspection-rectification.json",
  ],
  legacyMap: "demo-data/semifinal/legacy_map.json",
  legacyEnterprises: "demo-data/enterprises.csv",
};
const errors = [];
const fail = (file, field, reason) => errors.push({ file, field, reason });
// 检查 1：JSON 可解析
const readJson = (rel) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  } catch (e) {
    fail(rel, "(file)", "JSON 解析失败: " + e.message);
    return null;
  }
};
const rolesDoc = readJson(FILES.roles);
const spatial = readJson(FILES.spatial);
const scenarios = FILES.scenarios.map((rel) => ({ rel, doc: readJson(rel) }));
const legacyMap = readJson(FILES.legacyMap);
if (rolesDoc && spatial && scenarios.every((s) => s.doc) && legacyMap) {
  main();
}
report();
function main() {
  // 检查 9：合成标记与外部系统边界
  const allDocs = [[FILES.roles, rolesDoc], [FILES.spatial, spatial], [FILES.legacyMap, legacyMap], ...scenarios.map((s) => [s.rel, s.doc])];
  for (const [rel, doc] of allDocs) {
    if (doc.is_simulation !== true) fail(rel, "is_simulation", "必须为 true");
    if (doc.external_system !== "none") fail(rel, "external_system", '必须为 "none"');
  }
  // 检查 3：八类角色齐全
  const EXPECTED_ROLES = [
    "company_management", "control_room_operator", "fire_patrol", "full_time_fire_brigade",
    "workshop_ert", "facility_department", "maintenance_contractor", "workshop_liaison",
  ];
  const roleById = new Map((rolesDoc.roles || []).map((r) => [r.id, r]));
  for (const id of EXPECTED_ROLES) {
    if (!roleById.has(id)) fail(FILES.roles, "roles", "缺少角色 " + id);
  }
  for (const role of rolesDoc.roles || []) {
    for (const f of ["id", "label", "scope", "visible_modules", "allowed_actions", "forbidden_actions", "data_visibility"]) {
      if (role[f] === undefined) fail(FILES.roles, (role.id || "?") + "." + f, "字段缺失");
    }
  }
  // 角色硬规则
  const mustForbid = (id, actions) => {
    const r = roleById.get(id);
    if (!r) return;
    for (const a of actions) {
      if ((r.allowed_actions || []).includes(a)) fail(FILES.roles, id + ".allowed_actions", "不应允许 " + a);
      if (!(r.forbidden_actions || []).includes(a)) fail(FILES.roles, id + ".forbidden_actions", "必须显式禁止 " + a);
    }
  };
  mustForbid("company_management", ["confirm_fire", "dismiss_alarm", "dispatch_brigade", "close_workorder", "close_finding_after_pass"]);
  mustForbid("maintenance_contractor", ["close_workorder", "accept_workorder_done"]);
  mustForbid("workshop_liaison", ["close_finding_after_pass", "submit_rectification_review"]);
  // 检查 2：ID 唯一 + 空间实体收集
  const seen = new Map();
  const noteId = (file, id) => {
    if (!id) return;
    if (seen.has(id)) fail(file, id, "ID 重复，首次出现于 " + seen.get(id));
    seen.set(id, file);
  };
  const spatialIds = new Set();
  const addSpatial = (id) => { if (id) spatialIds.add(id); };
  for (const g of spatial.site.gates || []) { noteId(FILES.spatial, g.id); addSpatial(g.id); }
  for (const f of spatial.site.site_facilities || []) { noteId(FILES.spatial, f.id); addSpatial(f.id); }
  for (const n of spatial.site.route_nodes || []) { noteId(FILES.spatial, n.id); addSpatial(n.id); }
  const buildings = spatial.buildings || [];
  const workshopIds = new Set();
  const buildingScopedOwner = new Map();
  for (const b of buildings) {
    noteId(FILES.spatial, b.id); addSpatial(b.id);
    workshopIds.add(b.workshop_id);
    for (const floor of b.floors || []) {
      for (const z of floor.zones || []) { noteId(FILES.spatial, z.id); addSpatial(z.id); buildingScopedOwner.set(z.id, b.id); }
    }
    for (const d of b.exterior_doors || []) { noteId(FILES.spatial, d.id); addSpatial(d.id); }
    for (const d of b.interior_doors || []) { noteId(FILES.spatial, d.id); addSpatial(d.id); buildingScopedOwner.set(d.id, b.id); }
    for (const s of b.stairs || []) { noteId(FILES.spatial, s.id); addSpatial(s.id); }
    for (const n of b.route_nodes || []) { noteId(FILES.spatial, n.id); addSpatial(n.id); }
    for (const p of b.device_points || []) { noteId(FILES.spatial, p.id); addSpatial(p.id); buildingScopedOwner.set(p.id, b.id); }
    for (const h of b.hazards || []) { noteId(FILES.spatial, h.id); addSpatial(h.id); buildingScopedOwner.set(h.id, b.id); }
    for (const r of b.fire_resources || []) { noteId(FILES.spatial, r.id); addSpatial(r.id); buildingScopedOwner.set(r.id, b.id); }
  }
  // 五类建筑齐全
  const EXPECTED_BUILDINGS = ["b-battery", "b-painting", "b-assembly", "b-stamping", "b-warehouse"];
  for (const id of EXPECTED_BUILDINGS) {
    if (!buildings.some((b) => b.id === id)) fail(FILES.spatial, "buildings", "缺少建筑 " + id);
  }
  // 路线边端点必须存在（含厂区到建筑外门的跨层引用）
  const allEdges = [...(spatial.site.route_edges || []), ...buildings.flatMap((b) => b.route_edges || [])];
  for (const e of allEdges) {
    for (const endpoint of [e.from, e.to]) {
      if (!spatialIds.has(endpoint)) fail(FILES.spatial, e.from + ">" + e.to, "路线边引用不存在的节点 " + endpoint);
    }
  }
  // 室内门必须指向已存在的路线节点
  for (const b of buildings) {
    for (const d of b.interior_doors || []) {
      if (!spatialIds.has(d.node)) fail(FILES.spatial, d.id, "室内门指向不存在的节点 " + d.node);
      if (d.zone && !spatialIds.has(d.zone)) fail(FILES.spatial, d.id, "室内门指向不存在的工艺区 " + d.zone);
    }
  }
  // 坐标规则 0-100
  const allNodes = [...(spatial.site.route_nodes || []), ...buildings.flatMap((b) => b.route_nodes || [])];
  for (const n of allNodes) {
    if (n.x < 0 || n.x > 100 || n.y < 0 || n.y > 100) fail(FILES.spatial, n.id, "坐标超出 0-100");
  }
  for (const b of buildings) {
    for (const floor of b.floors || []) {
      for (const z of floor.zones || []) {
        const c = z.coords || {};
        for (const k of ["x", "y", "w", "h"]) {
          if (typeof c[k] !== "number" || c[k] < 0 || c[k] > 100) fail(FILES.spatial, z.id + ".coords." + k, "坐标须在 0-100");
        }
      }
    }
  }
  // 检查 7：五车间布局与工艺区互不相同
  const profiles = new Set();
  const zoneSets = new Set();
  for (const b of buildings) {
    if (profiles.has(b.layout_profile)) fail(FILES.spatial, b.id + ".layout_profile", "与其他车间重复");
    profiles.add(b.layout_profile);
    const key = (b.floors || []).flatMap((f) => (f.zones || []).map((z) => z.name)).sort().join("|");
    if (zoneSets.has(key)) fail(FILES.spatial, b.id, "工艺区集合与其他车间重复");
    zoneSets.add(key);
  }
  // 检查 8：泵房不进车间，原料仓库不无差别复制
  for (const b of buildings) {
    const names = [
      ...(b.floors || []).flatMap((f) => (f.zones || []).map((z) => z.name)),
      ...(b.fire_resources || []).map((r) => r.name),
    ].join(" ");
    if (names.includes("泵房")) fail(FILES.spatial, b.id, "消防泵房只能存在于厂区级，不得出现在车间内");
  }
  const rawBuildings = buildings.filter((b) =>
    (b.floors || []).some((f) => (f.zones || []).some((z) => z.name.includes("原料")))
  );
  if (rawBuildings.length > 1) fail(FILES.spatial, "buildings", "原料仓区出现在多个建筑: " + rawBuildings.map((b) => b.id).join(","));
  // 检查 7 补充：路线拓扑不得复制（按节点类型归一化比较）
  const nodeKind = new Map();
  for (const b of buildings) for (const n of b.route_nodes || []) nodeKind.set(n.id, n.kind);
  const topoSigs = new Map();
  for (const b of buildings) {
    const sig = (b.route_edges || [])
      .map((e) => (nodeKind.get(e.from) || "?") + ">" + (nodeKind.get(e.to) || "?"))
      .sort()
      .join("|");
    if (topoSigs.has(sig)) fail(FILES.spatial, b.id, "路线拓扑与 " + topoSigs.get(sig) + " 重复");
    topoSigs.set(sig, b.id);
  }
  // 旧数据映射：企业齐备、目标存在、归属一致
  const csvText = fs.readFileSync(path.join(ROOT, FILES.legacyEnterprises), "utf8");
  const csvEntIds = csvText.trim().split("\n").slice(1).map((line) => line.split(",")[0]).filter(Boolean);
  for (const entId of csvEntIds) {
    if (!legacyMap.enterprises || !legacyMap.enterprises[entId]) fail(FILES.legacyMap, entId, "enterprises.csv 中的企业缺少映射");
  }
  for (const [entId, m] of Object.entries(legacyMap.enterprises || {})) {
    if (!spatialIds.has(m.building_id)) fail(FILES.legacyMap, entId + ".building_id", "建筑不存在 " + m.building_id);
    if (!workshopIds.has(m.workshop_id)) fail(FILES.legacyMap, entId + ".workshop_id", "车间不存在 " + m.workshop_id);
  }
  for (const [entId, rules] of Object.entries(legacyMap.location_rules || {})) {
    const m = (legacyMap.enterprises || {})[entId];
    if (!m) { fail(FILES.legacyMap, entId, "location_rules 引用了未映射的企业"); continue; }
    for (const rule of rules) {
      const target = rule.zone || rule.door;
      if (!spatialIds.has(target)) fail(FILES.legacyMap, entId + " match=" + rule.match, "目标不存在 " + target);
      const owner = buildingScopedOwner.get(target) || (rule.door && (buildings.find((b) => (b.exterior_doors || []).some((d) => d.id === rule.door)) || {}).id);
      if (owner && owner !== m.building_id) fail(FILES.legacyMap, entId + " match=" + rule.match, "目标 " + target + " 属于 " + owner + "，与映射建筑 " + m.building_id + " 不一致");
    }
  }
  // 场景校验
  const BANNED_ACTIONS = ["auto_call_119", "auto_start_suppression", "auto_operate_device", "ai_confirm_fire"];
  const ALLOWED_TRANSITIONS = new Set([
    "none>draft",
    "pending>pending", "pending>confirmed", "pending>dismissed",
    "confirmed>issued", "issued>issued", "issued>acknowledged",
    "acknowledged>enroute", "enroute>arrived", "arrived>first_report",
    "first_report>first_report", "first_report>closed",
    "dismissed>draft",
    "draft>draft", "draft>approved", "draft>assigned",
    "approved>approved", "approved>in_progress",
    "in_progress>in_progress", "in_progress>done",
    "done>done",
    "assigned>assigned", "assigned>closed",
    "closed>closed",
  ]);
  let totalSteps = 0;
  for (const { rel, doc } of scenarios) {
    const steps = doc.steps || [];
    totalSteps += steps.length;
    const stepIds = new Set();
    for (const s of steps) {
      if (stepIds.has(s.step_id)) fail(rel, s.step_id, "step_id 重复");
      stepIds.add(s.step_id);
      for (const f of ["step_id", "actor_role", "route", "action", "from_state", "to_state", "entity_refs", "evidence_refs", "human_gate", "display_title", "next_step_id"]) {
        if (s[f] === undefined) fail(rel, (s.step_id || "?") + "." + f, "字段缺失");
      }
      // 检查 5：角色拥有该动作
      const role = roleById.get(s.actor_role);
      if (!role) {
        fail(rel, s.step_id + ".actor_role", "未知角色 " + s.actor_role);
      } else if (!(role.allowed_actions || []).includes(s.action)) {
        fail(rel, s.step_id + ".action", "角色 " + s.actor_role + " 无权执行 " + s.action);
      }
      // 检查 10：禁止 AI 自动越权动作
      if (BANNED_ACTIONS.includes(s.action)) fail(rel, s.step_id + ".action", "禁止的自动化动作 " + s.action);
      // 检查 6：状态跳步
      const key = s.from_state + ">" + s.to_state;
      if (!ALLOWED_TRANSITIONS.has(key)) fail(rel, s.step_id, "非法状态迁移 " + key);
      // 跨文件实体引用存在（合成证据引用含 "/"，跳过）
      const stepBuildings = new Set();
      for (const ref of s.entity_refs || []) {
        if (String(ref).includes("/")) continue;
        if (ref === "site-xinglan") continue;
        if (spatialIds.has(ref) || workshopIds.has(ref)) continue;
        fail(rel, s.step_id + ".entity_refs", "引用不存在的实体 " + ref);
      }
      // 同一步骤的建筑级实体不得跨车间串用
      for (const ref of s.entity_refs || []) {
        const owner = buildingScopedOwner.get(ref);
        if (owner) stepBuildings.add(owner);
      }
      if (stepBuildings.size > 1) fail(rel, s.step_id + ".entity_refs", "同一步骤引用多个车间的实体: " + [...stepBuildings].join(","));
      // 未授权关闭
      if (s.action === "close_workorder" && s.actor_role !== "facility_department")
        fail(rel, s.step_id, "工单关闭只能由 facility_department 执行");
      if (s.action === "accept_workorder_done" && s.actor_role !== "facility_department")
        fail(rel, s.step_id, "验收只能由 facility_department 执行");
      if (s.action === "close_finding_after_pass" && s.actor_role !== "fire_patrol")
        fail(rel, s.step_id, "隐患复查关闭只能由 fire_patrol 执行");
      if (s.action === "confirm_fire" && s.actor_role !== "control_room_operator")
        fail(rel, s.step_id, "火警确认只能由 control_room_operator 执行");
    }
    // 检查 4：next_step_id 连续且无环
    const byId = new Map(steps.map((s) => [s.step_id, s]));
    const visited = new Set();
    let cur = steps[0];
    while (cur) {
      if (visited.has(cur.step_id)) { fail(rel, cur.step_id, "步骤链存在环"); break; }
      visited.add(cur.step_id);
      if (cur.next_step_id === null) { cur = null; break; }
      const next = byId.get(cur.next_step_id);
      if (!next) { fail(rel, cur.step_id + ".next_step_id", "指向不存在的步骤 " + cur.next_step_id); break; }
      cur = next;
    }
    for (const s of steps) {
      if (!visited.has(s.step_id)) fail(rel, s.step_id, "步骤不在主链上（孤立步骤）");
    }
  }
  globalThis.__stats = { totalSteps };
}
function report() {
  if (errors.length) {
    console.error("校验失败，共 " + errors.length + " 项：");
    for (const e of errors) console.error("- [" + e.file + "] " + e.field + ": " + e.reason);
    process.exit(1);
  }
  const stats = globalThis.__stats || { totalSteps: 0 };
  console.log("校验通过：");
  console.log("- 数据文件: 6 (角色 1 / 空间 1 / 映射 1 / 场景 3)");
  console.log("- 角色数量: " + (rolesDoc ? rolesDoc.roles.length : 0));
  console.log("- 建筑数量: " + (spatial ? spatial.buildings.length : 0) + " (+厂区级设施 " + (spatial ? spatial.site.site_facilities.length : 0) + ")");
  console.log("- 场景步骤: " + stats.totalSteps);
}
