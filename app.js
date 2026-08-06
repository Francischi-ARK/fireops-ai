"use strict";

const DATA_CUTOFF = "2026-07-29 12:00";
const DEMO_RULESET = (window.FireGuardEngine && window.FireGuardEngine.RULESET) || "FG-DEMO-v0";

const companies = [
  { id: "ent-001", name: "皓源新能源（虚拟）", industry: "锂离子电池制造", score: 58, level: "high", levelLabel: "高风险", openHazards: 12, building: "1 号生产厂房", area: "12,800 ㎡", primaryRisk: "消防控制室值班记录问题重复出现" },
  { id: "ent-005", name: "恒泽材料（虚拟）", industry: "新材料制造", score: 69, level: "high", levelLabel: "高风险", openHazards: 8, building: "1 号生产厂房", area: "9,600 ㎡", primaryRisk: "整改逾期与重复隐患" },
  { id: "ent-002", name: "瑞虎机械（虚拟）", industry: "通用设备制造", score: 76, level: "medium", levelLabel: "中风险", openHazards: 6, building: "总装厂房", area: "8,200 ㎡", primaryRisk: "季度维保计划逾期" },
  { id: "ent-003", name: "安澜仓储（虚拟）", industry: "普通仓储", score: 91, level: "low", levelLabel: "低风险", openHazards: 2, building: "1 号仓库", area: "6,400 ㎡", primaryRisk: "暂无规则触发" },
  { id: "ent-004", name: "启明电子（虚拟）", industry: "电子元件制造", score: null, level: "unrated", levelLabel: "数据不足", openHazards: 0, building: "2 号厂房", area: "11,300 ㎡", primaryRisk: "多数据域缺失或过期" },
];

const issues = [
  {
    id: "hazard-01",
    number: 1,
    title: "消防控制室值班记录问题",
    location: "消防控制室",
    tag: "重复隐患",
    status: "待复查",
    statusType: "urgent",
    description: "值班记录填写不完整，未记录火警处置流程。",
    department: "安保部",
    owner: "张伟",
    dueAt: "2026-06-15",
    dueText: "已逾期 20 天",
    foundAt: "2026-07-09 09:02",
    repeated: "近 180 天重复 3 次",
    image: "assets/evidence-control-room-log.png",
    pin: { left: 43, top: 47 },
  },
  {
    id: "hazard-02",
    number: 2,
    title: "灭火器被遮挡",
    location: "生产线 A 区 · 通道东侧",
    tag: "现场隐患",
    status: "隐患整改中",
    statusType: "progress",
    description: "灭火器被物料箱遮挡，影响紧急情况下快速取用。",
    department: "生产部",
    owner: "李强",
    dueAt: "2026-08-05",
    dueText: "剩余 7 天",
    foundAt: "2026-07-22 09:41",
    repeated: "首次发现",
    image: "assets/evidence-extinguisher-blocked.png",
    pin: { left: 78, top: 46 },
  },
  {
    id: "hazard-03",
    number: 3,
    title: "疏散指示标志故障",
    location: "原料仓库 · 西侧通道",
    tag: "设备故障",
    status: "待整改",
    statusType: "urgent",
    description: "疏散指示灯不亮，夜间状态无法辨识疏散方向。",
    department: "工程部",
    owner: "王磊",
    dueAt: "2026-07-28",
    dueText: "剩余 0 天",
    foundAt: "2026-07-28 15:16",
    repeated: "近 180 天 1 次",
    image: "assets/evidence-exit-sign-fault.png",
    pin: { left: 14, top: 66 },
  },
];

const inspectionRoute = [
  { number: 1, title: "消防控制室", status: "待复查", time: "09:00", tone: "danger", issueId: "hazard-01" },
  { number: 2, title: "生产线 A 区", status: "隐患整改中", time: "09:35", tone: "warning", issueId: "hazard-02" },
  { number: 3, title: "原料仓库", status: "待整改", time: "10:10", tone: "warning", issueId: "hazard-03" },
  { number: 4, title: "成品仓库", status: "已闭环", time: "10:45", tone: "success" },
  { number: 5, title: "配电间", status: "已闭环", time: "11:20", tone: "success" },
  { number: 6, title: "装卸平台", status: "已闭环", time: "11:55", tone: "success" },
];

const equipment = [
  { icon: "radio-tower", name: "火灾报警控制器", location: "消防控制室", state: "正常", updated: "2 分钟前" },
  { icon: "siren", name: "声光警报器", location: "生产线 A 区", state: "故障 1", updated: "11 分钟前" },
  { icon: "door-open", name: "安全出口", location: "全厂 8 处", state: "正常", updated: "8 分钟前" },
  { icon: "droplets", name: "消防水系统", location: "消防泵房", state: "正常", updated: "5 分钟前" },
  { icon: "wifi-off", name: "物联网网关", location: "泵房二层", state: "离线 1", updated: "30 小时前" },
];

const workspaces = [
  { route: "monitoring", role: "总队 / 支队", icon: "scan-line", title: "重点单位监测中心", description: "查看辖区消防物联网、维保和隐患闭环汇总。", status: "3D Demo" },
  { route: "incidents", role: "总队 / 支队", icon: "radio-tower", title: "消防接处警与指挥台", description: "处理合成警情的核实、调派、跟踪和首报。", status: "可演示" },
  { route: "station", role: "消防救援站", icon: "siren", title: "消防救援站接警终端", description: "接收虚拟任务并反馈签收、出动、到场和现场首报。", status: "可演示" },
  { route: "inspections", role: "防火监督人员", icon: "clipboard-check", title: "消防监督检查工具", description: "开展检查、记录证据并跟踪整改与复查。", status: "已可使用" },
  { route: "enterprises/ent-001", role: "企业消防管理人员", icon: "factory", title: "企业消防管理工作台", description: "管理企业设备、维保、隐患和消防风险画像明细。", status: "下一阶段" },
];

const monitoringProfiles = {
  "ent-001": { district: "高新区", online: "89%", signal: "设备火警信号 3 条", fault: "报警系统故障 18 次", maintenance: "维保逾期 2 项", freshness: "2 分钟前" },
  "ent-005": { district: "临港区", online: "93%", signal: "设备火警信号 1 条", fault: "报警系统故障 9 次", maintenance: "维保逾期 1 项", freshness: "4 分钟前" },
  "ent-002": { district: "经开区", online: "97%", signal: "无未核实火警信号", fault: "设备故障 4 次", maintenance: "季度维保逾期", freshness: "3 分钟前" },
  "ent-003": { district: "物流园区", online: "99%", signal: "无未核实火警信号", fault: "设备故障 1 次", maintenance: "维保计划正常", freshness: "1 分钟前" },
  "ent-004": { district: "新城区", online: "62%", signal: "数据不足", fault: "3 个数据域缺失", maintenance: "维保数据未接入", freshness: "30 小时前" },
};

let selectedCompanyId = "ent-001";
let selectedIssueId = "hazard-01";
let activeRightTab = "hazards";
let hazardFilter = "all";
let planZoom = 1;
let toastTimer;
let workflowStarted = false;
const MONITORING_API_BASE = window.FIREGUARD_API_BASE || "http://127.0.0.1:8000";
let copilotState = {
  scenarios: null, selectedId: null, mode: "scenario",
  phase: "select", eventId: null, run: null, verification: null, dispatch: null, busy: false,
};
let monitoringBackend = { status: "connecting", summary: null, enterpriseIds: companies.map((company) => company.id) };
let monitoringEventSource = null;
let monitoringInitialized = false;
let monitoringRefreshTimer = null;
let incidentBackend = { status: "connecting", signals: [], incidents: [], stations: [], station: null, tasks: [] };
let incidentEventSource = null;
let incidentRefreshTimer = null;
let incidentInitialized = false;
let selectedSignalEventId = null;
let selectedIncidentId = null;
let selectedStationTaskId = null;
const terminalStationId = "station-hx-01";
let latestAssessment = {
  ruleVersion: DEMO_RULESET,
  enterpriseId: "ent-001",
  enterpriseName: "皓源新能源（虚拟）",
  dataCutoff: "2026-07-29T12:00:00+08:00",
  inputHash: "fg-demo-preview",
  totalScore: 58,
  riskLevel: "high",
  triggeredRules: [
    { code: "FG-ALARM-01", title: "报警系统故障频率增加", deduction: 14, metric: "18 / 5", evidence: ["demo/alarm/001"] },
    { code: "FG-IOT-01", title: "设备长时间离线", deduction: 10, metric: "30 小时", evidence: ["demo/iot/dev-001"] },
    { code: "FG-RECT-01", title: "隐患整改逾期", deduction: 10, metric: "1 项", evidence: ["demo/finding/001"] },
    { code: "FG-REPEAT-01", title: "重复隐患", deduction: 8, metric: "3 次", evidence: ["demo/finding/001", "demo/finding/002", "demo/finding/003"] },
  ],
};

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");

function selectedCompany() {
  return companies.find((company) => company.id === selectedCompanyId) || companies[0];
}

function selectedIssue() {
  return issues.find((issue) => issue.id === selectedIssueId) || issues[0];
}

function scoreText(value) {
  return value === null ? "—" : value;
}

function riskBadge(company) {
  return `<span class="risk-badge risk-${company.level}">${company.levelLabel}</span>`;
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
}

function riskLabel(level) {
  return { high: "高风险", medium: "中风险", low: "低风险", unrated: "数据不足" }[level] || "数据不足";
}

function updateMonitoringConnection(status) {
  monitoringBackend.status = status;
  const indicator = document.querySelector("[data-monitoring-connection]");
  if (!indicator) return;
  indicator.className = `monitoring-connection ${status}`;
  indicator.innerHTML = `<b></b>${status === "live" ? "后端实时连接" : status === "connecting" ? "正在连接后端" : "使用本地演示数据"}`;
}

function monitoringFreshness(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "时间未知";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 2) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  return `${Math.round(minutes / 60)} 小时前`;
}

function applyBackendEnterprises(items) {
  if (!Array.isArray(items)) throw new Error("monitoring_enterprises_invalid");
  monitoringBackend.enterpriseIds = items.map((item) => item.id).filter((id) => companies.some((company) => company.id === id));
  items.forEach((item) => {
    const company = companies.find((entry) => entry.id === item.id);
    if (!company) return;
    company.name = item.name;
    company.industry = item.industry;
    company.building = item.building;
    company.score = item.risk_level === "unrated" ? null : item.health_score;
    company.level = item.risk_level;
    company.levelLabel = riskLabel(item.risk_level);
    company.openHazards = item.open_hazards;
    monitoringProfiles[item.id] = {
      district: item.district,
      online: `${Math.round(item.online_rate)}%`,
      signal: item.pending_signal_count ? `设备火警信号 ${item.pending_signal_count} 条` : "无未核实火警信号",
      fault: `报警系统故障 ${item.fault_count_30d} 次`,
      maintenance: item.maintenance_overdue ? `维保逾期 ${item.maintenance_overdue} 项` : "维保计划正常",
      freshness: monitoringFreshness(item.last_seen_at),
    };
  });
}

function scheduleMonitoringRefresh() {
  clearTimeout(monitoringRefreshTimer);
  monitoringRefreshTimer = setTimeout(refreshMonitoringFromBackend, 120);
}

async function refreshMonitoringFromBackend() {
  try {
    const [summaryResponse, enterprisesResponse] = await Promise.all([
      fetch(`${MONITORING_API_BASE}/monitoring/summary`),
      fetch(`${MONITORING_API_BASE}/monitoring/enterprises`),
    ]);
    if (!summaryResponse.ok || !enterprisesResponse.ok) throw new Error("monitoring_api_unavailable");
    monitoringBackend.summary = await summaryResponse.json();
    const enterprisesPayload = await enterprisesResponse.json();
    applyBackendEnterprises(enterprisesPayload.items);
    updateMonitoringConnection("live");
    if ((location.hash || "#/home").startsWith("#/monitoring")) renderRoute();
  } catch {
    updateMonitoringConnection("offline");
  }
}

function startMonitoringBackend() {
  if (!monitoringInitialized) {
    monitoringInitialized = true;
    refreshMonitoringFromBackend();
  }
  if (monitoringEventSource) return;
  updateMonitoringConnection("connecting");
  monitoringEventSource = new EventSource(`${MONITORING_API_BASE}/monitoring/events/stream`);
  monitoringEventSource.addEventListener("open", () => {
    updateMonitoringConnection("live");
    scheduleMonitoringRefresh();
  });
  monitoringEventSource.addEventListener("monitoring", scheduleMonitoringRefresh);
  monitoringEventSource.addEventListener("error", () => updateMonitoringConnection("offline"));
}

function stopMonitoringBackend() {
  monitoringEventSource?.close();
  monitoringEventSource = null;
  monitoringInitialized = false;
  clearTimeout(monitoringRefreshTimer);
}

async function postMonitoringEvent(eventType, successMessage) {
  try {
    const response = await fetch(`${MONITORING_API_BASE}/monitoring/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enterprise_id: selectedCompanyId,
        event_type: eventType,
        severity: eventType === "verification_requested" ? "info" : "high",
        source: "fireguard_demo_console",
        payload: { synthetic: true },
      }),
    });
    if (!response.ok) throw new Error("monitoring_event_failed");
    showToast(successMessage);
    scheduleMonitoringRefresh();
  } catch {
    showToast("后端未连接，事件没有写入数据库");
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function incidentTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "--:--";
}

async function refreshIncidentBackend() {
  try {
    const overviewResponse = await fetch(`${MONITORING_API_BASE}/incidents/overview`);
    if (!overviewResponse.ok) throw new Error("incident_api_unavailable");
    const overview = await overviewResponse.json();
    Object.assign(incidentBackend, overview, { status: "live" });
    if ((location.hash || "").startsWith("#/station")) {
      const stationResponse = await fetch(`${MONITORING_API_BASE}/stations/${terminalStationId}/tasks`);
      if (!stationResponse.ok) throw new Error("station_api_unavailable");
      Object.assign(incidentBackend, await stationResponse.json());
    }
    selectedSignalEventId ||= incidentBackend.signals.find((item) => item.verification_status === "pending")?.monitoring_event_id || null;
    selectedIncidentId ||= incidentBackend.incidents[0]?.id || null;
    selectedStationTaskId ||= incidentBackend.tasks[0]?.id || null;
    if (["#/incidents", "#/station"].some((route) => (location.hash || "").startsWith(route))) renderRoute();
  } catch {
    incidentBackend.status = "offline";
    if (["#/incidents", "#/station"].some((route) => (location.hash || "").startsWith(route))) renderRoute();
  }
}

function scheduleIncidentRefresh() {
  clearTimeout(incidentRefreshTimer);
  incidentRefreshTimer = setTimeout(refreshIncidentBackend, 100);
}

function startIncidentBackend() {
  if (!incidentInitialized) {
    incidentInitialized = true;
    scheduleIncidentRefresh();
  }
  if (incidentEventSource) return;
  incidentEventSource = new EventSource(`${MONITORING_API_BASE}/incidents/events/stream`);
  incidentEventSource.addEventListener("open", scheduleIncidentRefresh);
  incidentEventSource.addEventListener("incident", scheduleIncidentRefresh);
  incidentEventSource.addEventListener("error", () => { incidentBackend.status = "offline"; });
}

function stopIncidentBackend() {
  incidentEventSource?.close();
  incidentEventSource = null;
  incidentInitialized = false;
  clearTimeout(incidentRefreshTimer);
}

async function postIncidentAction(path, body, successMessage) {
  try {
    const response = await fetch(`${MONITORING_API_BASE}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "incident_action_failed");
    if (payload.incident?.id) selectedIncidentId = payload.incident.id;
    showToast(successMessage);
    await refreshIncidentBackend();
    return payload;
  } catch (error) {
    showToast(`操作未完成：${error.message}`);
    return null;
  }
}

function timelineTemplate(incident) {
  if (!incident?.timeline?.length) return `<div class="incident-empty">暂无处置时间线</div>`;
  return `<ol class="incident-timeline">${incident.timeline.map((item) => `<li><time>${incidentTime(item.occurred_at)}</time><strong>${escapeHtml(item.event_type)}</strong><span>${escapeHtml(item.actor)}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</span></li>`).join("")}</ol>`;
}

function incidentCommandTemplate() {
  const pendingSignals = incidentBackend.signals.filter((item) => item.verification_status === "pending");
  const signal = pendingSignals.find((item) => item.monitoring_event_id === selectedSignalEventId) || pendingSignals[0];
  const incident = incidentBackend.incidents.find((item) => item.id === selectedIncidentId) || incidentBackend.incidents[0];
  const stations = incident ? incidentBackend.stations.filter((item) => item.district === incident.district) : [];
  return `
    <section class="incident-console" aria-labelledby="incident-console-title">
      <header class="incident-console-header"><div><span>COMMAND / SYNTHETIC INCIDENT</span><h1 id="incident-console-title">消防接处警与指挥台</h1><p>模拟角色 · 合成警情 · 未连接 119</p></div><div class="incident-live ${incidentBackend.status}"><b></b>${incidentBackend.status === "live" ? "数据库与 SSE 在线" : "正在连接本地后端"}</div></header>
      <div class="incident-grid">
        <aside class="incident-queue" aria-label="设备信号与警情队列">
          <h2>待核实设备信号 <b>${pendingSignals.length}</b></h2>
          <div class="incident-list">${pendingSignals.length ? pendingSignals.map((item) => `<button type="button" data-signal-select="${item.monitoring_event_id}" class="${item.monitoring_event_id === signal?.monitoring_event_id ? "active" : ""}"><strong>${escapeHtml(item.enterprise_name)}</strong><span>#${item.monitoring_event_id} · ${incidentTime(item.occurred_at)}</span></button>`).join("") : `<div class="incident-empty">暂无待核实信号</div>`}</div>
          ${signal ? `<div class="signal-actions"><button type="button" data-action="dismiss-device-signal">排除信号</button><button type="button" class="danger" data-action="confirm-device-signal">确认警情</button></div>` : ""}
          <h2>合成警情 <b>${incidentBackend.incidents.length}</b></h2>
          <div class="incident-list">${incidentBackend.incidents.length ? incidentBackend.incidents.map((item) => `<button type="button" data-incident-select="${item.id}" class="${item.id === incident?.id ? "active" : ""}"><strong>警情 #${item.id} · ${escapeHtml(item.enterprise_name)}</strong><span>${window.FireGuardEngine.incidentStatusLabel(item.status)}</span></button>`).join("") : `<div class="incident-empty">人工确认后才会生成警情</div>`}</div>
        </aside>
        <main class="incident-main">
          ${incident ? `<div class="incident-title-row"><div><span>INCIDENT #${incident.id}</span><h2>${escapeHtml(incident.enterprise_name)}</h2><p>${escapeHtml(incident.district)} · ${escapeHtml(incident.response_brief.address)}</p></div><strong>${window.FireGuardEngine.incidentStatusLabel(incident.status)}</strong></div>
          <section class="response-brief"><header><i data-lucide="shield-alert"></i><div><span>AI 首战提示 · 规则草案</span><h3>现场信息卡</h3></div></header>${incident.response_brief.items.map((item) => `<div><strong>${escapeHtml(item.text)}</strong><small>来源：${escapeHtml(item.sources.join("、"))}</small></div>`).join("")}<p>${escapeHtml(incident.response_brief.disclaimer)}</p></section>` : `<div class="incident-empty large">选择待核实信号，人工确认后建立合成警情</div>`}
        </main>
        <aside class="incident-dispatch" aria-label="力量调派与时间线">
          <h2>辖区力量</h2>
          ${incident && !incident.dispatch ? `<select id="dispatch-station">${stations.map((item) => `<option value="${item.id}" ${item.status !== "available" ? "disabled" : ""}>${escapeHtml(item.name)} · ${window.FireGuardEngine.stationStatusLabel(item.status)}</option>`).join("")}</select><button type="button" class="dispatch-button" data-action="dispatch-incident">下达调派</button>` : incident?.dispatch ? `<div class="dispatch-card"><strong>${escapeHtml(incident.dispatch.station_name)}</strong><span>${window.FireGuardEngine.incidentStatusLabel(incident.status)}</span></div>` : `<div class="incident-empty">等待警情</div>`}
          <h2>处置时间线</h2>${timelineTemplate(incident)}
        </aside>
      </div>
    </section>`;
}

function stationTerminalTemplate() {
  const task = incidentBackend.tasks.find((item) => item.id === selectedStationTaskId) || incidentBackend.tasks[0];
  const nextAction = task?.dispatch ? window.FireGuardEngine.nextStationAction(task.dispatch.status) : null;
  return `
    <section class="station-console" aria-labelledby="station-console-title">
      <header class="station-console-header"><div><span>STATION TERMINAL / SYNTHETIC TASK</span><h1 id="station-console-title">${escapeHtml(incidentBackend.station?.name || "消防救援站接警终端")}</h1><p>模拟角色 · 合成警情 · 未连接 119</p></div><strong>${window.FireGuardEngine.stationStatusLabel(incidentBackend.station?.status)}</strong></header>
      <div class="station-grid"><aside class="station-task-list"><h2>本站任务</h2>${incidentBackend.tasks.length ? incidentBackend.tasks.map((item) => `<button type="button" data-station-task="${item.id}" class="${item.id === task?.id ? "active" : ""}"><strong>警情 #${item.id}</strong><span>${escapeHtml(item.enterprise_name)} · ${window.FireGuardEngine.incidentStatusLabel(item.status)}</span></button>`).join("") : `<div class="incident-empty">暂无调派任务</div>`}</aside>
      <main class="station-task-detail">${task ? `<div class="incident-title-row"><div><span>任务 #${task.dispatch.id}</span><h2>${escapeHtml(task.enterprise_name)}</h2><p>${escapeHtml(task.response_brief.address)}</p></div><strong>${window.FireGuardEngine.incidentStatusLabel(task.status)}</strong></div>
        <section class="station-brief">${task.response_brief.items.map((item) => `<div><strong>${escapeHtml(item.text)}</strong><small>${escapeHtml(item.sources.join("、"))}</small></div>`).join("")}<p>${escapeHtml(task.response_brief.disclaimer)}</p></section>
        ${nextAction ? `<button type="button" class="station-action" data-action="station-next-action" data-next-action="${nextAction.action}">${nextAction.label}</button>` : ""}
        ${task.dispatch.status === "arrived" && !task.report ? `<section class="first-report"><h3>现场首报</h3><textarea id="report-situation" maxlength="300" placeholder="填写现场情况（1–300 字）"></textarea><select id="report-people"><option value="unknown">人员情况未知</option><option value="no_risk">无被困风险</option><option value="at_risk">存在风险</option></select><button type="button" data-action="submit-first-report">提交首报</button></section>` : task.report ? `<div class="report-received"><strong>首报已提交</strong><span>${escapeHtml(task.report.situation)}</span></div>` : ""}` : `<div class="incident-empty large">等待总队下达合成警情任务</div>`}</main>
      <aside class="station-timeline"><h2>任务时间线</h2>${timelineTemplate(task)}</aside></div>
    </section>`;
}

function homeTemplate() {
  return `
    <section class="workspace-home" aria-labelledby="workspace-home-title">
      <header class="workspace-home-header">
        <span>FIREGUARD / OPERATION WORKSPACES</span>
        <h1 id="workspace-home-title">选择工作台</h1>
        <p>不同岗位使用独立页面。日常消防安全监管、企业明细和真实警情接处警不再混在同一个界面。</p>
      </header>
      <div class="workspace-grid">
        ${workspaces.map((workspace, index) => `
          <a class="workspace-card ${["inspections", "incidents", "station"].includes(workspace.route) ? "workspace-card-ready" : ""}" href="#/${workspace.route}" data-workspace-link>
            <span class="workspace-index">0${index + 1}</span>
            <span class="workspace-icon"><i data-lucide="${workspace.icon}"></i></span>
            <small>${workspace.role}</small>
            <h2>${workspace.title}</h2>
            <p>${workspace.description}</p>
            <span class="workspace-status">${workspace.status}<i data-lucide="arrow-up-right"></i></span>
          </a>
        `).join("")}
      </div>
      <aside class="workspace-boundary"><i data-lucide="shield-check"></i><span><strong>数据边界</strong>设备火警信号用于日常监管；经人工核实后建立的消防救援警情才进入接处警流程。</span></aside>
      <a class="copilot-entry" href="#/copilot">
        <i data-lucide="sparkles"></i>
        <span><strong>FireGuard Copilot · GOAI 参赛演示</strong>设备火警信号 → 证据补全 → 人工核实 → 辅助调派 → 三端交付，三个场景可离线回放。</span>
        <i data-lucide="arrow-right"></i>
      </a>
    </section>
  `;
}

function workspacePlaceholderTemplate(routeName) {
  const workspace = workspaces.find((item) => item.route.split("/")[0] === routeName) || workspaces[0];
  return `
    <section class="workspace-placeholder" aria-labelledby="placeholder-title">
      <div class="placeholder-panel">
        <span class="workspace-icon"><i data-lucide="${workspace.icon}"></i></span>
        <small>${workspace.role}</small>
        <h1 id="placeholder-title">${workspace.title}</h1>
        <p>${workspace.description}</p>
        <div class="placeholder-scope"><strong>本轮已完成</strong><span>独立入口、角色边界和路由已经建立。具体业务页面按开发计划逐项接入。</span></div>
        <a class="secondary-action" href="#/home"><i data-lucide="arrow-left"></i>返回工作台</a>
      </div>
    </section>
  `;
}

function monitoringTemplate() {
  const company = selectedCompany();
  const profile = monitoringProfiles[company.id];
  const summary = monitoringBackend.summary || { enterprise_count: 5, online_rate: 88, pending_signal_count: 4, maintenance_overdue: 4 };
  const queueCompanies = monitoringBackend.enterpriseIds.map((id) => companies.find((item) => item.id === id)).filter(Boolean);
  return `
    <section class="monitoring-page" aria-labelledby="monitoring-title">
      <header class="monitoring-header">
        <div><span>辖区实时态势 · ${monitoringBackend.status === "live" ? "实时数据" : "本地演示数据"}</span><h1 id="monitoring-title">重点单位监测中心</h1><p>设备信号用于风险核实，不直接建立消防救援警情。</p><span class="monitoring-connection ${monitoringBackend.status}" data-monitoring-connection><b></b>${monitoringBackend.status === "live" ? "后端实时连接" : monitoringBackend.status === "connecting" ? "正在连接后端" : "使用本地演示数据"}</span></div>
        <div class="monitoring-kpis" aria-label="辖区汇总">
          <div><small>演示单位</small><strong>${summary.enterprise_count}</strong></div><div><small>在线率</small><strong>${summary.online_rate}%</strong></div><div><small>待核实信号</small><strong class="status-red">${summary.pending_signal_count}</strong></div><div><small>维保逾期</small><strong class="status-amber">${summary.maintenance_overdue}</strong></div>
        </div>
      </header>
      <div class="monitoring-layout">
        <aside class="monitoring-list" aria-labelledby="monitoring-list-title">
          <div class="monitoring-panel-title"><div><span>RISK QUEUE</span><h2 id="monitoring-list-title">异常单位排序</h2></div><i data-lucide="list-filter"></i></div>
          <div class="monitoring-company-list">
            ${queueCompanies.map((item, index) => `<button type="button" class="monitoring-company ${item.id === company.id ? "active" : ""}" data-monitoring-company="${item.id}" aria-pressed="${item.id === company.id}"><span>0${index + 1}</span><span><strong>${item.name}</strong><small>${monitoringProfiles[item.id].district} · 在线 ${monitoringProfiles[item.id].online}</small></span>${riskBadge(item)}</button>`).join("")}
          </div>
          <div class="monitoring-source"><i data-lucide="database"></i><span>报警、物联网、维保、检查数据已汇总</span></div>
        </aside>
        <section class="twin-panel" aria-labelledby="twin-title">
          <header><div><span>DIGITAL TWIN / SYNTHETIC DATA</span><h2 id="twin-title">辖区三维消防态势</h2></div><div class="twin-actions"><button type="button" data-action="inject-demo-event"><i data-lucide="radio-tower"></i>模拟设备火警</button><button type="button" data-3d-view="top"><i data-lucide="map"></i>俯视</button><button type="button" data-3d-view="reset"><i data-lucide="rotate-ccw"></i>复位</button></div></header>
          <div id="monitoring-3d" class="twin-viewport" data-selected-company="${company.id}" data-risk-levels="${queueCompanies.map((item) => `${item.id}:${item.level}`).join(",")}" role="img" aria-label="可旋转的辖区建筑群与重点单位消防风险三维视图">
            <div class="twin-loading"><span></span>正在加载三维态势</div>
            <div class="twin-overlay twin-legend"><span><b class="risk-dot high"></b>高风险</span><span><b class="risk-dot medium"></b>中风险</span><span><b class="risk-dot low"></b>低风险</span><span><b class="risk-dot unrated"></b>数据不足</span></div>
            <div class="twin-overlay twin-hint"><i data-lucide="mouse-pointer-2"></i>拖动旋转 · 滚轮缩放 · 点击风险柱</div>
          </div>
        </section>
        <aside class="monitoring-detail" aria-labelledby="monitoring-detail-title">
          <div class="detail-eyebrow"><span>${profile.district}</span>${riskBadge(company)}</div>
          <h2 id="monitoring-detail-title">${company.name}</h2>
          <p>${company.industry} · ${company.building}</p>
          <div class="health-index"><span>消防健康指数</span><strong>${scoreText(company.score)}<small>/100</small></strong><div><i style="width:${company.score || 8}%"></i></div></div>
          <section class="signal-list" aria-label="风险证据">
            <h3>风险证据</h3>
            <div class="signal-danger"><i data-lucide="siren"></i><span><strong>${profile.signal}</strong><small>等待人工核实</small></span></div>
            <div><i data-lucide="radio-tower"></i><span><strong>${profile.fault}</strong><small>近 30 天趋势</small></span></div>
            <div><i data-lucide="wrench"></i><span><strong>${profile.maintenance}</strong><small>维保记录汇总</small></span></div>
          </section>
          <dl class="monitoring-meta"><div><dt>数据在线率</dt><dd>${profile.online}</dd></div><div><dt>最近更新</dt><dd>${profile.freshness}</dd></div><div><dt>未闭环隐患</dt><dd>${company.openHazards}</dd></div></dl>
          <button class="monitoring-primary" type="button" data-action="verify-signal"><i data-lucide="shield-alert"></i>发起人工核实</button>
          <button class="monitoring-secondary" type="button" data-action="company-overview">查看企业概览</button>
        </aside>
      </div>
    </section>
  `;
}

function inspectionTemplate() {
  return `
    <section class="inspection-workspace">
      <header class="workspace-context-bar">
        <div><span>防火监督人员</span><h1>监督检查与隐患闭环</h1><p>现场检查、证据记录、企业整改与专项复查</p></div>
        <a href="#/analysis/${selectedCompanyId}" class="secondary-action"><i data-lucide="file-text"></i>AI 分析报告</a>
      </header>
      ${workbenchTemplate()}
    </section>
  `;
}

function companyRail(company) {
  return `
    <aside class="company-rail" aria-labelledby="company-ranking-title">
      <div class="rail-title">
        <h2 id="company-ranking-title">检查对象与风险线索</h2>
        <button type="button" class="help-button" aria-label="检查优先级说明" data-action="ranking-help"><i data-lucide="circle-help"></i></button>
      </div>
      <div class="company-list">
        ${companies.map((item, index) => `
          <button class="company-row ${item.id === company.id ? "active" : ""}" type="button" data-company-id="${item.id}" aria-pressed="${item.id === company.id}">
            <span class="rank rank-${item.level}">${index + 1}</span>
            <span class="company-row-copy"><strong>${item.name}</strong><small>综合得分 ${scoreText(item.score)} · 未闭环 ${item.openHazards}</small></span>
            ${riskBadge(item)}
          </button>
        `).join("")}
      </div>
      <button class="secondary-action" type="button" data-action="company-detail"><i data-lucide="building-2"></i>查看企业详情</button>
      <div class="rail-note"><i data-lucide="shield-alert"></i><span>Demo 分数仅用于辅助分析，不替代现场检查和专业判断。</span></div>
    </aside>
  `;
}

function workbenchTemplate() {
  const company = selectedCompany();
  return `
    <div class="workbench-shell">
      ${companyRail(company)}
      <section class="plan-workspace" aria-labelledby="company-title">
        <header class="company-context">
          <div>
            <div class="company-title-line"><h1 id="company-title">${company.name}</h1>${riskBadge(company)}</div>
            <p>${company.building}<span>建筑面积 ${company.area}</span><span>地上 1 层</span><span>投用时间 2023-05</span></p>
          </div>
          <label class="building-select">切换建筑/区域<select><option>${company.building}</option><option>原料仓库</option><option>消防泵房</option></select></label>
        </header>

        <section class="plan-panel" aria-labelledby="plan-title">
          <div class="plan-toolbar">
            <h2 id="plan-title">建筑消防平面与隐患定位</h2>
            <div class="plan-legend" aria-label="消防图例">
              <span><i data-lucide="square-dashed"></i>防火分区</span>
              <span class="legend-route"><i data-lucide="move-right"></i>疏散路线</span>
              <span class="legend-exit"><i data-lucide="door-open"></i>安全出口</span>
              <span class="legend-fire"><i data-lucide="fire-extinguisher"></i>灭火器</span>
              <span class="legend-water"><i data-lucide="droplets"></i>消火栓</span>
            </div>
          </div>
          <div class="plan-viewport">
            <div id="plan-canvas" class="plan-canvas" style="--plan-zoom: ${planZoom}">
              <img src="assets/fire-floorplan.png" alt="1 号生产厂房消防平面图，包含防火分区、疏散路线和消防设施位置" />
              ${issues.map((issue) => `<button class="map-pin ${issue.id === selectedIssueId ? "active" : ""}" style="--pin-left:${issue.pin.left}%;--pin-top:${issue.pin.top}%" type="button" data-issue-id="${issue.id}" aria-label="隐患 ${issue.number}：${issue.title}">${issue.number}</button>`).join("")}
            </div>
            <div class="zoom-controls" aria-label="平面图缩放">
              <button type="button" data-action="zoom-in" aria-label="放大"><i data-lucide="plus"></i></button>
              <button type="button" data-action="zoom-out" aria-label="缩小"><i data-lucide="minus"></i></button>
              <button type="button" data-action="zoom-reset">适应窗口</button>
            </div>
          </div>
        </section>

        <section class="route-section" aria-labelledby="route-title">
          <div class="section-heading"><div><h2 id="route-title">今日检查路线与状态</h2><span>2026-07-29</span></div><button type="button" data-action="route-history">查看历史路线<i data-lucide="chevron-right"></i></button></div>
          <div class="route-list">
            ${inspectionRoute.map((step, index) => `
              <button class="route-step route-${step.tone}" type="button" ${step.issueId ? `data-issue-id="${step.issueId}"` : ""}>
                <span class="route-number">${step.number}</span><strong>${step.title}</strong><small>${step.status}</small><time>${step.time}</time>
              </button>${index < inspectionRoute.length - 1 ? `<i class="route-arrow" data-lucide="arrow-right"></i>` : ""}
            `).join("")}
          </div>
          <div class="route-key"><span><b class="dot dot-muted"></b>待检查</span><span><b class="dot dot-amber"></b>检查中</span><span><b class="dot dot-orange"></b>隐患整改中</span><span><b class="dot dot-red"></b>待复查</span><span><b class="dot dot-green"></b>已闭环</span></div>
        </section>
      </section>
      ${rightPanel()}
    </div>
  `;
}

function rightPanel() {
  return `
    <aside class="risk-panel" aria-label="企业消防问题详情">
      <div class="panel-tabs" role="tablist">
        <button type="button" role="tab" data-panel-tab="hazards" aria-selected="${activeRightTab === "hazards"}" class="${activeRightTab === "hazards" ? "active" : ""}">隐患与整改</button>
        <button type="button" role="tab" data-panel-tab="equipment" aria-selected="${activeRightTab === "equipment"}" class="${activeRightTab === "equipment" ? "active" : ""}">设备设施状态</button>
      </div>
      ${activeRightTab === "hazards" ? hazardPanelContent() : equipmentPanelContent()}
    </aside>
  `;
}

function hazardPanelContent() {
  const visibleIssues = hazardFilter === "all" ? issues : issues.filter((issue) => issue.statusType === hazardFilter);
  return `
    <div class="filter-pills" aria-label="隐患筛选">
      <button class="${hazardFilter === "all" ? "active" : ""}" type="button" data-hazard-filter="all">全部 <b>18</b></button>
      <button class="${hazardFilter === "urgent" ? "active" : ""}" type="button" data-hazard-filter="urgent">待整改 <b>8</b></button>
      <button class="${hazardFilter === "progress" ? "active" : ""}" type="button" data-hazard-filter="progress">待复查 <b>5</b></button>
      <button type="button" data-hazard-filter="closed">已闭环 <b>5</b></button>
    </div>
    <div class="panel-filters"><select aria-label="隐患状态"><option>全部状态</option><option>逾期</option><option>重复隐患</option></select><select aria-label="隐患排序"><option>按发现时间</option><option>按整改期限</option></select></div>
    <div class="issue-list">
      ${visibleIssues.length ? visibleIssues.map(issueCard).join("") : `<div class="empty-panel"><i data-lucide="circle-check-big"></i><strong>当前筛选没有隐患</strong><span>已闭环记录可在历史列表中查看。</span></div>`}
    </div>
    <div class="panel-pagination"><span>共 18 条</span><div><button type="button" disabled><i data-lucide="chevron-left"></i></button><button type="button" class="active">1</button><button type="button">2</button><button type="button">3</button><button type="button"><i data-lucide="chevron-right"></i></button></div></div>
  `;
}

function issueCard(issue) {
  return `
    <article class="issue-card issue-${issue.statusType} ${issue.id === selectedIssueId ? "selected" : ""}" data-issue-card="${issue.id}">
      <button class="issue-select" type="button" data-issue-id="${issue.id}" aria-label="在平面图定位${issue.title}"><span>${issue.number}</span><strong>${issue.title}</strong><small>${issue.status}</small></button>
      <div class="issue-location">${issue.location}<span>${issue.tag}</span></div>
      <dl><div><dt>问题描述</dt><dd>${issue.description}</dd></div><div><dt>责任部门</dt><dd>${issue.department}</dd></div><div><dt>整改责任人</dt><dd>${issue.owner}</dd></div><div><dt>整改期限</dt><dd>${issue.dueAt} <b>${issue.dueText}</b></dd></div><div><dt>发现时间</dt><dd>${issue.foundAt}</dd></div></dl>
      <div class="evidence-row"><img src="${issue.image}" alt="${issue.title}现场证据照片" /><span>证据（1）</span><button type="button" data-action="open-evidence" data-issue-id="${issue.id}"><i data-lucide="paperclip"></i><span class="sr-only">查看证据</span></button></div>
      <div class="issue-footer"><span>${issue.repeated}</span><button type="button" data-action="reinspect" data-issue-id="${issue.id}">${issue.number === 1 ? "发起专项复查" : "查看整改详情"}</button></div>
    </article>
  `;
}

function equipmentPanelContent() {
  return `
    <div class="equipment-summary"><div><strong>40</strong><span>设备总数</span></div><div><strong class="status-green">37</strong><span>正常</span></div><div><strong class="status-amber">2</strong><span>故障</span></div><div><strong class="status-red">1</strong><span>离线</span></div></div>
    <div class="equipment-list">
      ${equipment.map((item) => `<button type="button" data-action="equipment-detail"><span class="equipment-icon"><i data-lucide="${item.icon}"></i></span><span><strong>${item.name}</strong><small>${item.location} · 更新 ${item.updated}</small></span><b class="${item.state.includes("正常") ? "status-green" : item.state.includes("故障") ? "status-amber" : "status-red"}">${item.state}</b><i data-lucide="chevron-right"></i></button>`).join("")}
    </div>
    <button class="primary-action panel-primary" type="button" data-action="all-equipment"><i data-lucide="list-checks"></i>查看全部设备</button>
  `;
}

function reportTemplate() {
  const company = selectedCompany();
  const assessment = company.id === latestAssessment.enterpriseId ? latestAssessment : null;
  const score = assessment?.totalScore ?? company.score;
  const level = assessment?.riskLevel || company.level;
  const rules = assessment?.triggeredRules || [];
  return `
    <section class="report-page">
        <header class="report-header"><div><span>结构化模板生成 · ${assessment?.ruleVersion || DEMO_RULESET}</span><h1>${company.name}消防健康分析报告</h1><p>数据截止 ${assessment?.dataCutoff?.replace("T", " ").slice(0, 16) || DATA_CUTOFF} · 当前得分 ${scoreText(score)} · ${riskLabel(level)}</p></div><a href="#/inspections" class="secondary-action"><i data-lucide="arrow-left"></i>返回监督检查工具</a></header>
      <div class="report-layout">
        <aside class="report-facts"><h2>结构化事实</h2><div><span>触发规则</span><strong>${rules.length}</strong></div><div><span>累计扣分</span><strong>${score === null ? "—" : 100 - score}</strong></div><div><span>原始证据</span><strong>${rules.reduce((sum, rule) => sum + rule.evidence.length, 0)}</strong></div><div><span>数据状态</span><strong>${level === "unrated" ? "不足" : "完整"}</strong></div><p>输入指纹 ${assessment?.inputHash || "未导入"}<br />以上字段来自确定性规则，报告不得改写数值。</p></aside>
        <article class="report-document"><div class="document-meta"><span>报告状态：草稿</span><button type="button" data-action="save-report">保存修订</button></div><textarea id="report-editor">${reportText(company, assessment)}</textarea><div class="document-actions"><button type="button" data-action="regenerate">重新生成</button><button class="primary-action" type="button" data-action="confirm-report">确认报告</button></div></article>
      </div>
    </section>
  `;
}

function reportText(company, assessment) {
  const score = assessment?.totalScore ?? company.score;
  const level = assessment?.riskLevel || company.level;
  const ruleLines = assessment?.triggeredRules?.length
    ? assessment.triggeredRules.map((rule, index) => `${index + 1}. ${rule.title}（${rule.code}）\n   指标：${rule.metric || "数据缺失"}；扣分：${rule.deduction}；证据：${rule.evidence.length} 条。`).join("\n")
    : "当前没有可用的结构化评分结果。";
  return `一、总体结论\n\n${company.name}当前消防健康指数为 ${scoreText(score)}，风险等级为${riskLabel(level)}。本报告基于 ${assessment?.ruleVersion || DEMO_RULESET} 确定性规则生成。\n\n二、重点风险与证据\n\n${ruleLines}\n\n三、建议行动\n\n优先处理逾期整改和重复隐患，核对消防控制室值班记录、人员履职与火警处置流程，并跟踪现场隐患至复查闭环。\n\n四、数据局限\n\n${level === "unrated" ? "当前数据缺失或无效，不能据此判断设施运行正常。" : "当前数据满足 Demo 评分要求，正式结论仍需结合现场检查和专家判断。"}\n\n声明：本报告仅用于内部辅助分析，不替代法定检查、行政执法结论或消防专业判断。`;
}

function renderRoute() {
  const route = (location.hash || "#/home").replace(/^#\//, "").split("/");
  let root = route[0] || "home";
  if (root === "workbench") {
    root = "inspections";
    history.replaceState(null, "", "#/inspections");
  }
  document.querySelectorAll("[data-top-nav]").forEach((item) => item.classList.remove("active"));
  document.querySelector(`[data-top-nav="${root}"]`)?.classList.add("active");
  document.querySelectorAll("[data-mobile-nav]").forEach((item) => item.classList.toggle("active", item.dataset.mobileNav === root));
  const importButton = document.querySelector(".header-import");
  if (importButton) importButton.hidden = !["inspections", "analysis"].includes(root);
  document.body.dataset.route = root;
  if (root === "analysis") {
    if (route[1]) selectedCompanyId = route[1];
    app.innerHTML = reportTemplate();
  } else if (root === "inspections") {
    app.innerHTML = inspectionTemplate();
  } else if (root === "home") {
    app.innerHTML = homeTemplate();
  } else if (root === "monitoring") {
    app.innerHTML = monitoringTemplate();
  } else if (root === "incidents") {
    app.innerHTML = incidentCommandTemplate();
  } else if (root === "copilot") {
    app.innerHTML = copilotTemplate();
    loadCopilotScenarios();
  } else if (root === "station") {
    app.innerHTML = stationTerminalTemplate();
  } else if (root === "enterprises") {
    app.innerHTML = workspacePlaceholderTemplate(root);
  } else {
    app.innerHTML = homeTemplate();
  }
  bindDynamicActions();
  refreshIcons();
  window.dispatchEvent(new CustomEvent("fireguard:route-rendered", { detail: { root } }));
  if (root === "monitoring") startMonitoringBackend();
  else if (monitoringEventSource) stopMonitoringBackend();
  if (["incidents", "station"].includes(root)) startIncidentBackend();
  else if (incidentEventSource) stopIncidentBackend();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function bindDynamicActions() {
  app.querySelectorAll("[data-signal-select]").forEach((button) => button.addEventListener("click", () => {
    selectedSignalEventId = Number(button.dataset.signalSelect); renderRoute();
  }));
  app.querySelectorAll("[data-incident-select]").forEach((button) => button.addEventListener("click", () => {
    selectedIncidentId = Number(button.dataset.incidentSelect); renderRoute();
  }));
  app.querySelectorAll("[data-station-task]").forEach((button) => button.addEventListener("click", () => {
    selectedStationTaskId = Number(button.dataset.stationTask); renderRoute();
  }));
  app.querySelectorAll("[data-monitoring-company]").forEach((button) => button.addEventListener("click", () => {
    selectedCompanyId = button.dataset.monitoringCompany;
    renderRoute();
  }));

  app.querySelectorAll("[data-company-id]").forEach((button) => button.addEventListener("click", () => {
    selectedCompanyId = button.dataset.companyId;
    selectedIssueId = issues[0].id;
    renderRoute();
  }));

  app.querySelectorAll("[data-issue-id]").forEach((button) => button.addEventListener("click", () => {
    selectedIssueId = button.dataset.issueId;
    renderRoute();
    document.querySelector(`[data-issue-card="${selectedIssueId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }));

  app.querySelectorAll("[data-panel-tab]").forEach((button) => button.addEventListener("click", () => {
    activeRightTab = button.dataset.panelTab;
    renderRoute();
  }));

  app.querySelectorAll("[data-hazard-filter]").forEach((button) => button.addEventListener("click", () => {
    hazardFilter = button.dataset.hazardFilter;
    renderRoute();
  }));

  app.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => handleAction(button.dataset.action, button.dataset.issueId)));

  app.querySelectorAll("[data-copilot-scenario]").forEach((button) => button.addEventListener("click", () => {
    copilotState.selectedId = button.dataset.copilotScenario;
    renderRoute();
  }));
  app.querySelectorAll("[data-copilot-mode]").forEach((button) => button.addEventListener("click", () => {
    copilotState.mode = button.dataset.copilotMode;
    renderRoute();
  }));
  app.querySelectorAll("[data-copilot-action]").forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.copilotAction;
    if (action === "run") runCopilotScenario();
    else if (action === "reset") resetCopilot();
    else if (action === "dispatch") confirmCopilotDispatch();
    else if (action === "export-audit") exportCopilotAuditPack();
  }));
  app.querySelectorAll("[data-copilot-verify]").forEach((button) => button.addEventListener("click", () => {
    confirmCopilotVerification(button.dataset.copilotVerify);
  }));
}

const expectedCsvFiles = ["alarm_events.csv", "enterprises.csv", "findings.csv", "iot_devices.csv", "maintenance_records.csv"];

function bindDialogs() {
  const fileInput = document.querySelector("#csv-files");
  const runImport = document.querySelector("#run-import");
  fileInput.addEventListener("change", () => {
    const names = [...fileInput.files].map((file) => file.name).sort();
    document.querySelector("#import-file-list").textContent = names.length ? names.join(" · ") : "尚未选择文件";
    runImport.disabled = names.length !== expectedCsvFiles.length;
    document.querySelector("#import-result").textContent = "";
  });
  runImport.addEventListener("click", async () => {
    runImport.disabled = true;
    runImport.textContent = "正在校验…";
    const resultBox = document.querySelector("#import-result");
    try {
      const assessment = await importCsvFiles([...fileInput.files]);
      resultBox.className = "import-result success";
      resultBox.textContent = `导入成功：${assessment.totalScore ?? "—"} 分，${riskLabel(assessment.riskLevel)}，触发 ${assessment.triggeredRules.length} 条规则，输入指纹 ${assessment.inputHash || "无"}`;
      showToast("CSV 数据已校验并完成风险评分");
    } catch (error) {
      resultBox.className = "import-result error";
      resultBox.textContent = error.message;
    } finally {
      runImport.textContent = "校验并评分";
      runImport.disabled = false;
    }
  });

  document.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", () => document.querySelector(`#${button.dataset.dialogClose}`)?.close()));
  document.querySelector("#start-reinspection").addEventListener("click", () => {
    workflowStarted = true;
    renderWorkflow(selectedIssue());
    showToast("专项复查已发起，操作记录已追加到时间线");
  });
}

async function importCsvFiles(files) {
  const names = files.map((file) => file.name).sort();
  if (JSON.stringify(names) !== JSON.stringify(expectedCsvFiles)) throw new Error(`文件不完整，应选择：${expectedCsvFiles.join("、")}`);
  if (files.some((file) => file.size > 1_000_000)) throw new Error("单个 CSV 不得超过 1 MB");
  const bundle = {};
  for (const file of files) {
    bundle[file.name] = window.FireGuardEngine.parseCsv(await file.text());
  }
  const validation = window.FireGuardEngine.validateBundle(bundle);
  if (!validation.valid) throw new Error(validation.errors.slice(0, 3).join("；"));

  latestAssessment = window.FireGuardEngine.scoreBundle(bundle);
  const company = companies.find((item) => item.id === latestAssessment.enterpriseId);
  if (company) {
    company.score = latestAssessment.totalScore;
    company.level = latestAssessment.riskLevel;
    company.levelLabel = riskLabel(latestAssessment.riskLevel);
    company.openHazards = bundle["findings.csv"].filter((finding) => !["verified", "closed"].includes(finding.status)).length;
  }
  selectedCompanyId = latestAssessment.enterpriseId || selectedCompanyId;
  renderRoute();
  return latestAssessment;
}

function openEvidence(issue) {
  document.querySelector("#evidence-title").textContent = issue.title;
  const image = document.querySelector("#evidence-image");
  image.src = issue.image;
  image.alt = `${issue.title}现场证据照片`;
  document.querySelector("#evidence-caption").textContent = `${issue.location} · ${issue.foundAt} · ${issue.description}`;
  document.querySelector("#evidence-dialog").showModal();
}

function openWorkflow(issue) {
  selectedIssueId = issue.id;
  renderWorkflow(issue);
  document.querySelector("#workflow-dialog").showModal();
}

function renderWorkflow(issue) {
  document.querySelector("#workflow-title").textContent = issue.title;
  document.querySelector("#workflow-summary").innerHTML = `<div><span>责任部门</span><strong>${issue.department}</strong></div><div><span>责任人</span><strong>${issue.owner}</strong></div><div><span>整改期限</span><strong>${issue.dueText}</strong></div>`;
  const steps = [
    [issue.foundAt, "发现隐患", `${issue.location}现场检查形成记录`],
    ["2026-07-09 10:20", "指派整改", `${issue.department} · ${issue.owner}`],
    ["2026-07-12 16:00", "提交整改", "已上传整改说明和现场证据"],
    [workflowStarted ? "2026-07-30 09:30" : "待处理", workflowStarted ? "专项复查已发起" : "等待复查", workflowStarted ? "复查任务已进入企业消防负责人待办" : "复查通过后才能关闭隐患"],
  ];
  document.querySelector("#workflow-timeline").innerHTML = steps.map((step, index) => `<li class="${index === steps.length - 1 ? "current" : "done"}"><time>${step[0]}</time><strong>${step[1]}</strong><span>${step[2]}</span></li>`).join("");
  const button = document.querySelector("#start-reinspection");
  button.disabled = workflowStarted;
  button.textContent = workflowStarted ? "专项复查已发起" : "发起专项复查";
  refreshIcons();
}

function handleAction(action, issueId) {
  if (action === "confirm-device-signal") return postIncidentAction(`/signals/${selectedSignalEventId}/verification`, { result: "confirmed", note: "人工核实确认（模拟）" }, "已建立合成警情，尚未连接 119");
  if (action === "dismiss-device-signal") return postIncidentAction(`/signals/${selectedSignalEventId}/verification`, { result: "dismissed", note: "人工核实排除（模拟）" }, "已排除设备信号，不创建警情");
  if (action === "dispatch-incident") {
    const stationId = document.querySelector("#dispatch-station")?.value;
    if (!stationId) return showToast("当前辖区没有可调派虚拟站点");
    return postIncidentAction(`/incidents/${selectedIncidentId}/dispatch`, { station_id: stationId }, "调派已下达至虚拟消防救援站");
  }
  if (action === "station-next-action") {
    const task = incidentBackend.tasks.find((item) => item.id === selectedStationTaskId) || incidentBackend.tasks[0];
    const nextAction = document.querySelector("[data-next-action]")?.dataset.nextAction;
    if (!task?.dispatch || !nextAction) return;
    return postIncidentAction(`/dispatches/${task.dispatch.id}/transition`, { action: nextAction, note: "站端状态反馈（模拟）" }, "任务状态已实时回传总队");
  }
  if (action === "submit-first-report") {
    const task = incidentBackend.tasks.find((item) => item.id === selectedStationTaskId) || incidentBackend.tasks[0];
    const situation = document.querySelector("#report-situation")?.value.trim();
    const peopleStatus = document.querySelector("#report-people")?.value;
    if (!situation) return showToast("请填写现场情况");
    return postIncidentAction(`/dispatches/${task.dispatch.id}/report`, { situation, people_status: peopleStatus }, "现场首报已回传总队");
  }
  if (action === "zoom-in" || action === "zoom-out" || action === "zoom-reset") {
    planZoom = action === "zoom-in" ? Math.min(1.5, planZoom + 0.1) : action === "zoom-out" ? Math.max(0.8, planZoom - 0.1) : 1;
    const canvas = document.querySelector("#plan-canvas");
    if (canvas) canvas.style.setProperty("--plan-zoom", planZoom);
    return;
  }
  if (action === "reinspect") {
    selectedIssueId = issueId || selectedIssueId;
    openWorkflow(selectedIssue());
    return;
  }
  if (action === "open-evidence") {
    selectedIssueId = issueId || selectedIssueId;
    openEvidence(selectedIssue());
    return;
  }
  if (action === "save-report") return showToast("报告修订已保存到当前演示会话");
  if (action === "regenerate") {
    const editor = document.querySelector("#report-editor");
    if (editor) editor.value = reportText(selectedCompany(), selectedCompanyId === latestAssessment.enterpriseId ? latestAssessment : null);
    return showToast("已根据结构化事实重新生成报告");
  }
  if (action === "confirm-report") return showToast("报告已确认（仅限演示）");
  if (action === "ranking-help") return showToast("风险线索用于安排检查优先级，不替代监督检查结论");
  if (action === "verify-signal") return postMonitoringEvent("verification_requested", "已建立人工核实任务，设备信号尚未转为消防救援警情");
  if (action === "inject-demo-event") return postMonitoringEvent("fire_alarm", "已写入一条合成设备火警，3D 态势正在更新");
  if (action === "company-overview") return showToast("企业概览将在下一阶段接入明细数据");
  if (action === "hazards") { activeRightTab = "hazards"; location.hash = "#/inspections"; renderRoute(); return; }
  if (action === "equipment") { activeRightTab = "equipment"; location.hash = "#/inspections"; renderRoute(); return; }
  if (action === "inspection") { activeRightTab = "hazards"; location.hash = "#/inspections"; renderRoute(); return; }
  if (action === "import-data") {
    document.querySelector("#import-dialog").showModal();
    return;
  }
  showToast("该功能将在下一阶段接入真实数据");
}

function bindHeaderActions() {
  document.querySelectorAll(".app-header [data-action]").forEach((button) => button.addEventListener("click", () => handleAction(button.dataset.action)));
}

function runSelfCheck() {
  console.assert(companies.length === 5, "Demo must contain five companies");
  console.assert(issues.length === 3, "Selected workbench needs three mapped issues");
  console.assert(issues.every((issue) => issue.image && issue.pin), "Every issue needs evidence and a map pin");
  console.assert(new Set(companies.map((company) => company.id)).size === companies.length, "Company IDs must be unique");
  console.assert(companies.every((company) => monitoringProfiles[company.id]), "Every company needs a monitoring profile");
}

window.addEventListener("fireguard:enterprise-selected", (event) => {
  if (!companies.some((company) => company.id === event.detail?.id)) return;
  selectedCompanyId = event.detail.id;
  renderRoute();
});

function selectedCopilotScenario() {
  return copilotState.scenarios?.find((item) => item.scenario_id === copilotState.selectedId) || copilotState.scenarios?.[0] || null;
}

async function loadCopilotScenarios() {
  if (copilotState.scenarios) return;
  try {
    const response = await fetch(`${MONITORING_API_BASE}/copilot/scenarios`);
    if (!response.ok) throw new Error("scenarios_unavailable");
    const payload = await response.json();
    copilotState.scenarios = payload.scenarios || [];
    copilotState.selectedId ||= copilotState.scenarios[0]?.scenario_id || null;
  } catch {
    copilotState.scenarios = [];
  }
  if ((location.hash || "").startsWith("#/copilot")) renderRoute();
}

async function copilotPost(path, body) {
  const response = await fetch(`${MONITORING_API_BASE}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.detail || "copilot_action_failed");
  return payload;
}

async function runCopilotScenario() {
  const scenario = selectedCopilotScenario();
  if (!scenario || copilotState.busy) return;
  copilotState.busy = true;
  renderRoute();
  try {
    const event = await copilotPost("/monitoring/events", {
      enterprise_id: scenario.enterprise_id,
      event_type: scenario.input.signal.event_type,
      severity: scenario.input.signal.severity,
      source: "copilot_demo",
      payload: scenario.input.signal.payload,
    });
    const run = await copilotPost("/copilot/runs", {
      enterprise_id: scenario.enterprise_id,
      event_id: event.id,
      reporter_text: scenario.input.reporter_text,
      image_assets: (scenario.input.images || []).map((image) => image.asset),
      scenario_id: scenario.scenario_id,
      mode: copilotState.mode,
    });
    copilotState.eventId = event.id;
    copilotState.run = run;
    copilotState.verification = null;
    copilotState.dispatch = null;
    copilotState.phase = run.plan.abstained ? "abstained" : "verification";
  } catch (error) {
    showToast(`Copilot 运行失败：${error.message}`);
    copilotState.phase = "select";
  } finally {
    copilotState.busy = false;
    renderRoute();
  }
}

async function confirmCopilotVerification(result) {
  const scenario = selectedCopilotScenario();
  if (!scenario || !copilotState.run || copilotState.busy) return;
  copilotState.busy = true;
  try {
    await copilotPost(`/signals/${copilotState.eventId}/verification`, { result, note: "Copilot 演示中的人工确认" });
    await copilotPost(`/copilot/runs/${copilotState.run.run_id}/approve`, { action: "verification_result" });
    copilotState.verification = result;
    if (result === "confirmed") {
      const run = await copilotPost("/copilot/runs", {
        enterprise_id: scenario.enterprise_id,
        event_id: copilotState.eventId,
        reporter_text: scenario.input.reporter_text,
        image_assets: (scenario.input.images || []).map((image) => image.asset),
        scenario_id: scenario.scenario_id,
        mode: copilotState.mode,
      });
      copilotState.run = run;
      copilotState.phase = "dispatch";
    } else {
      copilotState.phase = "closed";
    }
  } catch (error) {
    showToast(`核实登记失败：${error.message}`);
  } finally {
    copilotState.busy = false;
    renderRoute();
  }
}

async function confirmCopilotDispatch() {
  const run = copilotState.run;
  const draft = run?.trace.find((entry) => entry.name === "create_dispatch_draft" && entry.ok);
  if (!draft || copilotState.busy) return;
  copilotState.busy = true;
  try {
    await copilotPost(`/incidents/${run.incident_id}/dispatch`, { station_id: draft.data.station_id });
    await copilotPost(`/copilot/runs/${copilotState.run.run_id}/approve`, { action: "dispatch_order" });
    copilotState.dispatch = draft.data.station_id;
    copilotState.phase = "done";
  } catch (error) {
    showToast(`调派失败：${error.message}`);
  } finally {
    copilotState.busy = false;
    renderRoute();
  }
}

function resetCopilot() {
  copilotState.phase = "select";
  copilotState.run = null;
  copilotState.eventId = null;
  copilotState.verification = null;
  copilotState.dispatch = null;
  renderRoute();
}

function exportCopilotAuditPack() {
  const scenario = selectedCopilotScenario();
  const run = copilotState.run;
  if (!scenario || !run) return;
  const pack = {
    schema_version: "fireguard-audit-pack/v1",
    exported_at: new Date().toISOString(),
    simulation: true,
    boundaries: ["未连接119", "不控制真实设备", "AI不替代现场指挥"],
    run: {
      run_id: run.run_id,
      event_id: copilotState.eventId,
      scenario_id: scenario.scenario_id,
      mode: run.mode,
      model_name: run.model_name,
      fallback_reason: run.fallback_reason,
      intent: run.plan.intent,
      abstained: run.plan.abstained,
    },
    input: { reporter_text: scenario.input.reporter_text, images: scenario.input.images || [] },
    evidence: run.plan.evidence,
    rejected_evidence: run.rejected_evidence,
    tool_trace: run.trace,
    human_decisions: [
      copilotState.verification && { action: "verification_result", value: copilotState.verification },
      copilotState.dispatch && { action: "dispatch_order", value: copilotState.dispatch },
    ].filter(Boolean),
    role_briefs: run.trace.filter((entry) => entry.name === "build_role_brief" && entry.ok).map((entry) => entry.data),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `fireguard-audit-run-${run.run_id}.json` });
  link.click();
  URL.revokeObjectURL(url);
  showToast("可审计事件包已导出");
}

function copilotTemplate() {
  const scenario = selectedCopilotScenario();
  return `
    <section class="copilot-page" aria-labelledby="copilot-title">
      <header class="copilot-header">
        <div>
          <span>FIREGUARD / INCIDENT COPILOT</span>
          <h1 id="copilot-title">消防协同 Copilot</h1>
          <p>Agent 负责理解任务、补全证据和生成草稿；核实与调派由授权人员确认。</p>
        </div>
        <div class="copilot-badges">
          <span class="copilot-badge"><i data-lucide="flask-conical"></i>合成数据</span>
          <span class="copilot-badge"><i data-lucide="phone-off"></i>未连接 119</span>
          <span class="copilot-badge"><i data-lucide="shield-check"></i>AI 不替代现场指挥</span>
        </div>
      </header>
      ${copilotState.scenarios === null ? `<div class="copilot-empty">正在加载演示场景…</div>` : ""}
      ${Array.isArray(copilotState.scenarios) && copilotState.scenarios.length === 0 ? `<div class="copilot-empty">无法连接后端（${MONITORING_API_BASE}），请先启动后端服务。</div>` : ""}
      ${scenario ? copilotSelectTemplate(scenario) : ""}
      ${copilotState.run ? copilotRunTemplate() : ""}
    </section>
  `;
}

function copilotSelectTemplate(scenario) {
  if (copilotState.phase !== "select") {
    return `
      <div class="copilot-context">
        <strong>${escapeHtml(scenario.title)}</strong>
        <span>${copilotState.mode === "live" ? "Live 模型模式" : "场景回放模式"} · 信号事件 #${copilotState.eventId}</span>
        <button type="button" class="secondary-action" data-copilot-action="reset"><i data-lucide="rotate-ccw"></i>重新开始</button>
      </div>
    `;
  }
  return `
    <div class="copilot-setup">
      <div class="copilot-scenarios">
        ${copilotState.scenarios.map((item) => `
          <button type="button" class="copilot-scenario ${item.scenario_id === scenario.scenario_id ? "selected" : ""}" data-copilot-scenario="${item.scenario_id}">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.safe_failure)}</span>
          </button>
        `).join("")}
      </div>
      <div class="copilot-input">
        <div class="copilot-mode" role="group" aria-label="运行模式">
          <button type="button" class="${copilotState.mode === "scenario" ? "active" : ""}" data-copilot-mode="scenario">场景回放<small>离线可复现</small></button>
          <button type="button" class="${copilotState.mode === "live" ? "active" : ""}" data-copilot-mode="live">Live 模型<small>失败自动回退</small></button>
        </div>
        <div class="copilot-report">
          <h2>上报内容</h2>
          <p>${escapeHtml(scenario.input.reporter_text)}</p>
          ${(scenario.input.images || []).map((image) => `
            <figure><img src="${escapeHtml(image.asset)}" alt="${escapeHtml(image.note)}" /><figcaption>${escapeHtml(image.note)}</figcaption></figure>
          `).join("")}
        </div>
        <button type="button" class="primary-action copilot-run-button" data-copilot-action="run" ${copilotState.busy ? "disabled" : ""}>
          <i data-lucide="play"></i>${copilotState.busy ? "正在运行…" : "运行 Copilot"}
        </button>
      </div>
    </div>
  `;
}

function copilotRunTemplate() {
  const run = copilotState.run;
  const plan = run.plan;
  return `
    <div class="copilot-result">
      <div class="copilot-status-strip">
        <span class="copilot-badge">${run.mode === "live" ? "Live 模式" : "场景回放"}</span>
        <span class="copilot-badge">模型：${escapeHtml(run.model_name)}</span>
        ${run.fallback_reason ? `<span class="copilot-badge copilot-badge-warn">模型不可用，已回退模板（${escapeHtml(run.fallback_reason)}）</span>` : ""}
        <span class="copilot-badge">运行 #${run.run_id} · 模拟</span>
        <button type="button" class="secondary-action copilot-audit-action" data-copilot-action="export-audit"><i data-lucide="download"></i>导出可审计事件包</button>
      </div>
      <div class="copilot-grid">
        <section class="copilot-panel">
          <h2>任务理解与计划</h2>
          <p class="copilot-intent">${escapeHtml(plan.intent)}</p>
          <ol class="copilot-plan">${plan.plan.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
          ${plan.missing_fields.length ? `<div class="copilot-missing"><h3>缺失信息</h3>${plan.missing_fields.map((field) => `<span>${escapeHtml(field)}</span>`).join("")}</div>` : ""}
          ${plan.risks.length ? `<div class="copilot-risks"><h3>风险提示</h3>${plan.risks.map((risk) => `<span>${escapeHtml(risk)}</span>`).join("")}</div>` : ""}
        </section>
        <section class="copilot-panel">
          <h2>工具调用轨迹</h2>
          <ol class="copilot-trace">${run.trace.map(copilotTraceTemplate).join("")}</ol>
        </section>
        <section class="copilot-panel">
          <h2>证据</h2>
          ${plan.evidence.length ? `<ul class="copilot-evidence">${plan.evidence.map((ref) => `<li><i data-lucide="link"></i><code>${escapeHtml(ref.ref)}</code><small>${escapeHtml(ref.kind)}</small></li>`).join("")}</ul>` : `<p class="copilot-empty">本次运行没有可引用的证据。</p>`}
          ${run.rejected_evidence.length ? `<p class="copilot-rejected">已拦截虚构证据：${run.rejected_evidence.map(escapeHtml).join("、")}</p>` : ""}
        </section>
      </div>
      ${copilotPhaseTemplate()}
    </div>
  `;
}

function copilotTraceTemplate(entry) {
  return `
    <li class="${entry.ok ? "" : "failed"}">
      <i data-lucide="${entry.ok ? "check-circle-2" : "x-circle"}"></i>
      <div>
        <strong>${escapeHtml(entry.name)}</strong>
        ${entry.error ? `<small>${escapeHtml(entry.error)}</small>` : ""}
        ${entry.evidence_refs.length ? `<small>证据：${entry.evidence_refs.map(escapeHtml).join("、")}</small>` : ""}
      </div>
    </li>
  `;
}

function copilotBriefsTemplate(briefs) {
  if (!briefs.length) return "";
  const labels = { commander: "指挥台简报", station: "救援站首战信息", enterprise: "企业整改待办" };
  return `
    <section class="copilot-panel">
      <h2>一次事件 · 三端交付</h2>
      <div class="copilot-briefs">
        ${briefs.map((entry) => {
          const brief = entry.data.incident?.response_brief || {};
          return `
            <article class="copilot-brief">
              <h3>${labels[entry.data.role] || escapeHtml(entry.data.role)}</h3>
              <p>${escapeHtml(brief.address || "地址未知")}</p>
              <ul>${(brief.items || []).map((item) => `<li>${escapeHtml(item.text)}</li>`).join("")}</ul>
              <small>${escapeHtml(entry.data.disclaimer || brief.disclaimer || "")}</small>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function copilotPhaseTemplate() {
  const run = copilotState.run;
  if (copilotState.phase === "abstained") {
    return `
      <section class="copilot-panel copilot-abstain">
        <h2><i data-lucide="pause-circle"></i>安全拒答</h2>
        <p>证据不足，Agent 不生成处置建议、不推荐调派。缺失字段全部标注为未知，需人工补充信息后重新上报。</p>
      </section>
    `;
  }
  const verificationDraft = run.trace.find((entry) => entry.name === "create_verification_draft" && entry.ok);
  if (copilotState.phase === "verification" && verificationDraft) {
    return `
      <section class="copilot-panel copilot-approval">
        <h2><i data-lucide="stamp"></i>人工确认 · 信号核实</h2>
        <p>${escapeHtml(verificationDraft.data.note || "")}</p>
        <small>草稿状态：${escapeHtml(verificationDraft.data.status || "")}。Agent 只生成草稿，核实结果由值班人员登记。</small>
        <div class="copilot-actions">
          <button type="button" class="primary-action" data-copilot-verify="confirmed" ${copilotState.busy ? "disabled" : ""}><i data-lucide="check"></i>确认属实，建立警情</button>
          <button type="button" class="secondary-action" data-copilot-verify="dismissed" ${copilotState.busy ? "disabled" : ""}><i data-lucide="x"></i>确认误报，不建警情</button>
        </div>
      </section>
    `;
  }
  if (copilotState.phase === "dispatch") {
    const draft = run.trace.find((entry) => entry.name === "create_dispatch_draft" && entry.ok);
    const recommend = run.trace.find((entry) => entry.name === "recommend_station" && entry.ok);
    const briefs = run.trace.filter((entry) => entry.name === "build_role_brief" && entry.ok);
    return `
      <section class="copilot-panel copilot-approval">
        <h2><i data-lucide="stamp"></i>人工确认 · 调派下达</h2>
        <p>建议首战站点：<strong>${escapeHtml(draft?.data.station_id || "未知")}</strong>${recommend ? `（辖区可用：${recommend.data.recommended.map((station) => escapeHtml(station.id)).join("、")}）` : ""}</p>
        <small>草稿不会自动生效。下达后写入警情时间线，救援站终端实时接收。</small>
        <div class="copilot-actions">
          <button type="button" class="primary-action" data-copilot-action="dispatch" ${copilotState.busy ? "disabled" : ""}><i data-lucide="send"></i>下达调派（人工确认）</button>
        </div>
      </section>
      ${copilotBriefsTemplate(briefs)}
    `;
  }
  if (copilotState.phase === "done") {
    return `
      <section class="copilot-panel copilot-done">
        <h2><i data-lucide="check-circle-2"></i>调派已下达：${escapeHtml(copilotState.dispatch || "")}</h2>
        <p>同一事件编号已同步到三个工作台，审批与 Agent 活动已写入时间线。</p>
        <div class="copilot-actions">
          <a class="primary-action" href="#/incidents"><i data-lucide="radio-tower"></i>指挥台跟踪</a>
          <a class="secondary-action" href="#/station"><i data-lucide="siren"></i>救援站签收</a>
          <a class="secondary-action" href="#/inspections"><i data-lucide="clipboard-check"></i>监督检查</a>
        </div>
      </section>
    `;
  }
  if (copilotState.phase === "closed") {
    return `
      <section class="copilot-panel copilot-done">
        <h2><i data-lucide="check-circle-2"></i>已登记为误报</h2>
        <p>信号未转为消防救援警情，核实结果与操作时间已留痕。</p>
      </section>
    `;
  }
  return "";
}

window.addEventListener("hashchange", renderRoute);
window.addEventListener("DOMContentLoaded", () => {
  runSelfCheck();
  bindHeaderActions();
  bindDialogs();
  renderRoute();
});
