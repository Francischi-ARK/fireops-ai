"use strict";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === "") {
      quoted = true;
    } else if (char === ",") {
      row.push(field.trim());
      field = "";
    } else if (char === "\n") {
      row.push(field.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field !== "" || row.length) {
    row.push(field.trim());
    if (row.some((value) => value !== "")) rows.push(row);
  }
  if (quoted) throw new Error("CSV 引号未闭合");
  if (rows.length < 2) return [];

  const headers = rows.shift().map((header, index) => index === 0 ? header.replace(/^\uFEFF/, "") : header);
  if (headers.some((header) => !header) || new Set(headers).size !== headers.length) throw new Error("CSV 表头为空或重复");
  return rows.map((values, rowIndex) => {
    if (values.length !== headers.length) throw new Error(`CSV 第 ${rowIndex + 2} 行列数不一致`);
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

const RULESET = "FG-DEMO-v0";
const REQUIRED_COLUMNS = {
  "enterprises.csv": ["enterprise_id", "name", "data_cutoff"],
  "alarm_events.csv": ["alarm_event_id", "enterprise_id", "event_type", "device_ref", "occurred_at", "quality", "raw_ref"],
  "iot_devices.csv": ["device_id", "enterprise_id", "expected_online", "last_heartbeat", "quality", "raw_ref"],
  "maintenance_records.csv": ["maintenance_id", "enterprise_id", "planned_at", "status", "quality", "raw_ref"],
  "findings.csv": ["finding_id", "enterprise_id", "found_at", "due_at", "status", "repeat_key", "quality", "raw_ref"],
};

function validateBundle(bundle) {
  const errors = [];
  const requiredFiles = Object.keys(REQUIRED_COLUMNS);
  for (const fileName of requiredFiles) {
    const rows = bundle[fileName];
    if (!Array.isArray(rows) || rows.length === 0) {
      errors.push(`缺少或为空：${fileName}`);
      continue;
    }
    if (rows.length > 500) errors.push(`${fileName} 超过 500 行 Demo 上限`);
    for (const column of REQUIRED_COLUMNS[fileName]) {
      if (!(column in rows[0])) errors.push(`${fileName} 缺少字段 ${column}`);
    }
    rows.forEach((row, index) => {
      for (const value of Object.values(row)) {
        if (/^[=+@]/.test(value)) errors.push(`${fileName} 第 ${index + 2} 行包含潜在公式`);
      }
      if (row.quality && !["valid", "suspect", "invalid", "missing"].includes(row.quality)) errors.push(`${fileName} 第 ${index + 2} 行 quality 无效`);
    });
  }

  const enterpriseId = bundle["enterprises.csv"]?.[0]?.enterprise_id;
  if (enterpriseId) {
    for (const fileName of requiredFiles.slice(1)) {
      for (const row of bundle[fileName] || []) {
        if (row.enterprise_id !== enterpriseId) errors.push(`${fileName} 包含其他企业数据`);
      }
    }
  }

  const dateFields = {
    "enterprises.csv": ["data_cutoff"],
    "alarm_events.csv": ["occurred_at", "restored_at"],
    "iot_devices.csv": ["last_heartbeat"],
    "maintenance_records.csv": ["planned_at", "completed_at"],
    "findings.csv": ["found_at", "due_at", "verified_at"],
  };
  for (const [fileName, fields] of Object.entries(dateFields)) {
    (bundle[fileName] || []).forEach((row, index) => {
      fields.forEach((field) => {
        if (row[field] && Number.isNaN(Date.parse(row[field]))) errors.push(`${fileName} 第 ${index + 2} 行 ${field} 不是有效时间`);
      });
    });
  }

  return { valid: errors.length === 0, errors };
}

function scoreBundle(bundle) {
  const validation = validateBundle(bundle);
  if (!validation.valid) {
    return {
      ruleVersion: RULESET,
      enterpriseId: bundle["enterprises.csv"]?.[0]?.enterprise_id || null,
      dataCutoff: bundle["enterprises.csv"]?.[0]?.data_cutoff || null,
      totalScore: null,
      riskLevel: "unrated",
      triggeredRules: [{ code: "FG-DATA-01", title: "数据缺失或无效", deduction: 0, evidence: validation.errors }],
      validation,
    };
  }

  const enterprise = bundle["enterprises.csv"][0];
  const cutoff = Date.parse(enterprise.data_cutoff);
  const day = 86_400_000;
  const currentStart = cutoff - 30 * day;
  const baselineStart = cutoff - 60 * day;
  const alarms = bundle["alarm_events.csv"].filter((row) => row.quality === "valid" && row.event_type === "fault");
  const currentAlarms = alarms.filter((row) => Date.parse(row.occurred_at) > currentStart && Date.parse(row.occurred_at) <= cutoff);
  const baselineAlarms = alarms.filter((row) => Date.parse(row.occurred_at) > baselineStart && Date.parse(row.occurred_at) <= currentStart);
  const triggeredRules = [];

  if (currentAlarms.length >= baselineAlarms.length * 1.5 && currentAlarms.length - baselineAlarms.length >= 3) {
    triggeredRules.push({
      code: "FG-ALARM-01",
      title: "报警系统故障频率增加",
      deduction: 14,
      metric: `${currentAlarms.length} / ${baselineAlarms.length}`,
      evidence: currentAlarms.map((row) => row.raw_ref),
    });
  }

  const offlineDevices = bundle["iot_devices.csv"].filter((row) => row.quality === "valid" && row.expected_online === "true" && (cutoff - Date.parse(row.last_heartbeat)) / 3_600_000 > 2);
  if (offlineDevices.length) {
    triggeredRules.push({
      code: "FG-IOT-01",
      title: "设备长时间离线",
      deduction: 10,
      metric: `${Math.max(...offlineDevices.map((row) => Math.round((cutoff - Date.parse(row.last_heartbeat)) / 3_600_000)))} 小时`,
      evidence: offlineDevices.map((row) => row.raw_ref),
    });
  }

  const overdueMaintenance = bundle["maintenance_records.csv"].filter((row) => row.quality === "valid" && !["completed", "cancelled"].includes(row.status) && Date.parse(row.planned_at) + 7 * day < cutoff);
  if (overdueMaintenance.length) {
    triggeredRules.push({ code: "FG-MAINT-01", title: "计划维保逾期", deduction: 10, metric: `${overdueMaintenance.length} 项`, evidence: overdueMaintenance.map((row) => row.raw_ref) });
  }

  const findings = bundle["findings.csv"].filter((row) => row.quality === "valid");
  const overdueFindings = findings.filter((row) => !["verified", "closed"].includes(row.status) && Date.parse(row.due_at) < cutoff);
  if (overdueFindings.length) {
    triggeredRules.push({ code: "FG-RECT-01", title: "隐患整改逾期", deduction: 10, metric: `${overdueFindings.length} 项`, evidence: overdueFindings.map((row) => row.raw_ref) });
  }

  const repeatGroups = new Map();
  findings.filter((row) => row.repeat_key && Date.parse(row.found_at) >= cutoff - 180 * day).forEach((row) => {
    repeatGroups.set(row.repeat_key, [...(repeatGroups.get(row.repeat_key) || []), row]);
  });
  const repeated = [...repeatGroups.values()].filter((rows) => rows.length >= 2).flat();
  if (repeated.length) {
    triggeredRules.push({ code: "FG-REPEAT-01", title: "重复隐患", deduction: 8, metric: `${repeated.length} 次`, evidence: repeated.map((row) => row.raw_ref) });
  }

  const totalScore = Math.max(0, 100 - triggeredRules.reduce((sum, rule) => sum + rule.deduction, 0));
  return {
    ruleVersion: RULESET,
    enterpriseId: enterprise.enterprise_id,
    enterpriseName: enterprise.name,
    dataCutoff: enterprise.data_cutoff,
    inputHash: stableHash(bundle),
    totalScore,
    riskLevel: totalScore < 70 ? "high" : totalScore < 85 ? "medium" : "low",
    triggeredRules,
    inputSummary: {
      alarmEvents: bundle["alarm_events.csv"].length,
      iotDevices: bundle["iot_devices.csv"].length,
      maintenanceRecords: bundle["maintenance_records.csv"].length,
      findings: bundle["findings.csv"].length,
    },
    validation,
  };
}

function stableHash(value) {
  const text = canonicalJson(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fg-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function incidentStatusLabel(status) {
  return {
    pending_dispatch: "待调派", dispatched: "已下达", acknowledged: "已签收",
    enroute: "已出动", arrived: "已到场", closed: "已归档",
  }[status] || "状态未知";
}

function stationStatusLabel(status) {
  return {
    available: "可调派", awaiting_ack: "待签收", assigned: "已受领",
    enroute: "出动中", on_scene: "现场处置",
  }[status] || "状态未知";
}

function nextStationAction(dispatchStatus) {
  return {
    issued: { action: "acknowledge", label: "签收任务" },
    acknowledged: { action: "depart", label: "确认出动" },
    enroute: { action: "arrive", label: "确认到场" },
  }[dispatchStatus] || null;
}

function buildFirstResponsePack({ enterprise, profile = {}, devicePoints = [], evidenceRefs = [] }) {
  const checks = [
    ["场所地址", Boolean(profile.address), ["enterprise_response_profiles.address"]],
    ["重点危险源", Boolean(profile.hazards?.length), ["enterprise_response_profiles.hazards"]],
    ["优先入口", Boolean(profile.access_points?.length), ["enterprise_response_profiles.access_points"]],
    ["可用水源", Boolean(profile.water_sources?.length), ["enterprise_response_profiles.water_sources"]],
    ["消防设施", Boolean(profile.facilities?.length), ["enterprise_response_profiles.facilities"]],
    ["设备点位台账", Boolean(devicePoints.length), devicePoints.length ? devicePoints.map((item) => item.point_id).filter(Boolean) : ["device_points"]],
  ].map(([label, ready, sources]) => ({ label, ready, sources }));
  const readyCount = checks.filter((item) => item.ready).length;
  const sources = [...new Set([...checks.flatMap((item) => item.sources), ...evidenceRefs])];
  return {
    schema_version: "fireops-first-response-pack/v1",
    simulation: true,
    enterprise: { id: enterprise.id, name: enterprise.name },
    readiness: {
      score: Math.round(readyCount / checks.length * 100),
      ready_count: readyCount,
      total: checks.length,
      missing_fields: checks.filter((item) => !item.ready).map((item) => item.label),
      checks,
    },
    site: {
      address: profile.address || "未知",
      hazards: profile.hazards || [],
      access_points: profile.access_points || [],
      water_sources: profile.water_sources || [],
      facilities: profile.facilities || [],
    },
    agent: {
      method: "结构化检索 + 缺失字段检查",
      tool_trace: [
        { name: "get_enterprise_profile", evidence_refs: ["enterprises", "enterprise_response_profiles.address"] },
        { name: "get_site_packet", evidence_refs: sources.filter((ref) => ref.startsWith("enterprise_response_profiles.")) },
        { name: "get_device_context", evidence_refs: checks.at(-1).sources },
        { name: "check_missing_fields", evidence_refs: sources },
        { name: "build_external_brief", evidence_refs: sources },
      ],
      evidence_refs: sources,
    },
    boundaries: ["只生成只读资料草稿", "不控制真实设备", "不替代现场指挥", "对外共享与报警由授权人员确认"],
  };
}

const MONITORING_EVENTS = [
  { id: "evt-fire-001", enterpriseId: "ent-001", type: "fire", typeLabel: "火警", status: "pending", statusLabel: "待核实", time: "10:24", floor: "2F", point: "电池测试工位", location: "PACK 产线 A1", left: 50, top: 73, devices: ["感烟探测器 PT-02-01-005", "声光警报器 A1-04", "防火卷帘 FJ-02"], trend: [12, 18, 32, 58, 81], history: ["10:24 报警帧接入", "10:24 相邻探测器联查", "10:25 等待人工核实"] },
  { id: "evt-smoke-002", enterpriseId: "ent-005", type: "alarm", typeLabel: "异常", status: "processing", statusLabel: "处理中", time: "08:48", floor: "1F", point: "喷漆线 3#", location: "喷涂通道", left: 25, top: 31, devices: ["感温探测器 PT-01-03", "排烟风机 PF-01"], trend: [16, 22, 41, 55, 69], history: ["08:48 温度异常", "08:50 班组已受领"] },
  { id: "evt-fault-003", enterpriseId: "ent-002", type: "fault", typeLabel: "故障", status: "processing", statusLabel: "处理中", time: "07:32", floor: "3F", point: "测试区 B2", location: "总装测试区", left: 51, top: 31, devices: ["消防主机回路 3", "输入输出模块 IO-31"], trend: [7, 12, 18, 26, 37], history: ["07:32 回路故障", "07:35 维保工单已生成"] },
  { id: "evt-restored-004", enterpriseId: "ent-003", type: "alarm", typeLabel: "告警", status: "closed", statusLabel: "已恢复", time: "昨天", floor: "1F", point: "堆垛机通道", location: "立体仓库", left: 30, top: 70, devices: ["光束探测器 BM-09"], trend: [42, 31, 20, 12, 8], history: ["昨天 23:11 告警恢复", "昨天 23:16 人工复核完成"] },
  { id: "evt-data-005", enterpriseId: "ent-004", type: "fault", typeLabel: "故障", status: "pending", statusLabel: "待核实", time: "昨天", floor: "2F", point: "冲压线控制柜", location: "冲压车间", left: 75, top: 70, devices: ["ARK 工业网关 GW-04"], trend: [62, 48, 30, 12, 0], history: ["昨天 18:40 网关断报", "昨天 18:42 等待网络核实"] },
];

function monitoringEvents() {
  return MONITORING_EVENTS.map((event) => ({ ...event, devices: [...event.devices], trend: [...event.trend], history: [...event.history] }));
}

function filterMonitoringEvents(events, status = "all") {
  return status === "all" ? [...events] : events.filter((event) => event.status === status);
}

function createMonitoringEvent(events, type, enterpriseId, now = new Date()) {
  const fault = type === "fault";
  const event = {
    id: `evt-local-${now.getTime()}`,
    enterpriseId,
    type: fault ? "fault" : "fire",
    typeLabel: fault ? "故障" : "火警",
    status: "pending",
    statusLabel: "待核实",
    time: now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    floor: "2F",
    point: fault ? "消防主机备电回路" : "PACK 缓存区感烟点",
    location: fault ? "消防控制室" : "PACK 产线 A1",
    left: fault ? 43 : 50,
    top: fault ? 47 : 73,
    devices: fault ? ["消防主机机 2", "备电模块 BAT-02"] : ["感烟探测器 PT-02-01-005", "声光警报器 A1-04", "防火卷帘 FJ-02"],
    trend: fault ? [100, 82, 41, 8, 0] : [8, 16, 37, 65, 92],
    history: [`${now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 本地模拟${fault ? "故障" : "火警"}`, "等待人工核实"],
  };
  return [event, ...events];
}

const api = { parseCsv, validateBundle, scoreBundle, incidentStatusLabel, stationStatusLabel, nextStationAction, buildFirstResponsePack, monitoringEvents, filterMonitoringEvents, createMonitoringEvent, RULESET };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.FireGuardEngine = api;
