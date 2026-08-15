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

const api = { parseCsv, validateBundle, scoreBundle, incidentStatusLabel, stationStatusLabel, nextStationAction, RULESET };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.FireGuardEngine = api;
