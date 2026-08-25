"use strict";

const DATA_CUTOFF = "2026-07-29 12:00";
const DEMO_RULESET = (window.FireGuardEngine && window.FireGuardEngine.RULESET) || "FG-DEMO-v0";

// 「星澜新能源汽车工厂（虚拟）」内部厂区单元；companies 命名沿用旧引擎接口。
const companies = [
  { id: "ent-001", name: "电池车间（PACK/化成）", industry: "锂电 PACK 与化成工艺", score: 58, level: "high", levelLabel: "高风险", openHazards: 12, building: "电池车间厂房", area: "12,800 ㎡", primaryRisk: "消控室值班记录问题重复出现" },
  { id: "ent-005", name: "涂装车间（PT）", industry: "喷涂与调漆工艺", score: 69, level: "high", levelLabel: "高风险", openHazards: 8, building: "涂装车间厂房", area: "9,600 ㎡", primaryRisk: "整改逾期与重复隐患" },
  { id: "ent-002", name: "总装车间", industry: "整车总装", score: 76, level: "medium", levelLabel: "中风险", openHazards: 6, building: "总装车间厂房", area: "8,200 ㎡", primaryRisk: "季度维保计划逾期" },
  { id: "ent-003", name: "立体仓库", industry: "高架仓储", score: 91, level: "low", levelLabel: "低风险", openHazards: 2, building: "立体库", area: "6,400 ㎡", primaryRisk: "暂无规则触发" },
  { id: "ent-004", name: "冲压车间", industry: "冲压成型", score: null, level: "unrated", levelLabel: "数据不足", openHazards: 0, building: "冲压车间厂房", area: "11,300 ㎡", primaryRisk: "ARK 网关断报，多数据域缺失" },
];

// 各单元对应火警主机首个烟感点位的合成 Modbus 事件帧（海湾规约，含 CRC16），
// 供「模拟报警帧」按钮走真实网关解析链路。
const demoAlarmFrames = {
  "ent-001": "01030801010300201001007d4f",
  "ent-005": "01030801010300101001007d40",
  "ent-002": "0103080101030030100100bd4b",
  "ent-003": "0103080101090040100100d751",
  "ent-004": "0103080101030050100100bd55",
};
// 机2主机备电故障（海湾事件池，data_source=自身设备）
const demoFaultFrame = "0103080205000020000000ce4a";

const issues = [
  {
    id: "hazard-01",
    number: 1,
    title: "消控室值班记录问题",
    location: "消防控制室（电池车间）",
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
    location: "PACK 产线 · 通道东侧",
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
    location: "化成区 · 西侧通道",
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
  { number: 2, title: "PACK 产线", status: "隐患整改中", time: "09:35", tone: "warning", issueId: "hazard-02" },
  { number: 3, title: "化成区", status: "待整改", time: "10:10", tone: "warning", issueId: "hazard-03" },
  { number: 4, title: "电池测试间", status: "已闭环", time: "10:45", tone: "success" },
  { number: 5, title: "配电间", status: "已闭环", time: "11:20", tone: "success" },
  { number: 6, title: "装卸平台", status: "已闭环", time: "11:55", tone: "success" },
];

const equipment = [
  { icon: "radio-tower", name: "火灾报警控制器（机2）", location: "消防控制室", state: "正常", updated: "2 分钟前" },
  { icon: "siren", name: "声光警报器", location: "PACK 产线", state: "故障 1", updated: "11 分钟前" },
  { icon: "door-open", name: "安全出口", location: "全车间 8 处", state: "正常", updated: "8 分钟前" },
  { icon: "droplets", name: "消防水系统", location: "消防泵房", state: "正常", updated: "5 分钟前" },
  { icon: "wifi-off", name: "ARK 工业网关", location: "冲压车间消控室", state: "离线 1", updated: "30 小时前" },
];

const workspaces = [
  { route: "monitoring", role: "消控室 / EHS", icon: "scan-line", title: "工厂消防态势监测", description: "汇聚火警主机 Modbus 事件、点位状态、维保与隐患闭环。", status: "3D Demo" },
  { route: "incidents", role: "消控室值班员", icon: "radio-tower", title: "报警核实与工单派发台", description: "处理合成报警的核实、诊断、工单派发与跟踪反馈。", status: "可演示" },
  { route: "station", role: "处置班组 / 维保组", icon: "siren", title: "班组工单终端", description: "接收处置与维修工单，反馈签收、到场和处理结果。", status: "可演示" },
  { route: "owner", role: "车间责任人", icon: "user-round-check", title: "整改待办", description: "接收防火巡查发现的隐患，完成整改后交回巡查员复查。", status: "可演示" },
  { route: "inspections", role: "防火巡查员", icon: "clipboard-check", title: "防火巡查与隐患闭环", description: "拍照识别隐患、语音辅助录入，人工确认后派发网格责任人整改。", status: "可演示" },
  { route: "enterprises/ent-001", role: "EHS 经理", icon: "factory", title: "车间消防档案", description: "查看本车间风险画像、设备台账与未闭环隐患，并跳转到核实/巡查/班组继续处理。", status: "可演示" },
];
const OWNER_OPTIONS = ["张伟", "李强", "王磊", "赵敏", "陈刚", "周倩", "孙磊"];

const monitoringProfiles = {
  "ent-001": { district: "西区", online: "89%", signal: "设备火警信号 3 条", fault: "报警系统故障 18 次", maintenance: "维保逾期 2 项", freshness: "2 分钟前" },
  "ent-005": { district: "西区", online: "93%", signal: "设备火警信号 1 条", fault: "报警系统故障 9 次", maintenance: "维保逾期 1 项", freshness: "4 分钟前" },
  "ent-002": { district: "东区", online: "97%", signal: "无未核实火警信号", fault: "设备故障 4 次", maintenance: "季度维保逾期", freshness: "3 分钟前" },
  "ent-003": { district: "东区", online: "99%", signal: "无未核实火警信号", fault: "设备故障 1 次", maintenance: "维保计划正常", freshness: "1 分钟前" },
  "ent-004": { district: "西区", online: "62%", signal: "数据不足", fault: "网关断报，3 个数据域缺失", maintenance: "维保数据未接入", freshness: "30 小时前" },
};
const OFFLINE_SITE_PROFILES = {
  "ent-001": {
    address: "星澜新能源汽车工厂（虚拟）西区 电池车间厂房",
    hazards: ["锂电池模组半成品缓存区（合成）", "电芯化成区（合成）"],
    access_points: ["车间南门（合成）", "车间东门（合成）"],
    water_sources: ["厂区环网消火栓（合成）", "厂区消防水池（合成）"],
    facilities: ["自动喷水灭火系统（合成）", "电池测试间气体灭火系统（合成）", "锂电专用灭火器材（合成）"],
  },
  "ent-005": {
    address: "星澜新能源汽车工厂（虚拟）西区 涂装车间厂房",
    hazards: ["调漆间可燃液体（合成）", "喷涂作业区（合成）"],
    access_points: ["车间东出口（合成）"],
    water_sources: ["厂区环网消火栓（合成）"],
    facilities: ["自动喷水灭火系统（合成）", "调漆间气体灭火系统（合成）"],
  },
};
const monitoringFloorPositions = {
  "ent-001": { left: 50, top: 73, label: "电池测试工位" },
  "ent-005": { left: 25, top: 31, label: "喷漆线 3#" },
  "ent-002": { left: 51, top: 31, label: "测试区 B2" },
  "ent-003": { left: 30, top: 70, label: "堆垛机通道" },
  "ent-004": { left: 75, top: 70, label: "冲压线控制柜" },
};

let selectedCompanyId = "ent-001";
let selectedIssueId = "hazard-01";
let activeRightTab = "hazards";
let hazardFilter = "all";
let planZoom = 1;
let monitoringState = {
  events: window.FireGuardEngine.monitoringEvents(),
  selectedId: "evt-fire-001",
  filter: "all",
  tab: "location",
  floor: "2F",
  spatialLevel: "factory",
};
window.FireOpsReview = {
  setMonitoringEvents(events) {
    monitoringState.events = events;
    monitoringState.selectedId = events[0]?.id || null;
    if (monitoringState.spatialLevel === "workshop" && events[0]?.enterpriseId !== "ent-001") monitoringState.spatialLevel = "factory";
    renderRoute();
  },
};
let toastTimer;
let workflowStarted = false;
const MONITORING_API_BASE = window.FIREGUARD_API_BASE || "http://127.0.0.1:8000";
const OFFLINE_JUDGE_SCENARIO = {
  scenario_id: "B-confirmed-fire-battery-workorder",
  title: "确认火警：电池车间 PACK 缓存区两点报警",
  enterprise_id: "ent-001",
  input: {
    signal: { event_type: "fire_alarm", severity: "critical", payload: { device_ref: "pt-02-01-005", location: "电池车间 PACK 半成品缓存区" } },
    reporter_text: "PACK 半成品缓存区冒烟并见明火，南门手报已按下，现场人员正在疏散。",
    images: [{ asset: "assets/fire-floorplan.png", note: "电池车间平面图（合成）" }],
  },
  safe_failure: "Agent 只整理证据和起草处置建议；核实、派单与归档均由人确认。",
};
let demoActorId = localStorage.getItem("fireops-demo-actor") || "duty-demo";
const actorHeaders = () => ({ "Content-Type": "application/json", "X-FireOps-Actor": demoActorId });
const DEMO_INSPECT_ASSETS = [
  "assets/evidence-extinguisher-blocked.png",
  "assets/evidence-exit-sign-fault.png",
  "assets/evidence-control-room-log.png",
];
let inspectCapture = {
  imageAsset: DEMO_INSPECT_ASSETS[0],
  voiceText: "",
  draft: null,
  findingId: null,
  busy: false,
  recognition: null,
};
let dynamicIssues = [];
let maintenanceDrafts = [];
let copilotState = {
  scenarios: null, selectedId: null, mode: "scenario",
  phase: "select", eventId: null, run: null, verification: null, dispatch: null, busy: false,
  verificationActor: null, dispatchActor: null,
  judgeMode: false, judgeProgress: [], offline: false,
  bindSource: "scenario", // scenario | hub
  hubEventId: null,
  hubEnterpriseId: null,
};
let monitoringBackend = { status: "connecting", summary: null, enterpriseIds: companies.map((company) => company.id) };
let monitoringEventSource = null;
let monitoringInitialized = false;
let monitoringRefreshTimer = null;
let incidentBackend = {
  status: "connecting", signals: [], incidents: [], stations: [], station: null, tasks: [],
  inbox: [], repairDrafts: [],
};
let incidentEventSource = null;
let incidentRefreshTimer = null;
let incidentInitialized = false;
let selectedSignalEventId = null;
let selectedIncidentId = null;
let selectedStationTaskId = null;
let selectedInboxId = null;
let terminalStationId = "crew-wx-01";
let terminalOwnerName = "张伟";
let enterpriseDossierState = { id: null, data: null, loading: false, error: "" };
let threeDFallbackTimer = null;
const CREW_OPTIONS = [
  { id: "crew-wx-01", label: "微型消防站·西区（处置）" },
  { id: "crew-wb-01", label: "消防设施维保组（维修/维保）" },
  { id: "crew-wx-02", label: "微型消防站·东区（处置）" },
];
let latestAssessment = {
  ruleVersion: DEMO_RULESET,
  enterpriseId: "ent-001",
  enterpriseName: "电池车间（PACK/化成）",
  dataCutoff: "2026-07-29T12:00:00+08:00",
  inputHash: "fg-demo-preview",
  totalScore: 58,
  riskLevel: "high",
  triggeredRules: [
    { code: "FG-ALARM-01", title: "报警系统故障频率增加", deduction: 14, metric: "18 / 5", evidence: ["demo/alarm/001"] },
    { code: "FG-IOT-01", title: "设备长时间离线", deduction: 10, metric: "30 小时", evidence: ["demo/iot/ark-gw-01"] },
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
  const catalog = allIssues();
  return catalog.find((issue) => issue.id === selectedIssueId) || catalog[0];
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

function setDemoActor(actorId) {
  demoActorId = actorId;
  localStorage.setItem("fireops-demo-actor", actorId);
  const actorSelect = document.querySelector("#demo-actor");
  if (actorSelect) actorSelect.value = actorId;
}

function routeHash(root, context = {}) {
  const params = new URLSearchParams(Object.entries(context).filter(([, value]) => value !== null && value !== undefined && value !== ""));
  return `#/${root}${params.size ? `?${params}` : ""}`;
}

function applyRouteContext(params) {
  const enterpriseId = params.get("enterprise_id");
  if (enterpriseId && companies.some((company) => company.id === enterpriseId)) selectedCompanyId = enterpriseId;
  const eventId = Number(params.get("event_id"));
  if (eventId) selectedSignalEventId = eventId;
  const workorderId = Number(params.get("workorder_id"));
  if (workorderId) selectedInboxId = `workorder-${workorderId}`;
  const findingId = Number(params.get("finding_id"));
  if (findingId) selectedIssueId = `finding-${findingId}`;
  const incidentId = Number(params.get("incident_id"));
  if (incidentId) selectedIncidentId = incidentId;
  const crewId = params.get("crew_id");
  if (crewId && CREW_OPTIONS.some((crew) => crew.id === crewId)) terminalStationId = crewId;
}

function enterpriseContext(extra = {}) {
  const context = { enterprise_id: selectedCompanyId, ...extra };
  const dossier = enterpriseDossierState.id === selectedCompanyId ? enterpriseDossierState.data : null;
  return {
    ...context,
    event_id: context.event_id ?? dossier?.next_context?.event_id,
    workorder_id: context.workorder_id ?? dossier?.next_context?.workorder_id,
    finding_id: context.finding_id ?? dossier?.next_context?.finding_id,
  };
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
      headers: actorHeaders(),
      body: JSON.stringify({
        enterprise_id: selectedCompanyId,
        event_type: eventType,
        severity: eventType === "verification_requested" ? "info" : "high",
        source: "fireops_demo_console",
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

// 「模拟 Modbus 报警帧」走真实网关链路：帧解析 -> 点位表定位 -> 落库。
async function postDemoModbusFrame(frameHex, { jumpToVerify = true } = {}) {
  const hex = frameHex || demoAlarmFrames[selectedCompanyId];
  if (!hex) return showToast("该单元没有预置报警帧");
  if (monitoringBackend.status !== "live") {
    const type = hex === demoFaultFrame ? "fault" : "fire";
    monitoringState.events = window.FireGuardEngine.createMonitoringEvent(monitoringState.events, type, selectedCompanyId);
    monitoringState.selectedId = monitoringState.events[0].id;
    monitoringState.filter = "pending";
    monitoringState.floor = monitoringState.events[0].floor;
    monitoringState.tab = "location";
    showToast(`已加入本地${type === "fault" ? "故障" : "火警"}事件，等待人工核实`);
    renderRoute();
    return;
  }
  try {
    const response = await fetch(`${MONITORING_API_BASE}/gateway/modbus/frames`, {
      method: "POST",
      headers: actorHeaders(),
      body: JSON.stringify({ frame_hex: hex, gateway_id: "ark-gw-demo" }),
    });
    if (!response.ok) throw new Error("gateway_ingest_failed");
    const payload = await response.json();
    const decoded = payload.decoded || {};
    const event = payload.event || {};
    const eventType = decoded.event_type || event.event_type;
    showToast(`已解析报警帧：机${decoded.controller_no}回路${decoded.loop_no}点位${decoded.point_no} ${decoded.location || ""}`);
    scheduleMonitoringRefresh();
    if (eventType === "fire_alarm" && event.id && jumpToVerify) {
      selectedSignalEventId = event.id;
      showToast("火警已入待核实队列，正在打开核实台…");
      location.hash = routeHash("incidents", { enterprise_id: selectedCompanyId, event_id: event.id });
      scheduleIncidentRefresh();
    } else if (eventType === "fault" && event.id) {
      showToast("故障已生成维修工单草稿，可到班组终端（维保组）或 Copilot 确认派发");
      terminalStationId = "crew-wb-01";
      selectedInboxId = null;
      location.hash = routeHash("station", { enterprise_id: selectedCompanyId, event_id: event.id });
      scheduleIncidentRefresh();
    }
  } catch {
    showToast("实时链路暂不可用，已保留当前页面状态");
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

    const dutyInbox = await fetch(`${MONITORING_API_BASE}/workbench/inbox?role=duty`);
    if (dutyInbox.ok) {
      const duty = await dutyInbox.json();
      incidentBackend.repairDrafts = (duty.items || []).filter((item) => item.kind === "repair" && item.status === "draft");
    }

    if ((location.hash || "").startsWith("#/station")) {
      const inboxResponse = await fetch(
        `${MONITORING_API_BASE}/workbench/inbox?role=crew&crew_id=${encodeURIComponent(terminalStationId)}`,
      );
      if (!inboxResponse.ok) throw new Error("inbox_api_unavailable");
      const inbox = await inboxResponse.json();
      incidentBackend.inbox = inbox.items || [];
      incidentBackend.station = (inbox.stations || []).find((item) => item.id === terminalStationId)
        || { id: terminalStationId, name: CREW_OPTIONS.find((item) => item.id === terminalStationId)?.label || terminalStationId, status: "available" };
      // 兼容旧处置任务详情：仍拉取 station tasks 供签收状态机使用
      const stationResponse = await fetch(`${MONITORING_API_BASE}/stations/${terminalStationId}/tasks`);
      if (stationResponse.ok) {
        const stationPayload = await stationResponse.json();
        incidentBackend.tasks = stationPayload.tasks || [];
        if (stationPayload.station) incidentBackend.station = stationPayload.station;
      } else {
        incidentBackend.tasks = [];
      }
    }

    if ((location.hash || "").startsWith("#/owner")) {
      const inboxResponse = await fetch(
        `${MONITORING_API_BASE}/workbench/inbox?role=owner&owner=${encodeURIComponent(terminalOwnerName)}`,
      );
      if (!inboxResponse.ok) throw new Error("owner_inbox_unavailable");
      const inbox = await inboxResponse.json();
      incidentBackend.inbox = inbox.items || [];
      incidentBackend.station = { id: "owner", name: `网格责任人 · ${terminalOwnerName}`, status: "available" };
      incidentBackend.tasks = [];
    }

    selectedSignalEventId ||= incidentBackend.signals.find((item) => item.verification_status === "pending")?.monitoring_event_id || null;
    selectedIncidentId ||= incidentBackend.incidents[0]?.id || null;
    selectedStationTaskId ||= incidentBackend.tasks[0]?.id || null;
    selectedInboxId ||= incidentBackend.inbox[0]?.inbox_id || null;
    if (["#/incidents", "#/station", "#/owner", "#/copilot", "#/workflow"].some((route) => (location.hash || "").startsWith(route))) renderRoute();
  } catch {
    incidentBackend.status = "offline";
    if (["#/incidents", "#/station", "#/owner", "#/copilot", "#/workflow"].some((route) => (location.hash || "").startsWith(route))) renderRoute();
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
      method: "POST", headers: actorHeaders(), body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "incident_action_failed");
    if (payload.incident?.id) selectedIncidentId = payload.incident.id;
    showToast(successMessage);
    await refreshIncidentBackend();
    return payload;
  } catch (error) {
    showToast(`操作未完成：${incidentErrorMessage(error.message)}`);
    return null;
  }
}

function incidentErrorMessage(code) {
  return {
    station_busy: "处置班组正在执行其他任务，请到流程监管继续当前工单",
    role_not_allowed: "当前身份无权执行此步骤，请按流程监管提示切换角色",
    close_before_report: "班组尚未提交现场反馈，暂不能归档",
    crew_unavailable: "当前没有可用的对应班组",
  }[code] || code;
}

function timelineTemplate(incident) {
  if (!incident?.timeline?.length) return `<div class="incident-empty">暂无事件时间线</div>`;
  return `<ol class="incident-timeline">${incident.timeline.map((item) => `<li><time>${incidentTime(item.occurred_at)}</time><strong>${escapeHtml(item.event_type)}</strong><span>${escapeHtml(item.actor)}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</span></li>`).join("")}</ol>`;
}

function incidentCommandTemplate() {
  const pendingSignals = incidentBackend.signals.filter((item) => item.verification_status === "pending");
  const signal = pendingSignals.find((item) => item.monitoring_event_id === selectedSignalEventId) || pendingSignals[0];
  const incident = incidentBackend.incidents.find((item) => item.id === selectedIncidentId) || incidentBackend.incidents[0];
  // 火警处置只派微型消防站；维保组（crew-wb-*）走维修/维保工单，不进处置派单下拉。
  const stations = incident
    ? incidentBackend.stations.filter((item) => item.district === incident.district && String(item.id).startsWith("crew-wx"))
    : [];
  const availableStation = stations.find((item) => item.status === "available");
  const occupiedStation = stations.find((item) => item.status !== "available");
  const occupyingIncident = occupiedStation
    ? incidentBackend.incidents.find((item) => item.dispatch?.station_id === occupiedStation.id && item.status !== "closed")
    : null;
  const workflowState = incident ? incidentWorkflowState(incident) : null;
  const isJudgeIncident = copilotState.judgeMode && incident?.id === copilotState.run?.incident_id;
  const repairDrafts = incidentBackend.repairDrafts || [];
  return `
    <section class="incident-console" aria-labelledby="incident-console-title">
      <header class="incident-console-header"><div><span>DUTY DESK / SYNTHETIC EVENT</span><h1 id="incident-console-title">报警核实与工单派发台</h1><p>模拟角色 · 合成事件 · 不控制真实设备</p></div><div class="incident-live ${incidentBackend.status}"><b></b>${incidentBackend.status === "live" ? "数据库与 SSE 在线" : "正在连接本地后端"}</div></header>
      <div class="incident-grid">
        <aside class="incident-queue" aria-label="报警信号与处置事件队列">
          <h2>待核实报警信号 <b>${pendingSignals.length}</b></h2>
          <div class="incident-list">${pendingSignals.length ? pendingSignals.map((item) => `<button type="button" data-signal-select="${item.monitoring_event_id}" class="${item.monitoring_event_id === signal?.monitoring_event_id ? "active" : ""}"><strong>${escapeHtml(item.enterprise_name)}</strong><span>#${item.monitoring_event_id} · ${incidentTime(item.occurred_at)}</span></button>`).join("") : `<div class="incident-empty">暂无待核实信号</div>`}</div>
          ${signal ? `<div class="signal-actions"><button type="button" data-action="dismiss-device-signal">登记误报</button><button type="button" class="danger" data-action="confirm-device-signal">确认火警</button><button type="button" data-action="bind-signal-copilot">用 Copilot 研判</button></div>` : ""}
          <h2>故障维修草稿 <b>${repairDrafts.length}</b></h2>
          <div class="incident-list">${repairDrafts.length ? repairDrafts.map((item) => `<button type="button" data-repair-select="${item.workorder_id}" data-repair-event="${item.event_id || ""}"><strong>${escapeHtml(item.enterprise_name)}</strong><span>${escapeHtml((item.summary || "").slice(0, 36))}…</span></button>`).join("") : `<div class="incident-empty">监测注入故障后会出现在此</div>`}</div>
          <h2>处置事件 <b>${incidentBackend.incidents.length}</b></h2>
          <div class="incident-list">${incidentBackend.incidents.length ? incidentBackend.incidents.map((item) => `<button type="button" data-incident-select="${item.id}" class="${item.id === incident?.id ? "active" : ""}"><strong>事件 #${item.id} · ${escapeHtml(item.enterprise_name)}</strong><span>${window.FireGuardEngine.incidentStatusLabel(item.status)}</span></button>`).join("") : `<div class="incident-empty">人工确认火警后才会生成处置事件</div>`}</div>
        </aside>
        <main class="incident-main">
          ${incident ? `<div class="incident-title-row"><div><span>EVENT #${incident.id}</span><h2>${escapeHtml(incident.enterprise_name)}</h2><p>${escapeHtml(incident.district)} · ${escapeHtml(incident.response_brief.address)}</p></div><strong>${window.FireGuardEngine.incidentStatusLabel(incident.status)}</strong></div>
          <section class="response-brief"><header><i data-lucide="shield-alert"></i><div><span>AI 处置提示 · 规则草案</span><h3>车间处置信息卡</h3></div></header>${incident.response_brief.items.map((item) => `<div><strong>${escapeHtml(item.text)}</strong><small>来源：${escapeHtml(item.sources.join("、"))}</small></div>`).join("")}<p>${escapeHtml(incident.response_brief.disclaimer)}</p></section>` : `<div class="incident-empty large">选择待核实信号，人工确认后建立处置事件</div>`}
        </main>
        <aside class="incident-dispatch" aria-label="班组派单与时间线">
          <h2>片区处置力量</h2>
          ${incident && !incident.dispatch ? availableStation
            ? `<select id="dispatch-station">${stations.map((item) => `<option value="${item.id}" ${item.status !== "available" ? "disabled" : ""}>${escapeHtml(item.name)} · ${window.FireGuardEngine.stationStatusLabel(item.status)}</option>`).join("")}</select><button type="button" class="dispatch-button" data-action="dispatch-incident">派发工单</button>`
            : `<div class="dispatch-card"><strong>当前片区班组正在执行${occupyingIncident ? `事件 #${occupyingIncident.id}` : "其他任务"}</strong><span>${escapeHtml(occupiedStation?.name || "处置班组")}释放后，本事件才能派发。</span></div>${workflowState?.crewId ? `<button type="button" class="dispatch-button" data-workflow-continue data-actor="${workflowState.actor}" data-crew-id="${workflowState.crewId}" data-route="${workflowState.route}">进入占用班组的当前任务</button>` : `<a class="workflow-inline-link" href="#/workflow">查看占用流程</a>`}`
            : incident?.dispatch ? `<div class="dispatch-card"><strong>${escapeHtml(incident.dispatch.station_name)}</strong><span>${window.FireGuardEngine.incidentStatusLabel(incident.status)}</span></div>${incident.report && incident.status !== "closed" ? `${isJudgeIncident ? `<div class="judge-gate"><b>人工闸门 3/3</b><span>值班员核验现场反馈后归档，AI 不代替最终决定。</span></div>` : ""}<button type="button" class="dispatch-button" data-action="close-incident">核验反馈并归档</button>` : isJudgeIncident && incident.status === "closed" ? `<div class="judge-complete"><strong>评委演示闭环完成</strong><span>报警、证据、人工审批、班组反馈与归档均已写入审计时间线。</span></div>` : ""}` : `<div class="incident-empty">等待处置事件</div>`}
          <h2>事件时间线</h2>${timelineTemplate(incident)}
        </aside>
      </div>
    </section>`;
}

function stationTerminalTemplate() {
  const inbox = incidentBackend.inbox || [];
  const selected = inbox.find((item) => item.inbox_id === selectedInboxId) || inbox[0];
  const task = selected?.source === "incident_dispatch"
    ? incidentBackend.tasks.find((item) => item.dispatch?.id === selected.dispatch_id)
      || incidentBackend.tasks.find((item) => item.id === selected.incident_id)
    : null;
  const nextAction = task?.dispatch ? window.FireGuardEngine.nextStationAction(task.dispatch.status) : null;
  const kindLabel = { response: "处置", repair: "维修", maintenance: "维保", rectification: "整改" };
  return `
    <section class="station-console" aria-labelledby="station-console-title">
      <header class="station-console-header">
        <div>
          <span>CREW TERMINAL / UNIFIED INBOX</span>
          <h1 id="station-console-title">${escapeHtml(incidentBackend.station?.name || "班组工单终端")}</h1>
          <p>统一收件箱：处置派单 + 维修/维保/整改工单</p>
        </div>
        <label class="crew-switch">班组
          <select id="terminal-crew-select">
            ${CREW_OPTIONS.map((crew) => `<option value="${crew.id}" ${crew.id === terminalStationId ? "selected" : ""}>${escapeHtml(crew.label)}</option>`).join("")}
          </select>
        </label>
      </header>
      <div class="station-grid">
        <aside class="station-task-list">
          <h2>本班组工单 <b>${inbox.length}</b></h2>
          ${inbox.length ? inbox.map((item) => `
            <button type="button" data-inbox-select="${item.inbox_id}" class="${item.inbox_id === selected?.inbox_id ? "active" : ""}">
              <strong>${kindLabel[item.kind] || item.kind} · ${escapeHtml(item.enterprise_name || "")}</strong>
              <span>${escapeHtml((item.summary || "").slice(0, 40))} · ${escapeHtml(item.status)}</span>
            </button>
          `).join("") : `<div class="incident-empty">暂无派发工单</div>`}
        </aside>
        <main class="station-task-detail">
          ${!selected ? guidedEmpty("这里不是空白页，是「收件箱」", [
            "先到「态势监测」点「模拟火警帧」或「模拟主机故障」",
            "火警：在报警核实台确认后派发 → 选「微型消防站」班组可见",
            "故障：自动生成维修草稿 → 切换到「消防设施维保组」可见",
            "也可在 Copilot 跑场景 B/C，派发后会跳转到本页",
          ]) : ""}
          ${selected?.source === "incident_dispatch" && task ? `
            <div class="incident-title-row"><div><span>任务 #${task.dispatch.id}</span><h2>${escapeHtml(task.enterprise_name)}</h2><p>${escapeHtml(task.response_brief.address)}</p></div><strong>${task.report && task.status !== "closed" ? "待核验归档" : window.FireGuardEngine.incidentStatusLabel(task.status)}</strong></div>
            <section class="station-brief">${task.response_brief.items.map((item) => `<div><strong>${escapeHtml(item.text)}</strong><small>${escapeHtml(item.sources.join("、"))}</small></div>`).join("")}<p>${escapeHtml(task.response_brief.disclaimer)}</p></section>
            ${nextAction ? `<button type="button" class="station-action" data-action="station-next-action" data-next-action="${nextAction.action}">${nextAction.label}</button>` : ""}
            ${task.dispatch.status === "arrived" && !task.report ? `<section class="first-report"><h3>现场处理反馈</h3><textarea id="report-situation" maxlength="300" placeholder="填写现场情况与处理结果（1–300 字）"></textarea><select id="report-people"><option value="unknown">人员情况未知</option><option value="no_risk">无被困风险</option><option value="at_risk">存在风险</option></select><button type="button" data-action="submit-first-report">提交反馈</button></section>` : task.report && task.status !== "closed" ? `<div class="report-received"><strong>现场反馈已提交</strong><span>${escapeHtml(task.report.situation)} · 下一步由消控室值班员核验归档</span></div><button type="button" class="station-action" data-workflow-continue data-actor="duty-demo" data-incident-id="${task.id}" data-route="#/incidents?incident_id=${task.id}">交回消控室核验归档</button>` : task.report ? `<div class="report-received"><strong>事件已归档</strong><span>${escapeHtml(task.report.situation)}</span></div>` : ""}
          ` : ""}
          ${selected?.source === "ops_workorder" ? `
            <div class="incident-title-row"><div><span>OPS #${selected.workorder_id}</span><h2>${escapeHtml(selected.enterprise_name)}</h2><p>${kindLabel[selected.kind] || selected.kind}工单</p></div><strong>${escapeHtml(selected.status)}</strong></div>
            <section class="station-brief"><div><strong>${escapeHtml(selected.summary)}</strong><small>责任：${escapeHtml(selected.owner || selected.crew_id || "—")}</small></div>
            <p>来自统一工单中枢；草稿需人工确认后派发生效，完工需人工核验。</p></section>
            ${selected.status === "draft" ? `<button type="button" class="station-action" data-action="approve-inbox-workorder" data-workorder-id="${selected.workorder_id}">确认派发（人工）</button>` : ""}
            ${selected.status === "approved" ? `<button type="button" class="station-action" data-action="start-inbox-workorder" data-workorder-id="${selected.workorder_id}">开始处理</button>` : ""}
            ${selected.status === "in_progress" ? `<button type="button" class="station-action" data-action="complete-inbox-workorder" data-workorder-id="${selected.workorder_id}">完成核验（人工）</button>` : ""}
            ${!["draft", "approved", "in_progress"].includes(selected.status) ? `<div class="report-received"><strong>工单状态：${escapeHtml(selected.status)}</strong><span>本班组闭环完成</span></div>` : ""}
            ${selected.event_id ? `<button type="button" class="secondary-action" data-action="diagnose-event-copilot" data-event-id="${selected.event_id}" data-enterprise-id="${selected.enterprise_id}">用 Copilot 诊断此故障</button>` : ""}
          ` : ""}
          ${selected?.source === "incident_dispatch" && !task ? `<div class="incident-empty large">处置任务详情加载中或班组不匹配——请确认左上角班组是否为处置站</div>` : ""}
        </main>
        <aside class="station-timeline"><h2>工单时间线</h2>${task ? timelineTemplate(task) : guidedEmpty(selected ? "维修/维保工单无处置时间线" : "时间线随任务出现", [
          selected ? "运维工单用左侧状态按钮推进：确认派发 → 开始处理 → 完成核验" : "有处置派单后，这里显示签收/到场/反馈时间线",
          "切换班组下拉框可分别查看处置站与维保组收件箱",
        ])}</aside>
      </div>
    </section>`;
}

function ownerInboxTemplate() {
  const inbox = incidentBackend.inbox || [];
  const selected = inbox.find((item) => item.inbox_id === selectedInboxId) || inbox[0];
  return `
    <section class="station-console" aria-labelledby="owner-console-title">
      <header class="station-console-header">
        <div>
          <span>AREA OWNER / RECTIFICATION INBOX</span>
          <h1 id="owner-console-title">整改待办</h1>
          <p>接收防火巡查发现的隐患，派给车间责任人整改；完成后由巡查员复查闭环。</p>
        </div>
        <label class="crew-switch">责任人
          <select id="terminal-owner-select">
            ${OWNER_OPTIONS.map((name) => `<option value="${name}" ${name === terminalOwnerName ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
          </select>
        </label>
      </header>
      <div class="station-grid">
        <aside class="station-task-list">
          <h2>我的整改待办 <b>${inbox.length}</b></h2>
          ${inbox.length ? inbox.map((item) => `
            <button type="button" data-inbox-select="${item.inbox_id}" class="${item.inbox_id === selected?.inbox_id ? "active" : ""}">
              <strong>${escapeHtml(item.enterprise_name || "")}</strong>
              <span>${escapeHtml((item.summary || "").slice(0, 40))} · ${escapeHtml(item.status)}</span>
            </button>
          `).join("") : `<div class="incident-empty">暂无整改任务</div>`}
        </aside>
        <main class="station-task-detail">
          ${!selected ? `<div class="guided-empty owner-empty"><strong>整改待办是将巡查隐患派给车间责任人的整改任务</strong><p>当前没有待整改事项。可先到防火巡查创建隐患记录，返回后会在这里跟踪整改与复查。</p><button type="button" class="primary-action" data-action="go-inspections">去防火巡查新建任务</button></div>` : `
            <div class="incident-title-row"><div><span>整改 #${selected.workorder_id}</span><h2>${escapeHtml(selected.enterprise_name)}</h2><p>网格责任人 ${escapeHtml(selected.owner || terminalOwnerName)}</p></div><strong>${escapeHtml(selected.status)}</strong></div>
            <section class="station-brief"><div><strong>${escapeHtml(selected.summary)}</strong><small>关联隐患 #${selected.finding_id || "—"}</small></div>
            <p>整改完成后标记完成；复查通过后隐患才正式关闭。</p></section>
            ${selected.status === "approved" ? `<button type="button" class="station-action" data-action="start-inbox-workorder" data-workorder-id="${selected.workorder_id}">开始整改</button>` : ""}
            ${selected.status === "in_progress" ? `<button type="button" class="station-action" data-action="complete-inbox-workorder" data-workorder-id="${selected.workorder_id}">标记整改完成（待复查）</button>` : ""}
            ${selected.finding_id ? `<a class="secondary-action" href="#/inspections">去防火巡查发起复查</a>` : ""}
          `}
        </main>
        <aside class="station-timeline"><h2>闭环说明</h2>${guidedEmpty("整改链", [
          "防火巡查派发 → 本页开始/完成整改 → 巡查复查通过 → 隐患关闭",
          "火警处置单不在这里，请到「班组工单」查看",
        ])}</aside>
      </div>
    </section>`;
}

function homeTemplate() {
  return `
    <section class="workspace-home" aria-labelledby="workspace-home-title">
      <header class="workspace-home-header">
        <span>FIREOPS / FACTORY WORKSPACES</span>
        <h1 id="workspace-home-title">选择工作台</h1>
        <p>岗位分屏是为了角色清晰；数据走同一工单中枢。演示顺序：态势监测 → 核实/Copilot → 班组或网格待办 → 巡查复查。</p>
      </header>
      <ol class="hub-flow" aria-label="演示串联">
        <li><a href="#/monitoring">态势监测</a><span>看异常</span></li>
        <li><a href="#/incidents">报警核实</a><span>确认/排除</span></li>
        <li><a href="#/workflow">流程监管</a><span>看当前责任与下一步</span></li>
        <li><a href="#/station">班组工单</a><span>处置/维修</span></li>
        <li><a href="#/inspections">防火巡查</a><span>派发整改</span></li>
        <li><a href="#/owner">网格待办</a><span>整改闭环</span></li>
      </ol>
      <div class="workspace-grid">
        ${workspaces.map((workspace, index) => `
          <a class="workspace-card ${["inspections", "incidents", "station", "owner", "enterprises/ent-001", "monitoring"].includes(workspace.route) ? "workspace-card-ready" : ""}" href="#/${workspace.route}" data-workspace-link>
            <span class="workspace-index">0${index + 1}</span>
            <span class="workspace-icon"><i data-lucide="${workspace.icon}"></i></span>
            <small>${workspace.role}</small>
            <h2>${workspace.title}</h2>
            <p>${workspace.description}</p>
            <span class="workspace-status">${workspace.status}<i data-lucide="arrow-up-right"></i></span>
          </a>
        `).join("")}
      </div>
      <aside class="workspace-boundary"><i data-lucide="shield-check"></i><span><strong>安全边界</strong>Agent 只读取火警主机数据并生成草稿，不控制真实设备、不自动启动灭火装置；确认火警后拨打 119 由人工执行。</span></aside>
      <a class="copilot-entry" href="#/copilot">
        <i data-lucide="sparkles"></i>
        <span><strong>FireOps Copilot · GOAI 参赛演示</strong>Modbus 报警帧 → 点位解析 → 证据补全 → 人工核实 → 故障诊断/气体延时咨询/工单派发 → 三端交付，五个场景可离线回放。</span>
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

const INCIDENT_WORKFLOW_STEPS = ["信号接入", "人工核实", "派发处置单", "班组签收", "出动到场", "现场反馈", "人工归档"];

function incidentWorkflowState(incident) {
  const dispatchStatus = incident.dispatch?.status;
  const responders = incidentBackend.stations.filter((station) => station.district === incident.district && String(station.id).startsWith("crew-wx"));
  const available = responders.find((station) => station.status === "available");
  if (incident.status === "closed" || dispatchStatus === "completed") return { current: 7, role: "已完成", action: "查看归档记录", actor: "duty-demo", route: `#/incidents?incident_id=${incident.id}` };
  if (!incident.dispatch) {
    if (!available && responders[0]) return { current: 2, role: "处置班组", action: "先完成占用班组的当前任务", actor: "crew-demo", crewId: responders[0].id, route: `#/station?crew_id=${responders[0].id}` };
    return { current: 2, role: "消控室值班员", action: "选择处置站并派发", actor: "duty-demo", route: `#/incidents?incident_id=${incident.id}` };
  }
  if (dispatchStatus === "issued") return { current: 3, role: "处置班组", action: "签收任务", actor: "crew-demo", crewId: incident.dispatch.station_id, route: `#/station?crew_id=${incident.dispatch.station_id}` };
  if (["acknowledged", "enroute"].includes(dispatchStatus)) return { current: 4, role: "处置班组", action: dispatchStatus === "acknowledged" ? "确认出动" : "确认到场", actor: "crew-demo", crewId: incident.dispatch.station_id, route: `#/station?crew_id=${incident.dispatch.station_id}` };
  if (dispatchStatus === "arrived" && !incident.report) return { current: 5, role: "处置班组", action: "提交现场反馈", actor: "crew-demo", crewId: incident.dispatch.station_id, route: `#/station?crew_id=${incident.dispatch.station_id}` };
  return { current: 6, role: "消控室值班员 / EHS", action: "核验反馈并归档", actor: "duty-demo", route: `#/incidents?incident_id=${incident.id}` };
}

function workflowStepsTemplate(current) {
  return `<ol class="workflow-steps">${INCIDENT_WORKFLOW_STEPS.map((step, index) => {
    const state = current >= INCIDENT_WORKFLOW_STEPS.length || index < current ? "done" : index === current ? "current" : "pending";
    return `<li class="${state}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${step}</strong></li>`;
  }).join("")}</ol>`;
}

function workflowSupervisionTemplate() {
  const incidents = [...incidentBackend.incidents].sort((a, b) => (a.status === "closed") - (b.status === "closed") || b.id - a.id);
  const pendingSignals = incidentBackend.signals.filter((signal) => signal.verification_status === "pending");
  const awaitingCrew = incidents.filter((incident) => ["issued", "acknowledged", "enroute", "arrived"].includes(incident.dispatch?.status) && !incident.report).length;
  const awaitingClose = incidents.filter((incident) => incident.report && incident.status !== "closed").length;
  return `
    <section class="workflow-page" aria-labelledby="workflow-page-title">
      <header class="workflow-page-header">
        <div><span>OPERATIONS WORKFLOW / LIVE STATE</span><h1 id="workflow-page-title">事件流程监管</h1><p>事件到了哪一步、现在由谁负责、下一步做什么，都从数据库实时计算。</p></div>
        <div class="incident-live ${incidentBackend.status}"><b></b>${incidentBackend.status === "live" ? "数据库实时同步" : "正在连接本地后端"}</div>
      </header>
      <div class="workflow-value-grid">
        <article><span>AI 负责</span><strong>解析信号、补齐证据、生成核实与工单草稿</strong></article>
        <article><span>人负责</span><strong>确认火情、批准派单、现场处置与最终归档</strong></article>
        <article><span>监管负责</span><strong>追踪状态、责任角色、下一动作和审计时间线</strong></article>
      </div>
      <dl class="workflow-summary-strip"><div><dt>待核实</dt><dd>${pendingSignals.length}</dd></div><div><dt>待班组处理</dt><dd>${awaitingCrew}</dd></div><div><dt>待归档</dt><dd>${awaitingClose}</dd></div><div><dt>全部事件</dt><dd>${incidents.length}</dd></div></dl>
      <div class="workflow-case-list">
        ${pendingSignals.map((signal) => `<article class="workflow-case"><header><div><span>SIGNAL #${signal.monitoring_event_id}</span><h2>${escapeHtml(signal.enterprise_name)}</h2></div><b>待人工核实</b></header><ol class="workflow-steps"><li class="done"><span>01</span><strong>信号接入</strong></li><li class="current"><span>02</span><strong>人工核实</strong></li>${INCIDENT_WORKFLOW_STEPS.slice(2).map((step, index) => `<li class="pending"><span>${String(index + 3).padStart(2, "0")}</span><strong>${step}</strong></li>`).join("")}</ol><footer><p><span>当前责任</span><strong>消控室值班员</strong><small>下一步：确认火警或登记误报</small></p><button type="button" data-workflow-continue data-actor="duty-demo" data-route="#/incidents?event_id=${signal.monitoring_event_id}">去人工核实</button></footer></article>`).join("")}
        ${incidents.map((incident) => {
          const state = incidentWorkflowState(incident);
          return `<article class="workflow-case ${incident.status === "closed" ? "closed" : ""}"><header><div><span>EVENT #${incident.id}</span><h2>${escapeHtml(incident.enterprise_name)}</h2><small>${escapeHtml(incident.district)} · ${escapeHtml(incident.response_brief.address)}</small></div><b>${window.FireGuardEngine.incidentStatusLabel(incident.status)}</b></header>${workflowStepsTemplate(state.current)}<footer><p><span>当前责任</span><strong>${state.role}</strong><small>下一步：${state.action}</small></p><button type="button" data-workflow-continue data-actor="${state.actor}" data-incident-id="${incident.id}" data-crew-id="${state.crewId || ""}" data-route="${state.route}">${state.action}</button></footer></article>`;
        }).join("") || (pendingSignals.length ? "" : `<div class="workflow-empty">当前没有事件流程。请先从态势监测注入一条模拟火警帧。</div>`)}
      </div>
    </section>`;
}

function firstResponsePack(company, dossier) {
  return window.FireGuardEngine.buildFirstResponsePack({
    enterprise: company,
    profile: dossier?.profile || OFFLINE_SITE_PROFILES[company.id] || {},
    devicePoints: dossier?.device_points || [],
    evidenceRefs: dossier?.evidence_refs || [`enterprise_response_profiles/${company.id}`],
  });
}

function firstResponsePackTemplate(company, dossier) {
  const pack = firstResponsePack(company, dossier);
  const traceLabels = {
    get_enterprise_profile: "读取企业基本档案",
    get_site_packet: "聚合危险源、入口、水源和设施",
    get_device_context: "读取消防设备点位",
    check_missing_fields: "检查应急资料缺项",
    build_external_brief: "生成外部救援资料草稿",
  };
  return `
    <article class="dossier-card dossier-response-pack">
      <header>
        <div><span>ENTERPRISE READINESS / AI EVIDENCE</span><h2>企业应急准备与首战资料</h2><p>Agent 只整理企业内部数据、标出缺项并生成只读草稿；对外共享与报警仍由授权人员确认。</p></div>
        <strong class="readiness-score">${pack.readiness.score}<small>/100</small></strong>
      </header>
      <div class="readiness-checks">
        ${pack.readiness.checks.map((item) => `<div class="${item.ready ? "ready" : "missing"}"><i data-lucide="${item.ready ? "check" : "alert-triangle"}"></i><span><strong>${escapeHtml(item.label)}</strong><small>${item.ready ? "资料已就绪" : "需要企业补录"}</small></span></div>`).join("")}
      </div>
      <div class="response-pack-grid">
        <section>
          <h3>首战资料草稿</h3>
          <dl>
            <div><dt>地址</dt><dd>${escapeHtml(pack.site.address)}</dd></div>
            <div><dt>重点危险源</dt><dd>${escapeHtml(pack.site.hazards.join("、") || "未知")}</dd></div>
            <div><dt>优先入口</dt><dd>${escapeHtml(pack.site.access_points.join("、") || "未知")}</dd></div>
            <div><dt>可用水源</dt><dd>${escapeHtml(pack.site.water_sources.join("、") || "未知")}</dd></div>
            <div><dt>消防设施</dt><dd>${escapeHtml(pack.site.facilities.join("、") || "未知")}</dd></div>
          </dl>
        </section>
        <section>
          <h3>Agent 工具与证据链</h3>
          <ol class="response-pack-trace">
            ${pack.agent.tool_trace.map((item) => `<li><i data-lucide="check-circle-2"></i><span><strong>${escapeHtml(traceLabels[item.name] || item.name)}</strong><small>${escapeHtml(item.name)} · ${item.evidence_refs.length} 个来源</small></span></li>`).join("")}
          </ol>
        </section>
      </div>
      <footer>
        <label><input id="response-pack-confirm" type="checkbox" /> 我已核对合成数据，同意导出给外部救援力量作为辅助资料</label>
        <button type="button" class="primary-action" data-action="export-first-response-pack"><i data-lucide="download"></i>人工确认并导出资料包</button>
        <small>${dossier ? "来源：企业档案、设备点位、事件与工单证据" : "离线演示：使用内置合成场地档案，未连接 119 或真实设备"}</small>
      </footer>
    </article>`;
}

function enterpriseDossierTemplate(enterpriseId) {
  const company = companies.find((item) => item.id === enterpriseId) || selectedCompany();
  const profile = monitoringProfiles[company.id] || {};
  const dossier = enterpriseDossierState.id === company.id ? enterpriseDossierState.data : null;
  const companyIssues = dossier?.findings || [];
  const companyEquipment = dossier?.device_points || [];
  const workorders = dossier?.workorders || [];
  const events = dossier?.recent_events || [];
  return `
    <section class="enterprise-dossier" aria-labelledby="dossier-title">
      <header class="workspace-context-bar">
        <div>
          <span>EHS / 车间消防档案</span>
          <h1 id="dossier-title">${escapeHtml(company.name)}</h1>
          <p>${escapeHtml(company.industry)} · ${escapeHtml(company.building)} · ${escapeHtml(profile.district || "")} · 健康指数 ${scoreText(company.score)}</p>
        </div>
        <div class="workspace-context-actions">
          <select id="dossier-enterprise-select" aria-label="切换车间">
            ${companies.map((item) => `<option value="${item.id}" ${item.id === company.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
          </select>
          <a class="secondary-action" href="#/home"><i data-lucide="arrow-left"></i>工作台</a>
        </div>
      </header>
      <div class="dossier-grid">
        ${firstResponsePackTemplate(company, dossier)}
        <article class="dossier-card">
          <h2>风险画像</h2>
          <dl>
            <div><dt>风险等级</dt><dd>${riskLabel(company.level)}</dd></div>
            <div><dt>数据在线率</dt><dd>${escapeHtml(profile.online || "—")}</dd></div>
            <div><dt>火警信号</dt><dd>${escapeHtml(profile.signal || "—")}</dd></div>
            <div><dt>故障趋势</dt><dd>${escapeHtml(profile.fault || "—")}</dd></div>
            <div><dt>维保状态</dt><dd>${escapeHtml(profile.maintenance || "—")}</dd></div>
            <div><dt>未闭环隐患</dt><dd>${company.openHazards}</dd></div>
          </dl>
          <p class="dossier-note">档案是「看清这个车间」的摘要页，不代替核实台或工单终端；下面的按钮把你带进对应岗位流程。</p>
        </article>
        <article class="dossier-card">
          <h2>设备摘要</h2>
          <ul class="dossier-list">
            ${companyEquipment.length ? companyEquipment.slice(0, 5).map((item) => `<li><strong>${escapeHtml(item.device_type || item.point_id)}</strong><span>${escapeHtml(item.location)} · 机${item.controller_no}回路${item.loop_no}点位${item.point_no}</span></li>`).join("") : `<li><strong>${enterpriseDossierState.loading ? "正在读取设备台账" : "设备台账暂不可用"}</strong><span>${enterpriseDossierState.error ? "本地演示未连接设备台账" : "等待后端连接"}</span></li>`}
          </ul>
        </article>
        <article class="dossier-card">
          <h2>隐患摘要</h2>
          <ul class="dossier-list">
            ${companyIssues.length ? companyIssues.slice(0, 5).map((issue) => `<li><strong>${escapeHtml(issue.title)}</strong><span>#${issue.id} · ${escapeHtml(issue.status)} · ${escapeHtml(issue.owner)}</span></li>`).join("") : "<li><strong>暂无未闭环隐患</strong><span>可从防火巡查新建</span></li>"}
          </ul>
        </article>
        <article class="dossier-card">
          <h2>事件与工单</h2>
          <ul class="dossier-list">
            ${events.slice(0, 3).map((event) => `<li><strong>事件 #${event.id} · ${escapeHtml(event.event_type)}</strong><span>${escapeHtml(event.verification_status || "已入库")} · ${escapeHtml(event.raw_ref)}</span></li>`).join("") || "<li><strong>暂无事件</strong><span>可从态势监测注入演示帧</span></li>"}
            ${workorders.slice(0, 3).map((workorder) => `<li><strong>工单 #${workorder.id} · ${escapeHtml(workorder.kind)}</strong><span>${escapeHtml(workorder.status)} · ${escapeHtml(workorder.summary)}</span></li>`).join("")}
          </ul>
        </article>
        <article class="dossier-card">
          <h2>审计证据</h2>
          <ul class="dossier-list">
            ${(dossier?.evidence_refs || []).slice(0, 6).map((ref) => `<li><strong>${escapeHtml(ref)}</strong><span>可回溯原始记录</span></li>`).join("") || "<li><strong>暂无证据引用</strong><span>业务操作后会自动汇总</span></li>"}
          </ul>
        </article>
        <article class="dossier-card dossier-actions">
          <h2>从这里继续处理</h2>
          <ol class="dossier-flow">
            <li><strong>有火警/待核实</strong> → 报警核实台确认或排除</li>
            <li><strong>确认火警/故障</strong> → Copilot 或值班台派发班组工单</li>
            <li><strong>现场隐患</strong> → 防火巡查派发 → 网格待办整改 → 复查闭环</li>
          </ol>
          <div class="dossier-cta-row">
            <button type="button" class="primary-action" data-action="verify-signal"><i data-lucide="shield-alert"></i>去人工核实</button>
            <a class="secondary-action" href="${routeHash("inspections", enterpriseContext())}"><i data-lucide="clipboard-check"></i>去防火巡查</a>
            <a class="secondary-action" href="${routeHash("station", enterpriseContext())}"><i data-lucide="siren"></i>去班组工单</a>
            <a class="secondary-action" href="${routeHash("copilot", enterpriseContext())}"><i data-lucide="sparkles"></i>打开 Copilot</a>
          </div>
        </article>
      </div>
    </section>
  `;
}

async function loadEnterpriseDossier(enterpriseId) {
  if (enterpriseDossierState.id === enterpriseId && (enterpriseDossierState.loading || enterpriseDossierState.data || enterpriseDossierState.error)) return;
  enterpriseDossierState = { id: enterpriseId, data: null, loading: true, error: "" };
  try {
    const response = await fetch(`${MONITORING_API_BASE}/enterprises/${enterpriseId}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "dossier_unavailable");
    enterpriseDossierState = { id: enterpriseId, data: payload, loading: false, error: "" };
  } catch (error) {
    enterpriseDossierState = { id: enterpriseId, data: null, loading: false, error: error.message };
  }
  if ((location.hash || "").startsWith(`#/enterprises/${enterpriseId}`)) renderRoute();
}

function exportFirstResponsePack() {
  if (!document.querySelector("#response-pack-confirm")?.checked) return showToast("请先核对资料并勾选人工确认");
  const company = selectedCompany();
  const dossier = enterpriseDossierState.id === company.id ? enterpriseDossierState.data : null;
  const pack = {
    ...firstResponsePack(company, dossier),
    exported_at: new Date().toISOString(),
    human_confirmation: { confirmed: true, actor_id: demoActorId },
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `fireops-first-response-${company.id}.json` });
  link.click();
  URL.revokeObjectURL(url);
  showToast("首战资料包已导出；未向任何外部系统发送");
}

function guidedEmpty(title, steps) {
  return `
    <div class="guided-empty">
      <strong>${escapeHtml(title)}</strong>
      <ol>${steps.map((step) => `<li>${step}</li>`).join("")}</ol>
    </div>
  `;
}

function monitoringTemplate() {
  const events = window.FireGuardEngine.filterMonitoringEvents(monitoringState.events, monitoringState.filter);
  const selectedEvent = monitoringState.events.find((event) => event.id === monitoringState.selectedId) || events[0] || monitoringState.events[0];
  const company = companies.find((item) => item.id === selectedEvent.enterpriseId) || companies[0];
  const profile = monitoringProfiles[company.id];
  selectedCompanyId = company.id;
  const counts = {
    all: monitoringState.events.length,
    pending: monitoringState.events.filter((event) => event.status === "pending").length,
    processing: monitoringState.events.filter((event) => event.status === "processing").length,
  };
  const floorEvents = events.filter((event) => event.enterpriseId === "ent-001" && (monitoringState.floor === "all" || event.floor === monitoringState.floor));
  const floorDevices = new Set(floorEvents.flatMap((event) => event.devices));
  const selectedOnFloor = floorEvents.some((event) => event.id === selectedEvent.id);
  const pendingFire = selectedEvent.type === "fire" && selectedEvent.status === "pending";
  const tabLabels = { location: "现场位置", trend: "信号趋势", devices: "联动设备", history: "历史事件" };
  const panel = monitoringState.tab === "trend" ? `
    <section class="monitoring-data-panel" data-monitoring-panel="trend"><header><strong>${escapeHtml(company.name)} · ${escapeHtml(selectedEvent.point)} · 信号趋势</strong><span>最近 5 个采样点</span></header><div class="signal-trend-bars">${selectedEvent.trend.map((value, index) => `<div><span>${index + 1}</span><i style="--trend:${value}%"></i><strong>${value}</strong></div>`).join("")}</div></section>
  ` : monitoringState.tab === "devices" ? `
    <section class="monitoring-data-panel" data-monitoring-panel="devices"><header><strong>${escapeHtml(company.name)} · ${escapeHtml(selectedEvent.point)} · 联动设备</strong><span>${selectedEvent.devices.length} 台</span></header><ul class="monitoring-data-list">${selectedEvent.devices.map((device, index) => `<li><i data-lucide="${index ? "link" : "radio-tower"}"></i><span><strong>${escapeHtml(device)}</strong><small>${index ? "已联查 · 待人工确认" : "在线 · 信号已接收"}</small></span></li>`).join("")}</ul></section>
  ` : monitoringState.tab === "history" ? `
    <section class="monitoring-data-panel" data-monitoring-panel="history"><header><strong>${escapeHtml(company.name)} · ${escapeHtml(selectedEvent.point)} · 历史事件</strong><span>${selectedEvent.statusLabel}</span></header><ol class="monitoring-history-list">${selectedEvent.history.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ol></section>
  ` : `
    <section class="monitoring-location-panel" data-monitoring-panel="location">
      <div class="monitoring-checks"><strong>FireOps 已检查</strong><span><i data-lucide="check"></i>信号稳定性</span><span><i data-lucide="check"></i>相邻探测器</span><span><i data-lucide="check"></i>联动设备</span><span><i data-lucide="check"></i>设备状态</span></div>
      <div class="monitoring-floor-summary"><strong>电池车间 · ${monitoringState.floor === "all" ? "全部楼层" : monitoringState.floor} · ${floorEvents.length} 个事件点</strong><span>${floorDevices.size} 台关联设备</span></div>
      <div class="monitoring-floorplan" style="--alarm-left:${selectedEvent.left}%;--alarm-top:${selectedEvent.top}%">
        <div class="monitoring-floor-selector" aria-label="楼层筛选">${[["all","全部楼层"],["3F","3F"],["2F","2F"],["1F","1F"]].map(([value,label]) => `<button type="button" data-monitoring-floor="${value}" aria-pressed="${monitoringState.floor === value}" class="${monitoringState.floor === value ? "active" : ""}">${label}</button>`).join("")}</div>
        <img src="assets/fire-floorplan.png" alt="电池车间消防平面图" />
        <div class="monitoring-zone-label zone-a">极片车间</div><div class="monitoring-zone-label zone-b">化成车间</div><div class="monitoring-zone-label zone-c">电池车间</div><div class="monitoring-zone-label zone-d">成品仓库</div>
        ${floorEvents.map((event) => `<button type="button" class="monitoring-event-pin ${event.id === selectedEvent.id ? "active" : ""}" style="--pin-left:${event.left}%;--pin-top:${event.top}%" data-monitoring-event-pin="${event.id}" aria-label="${escapeHtml(event.point)} ${event.typeLabel}"><i data-lucide="${event.type === "fire" ? "flame" : "circle-alert"}"></i></button>`).join("")}
        ${selectedOnFloor ? pendingFire
          ? `<button type="button" class="monitoring-alarm-pin" data-action="open-monitoring-copilot"><i data-lucide="flame"></i><span><strong>${escapeHtml(selectedEvent.point)}</strong><small>${escapeHtml(selectedEvent.time)} ${escapeHtml(selectedEvent.typeLabel)}</small></span></button>`
          : `<div class="monitoring-alarm-pin"><i data-lucide="${selectedEvent.type === "fault" ? "wrench" : "circle-alert"}"></i><span><strong>${escapeHtml(selectedEvent.point)}</strong><small>${escapeHtml(selectedEvent.time)} ${escapeHtml(selectedEvent.statusLabel)}</small></span></div>` : ""}
      </div>
    </section>`;
  const factoryPanel = `
    <div id="monitoring-3d" class="twin-viewport factory-overview" data-spatial-level="factory" data-selected-company="${company.id}" data-risk-levels="${companies.map((item) => `${item.id}:${item.level}`).join(",")}" role="region" aria-label="星澜新能源汽车工厂三维总览">
      <div class="twin-loading"><span></span>正在加载厂区建筑模型</div>
      <div class="factory-overview-copy"><span>FACTORY DIGITAL TWIN</span><strong>星澜新能源汽车工厂</strong><small>点击厂区风险点，或从电池车间进入消防平面</small></div>
      <button type="button" class="factory-enter-workshop" data-enter-workshop="ent-001"><i data-lucide="factory"></i><span><strong>电池车间</strong><small>PACK / 化成 · 2F 火警待核实</small></span><b>进入电池车间</b></button>
    </div>`;
  return `
    <section class="monitoring-page" aria-labelledby="monitoring-title">
      <div class="monitoring-layout">
        <aside class="monitoring-list" aria-labelledby="monitoring-list-title">
          <div class="monitoring-panel-title"><div><h2 id="monitoring-list-title">事件队列 <b>${counts.all}</b></h2></div><i data-lucide="list-filter"></i></div>
          <div class="monitoring-queue-filters" aria-label="事件筛选">${[["all","全部"],["pending","待核实"],["processing","处理中"]].map(([value,label]) => `<button type="button" data-monitoring-filter="${value}" aria-pressed="${monitoringState.filter === value}" class="${monitoringState.filter === value ? "active" : ""}">${label} ${counts[value]}</button>`).join("")}</div>
          <div class="monitoring-company-list">
            ${events.map((event) => { const item = companies.find((entry) => entry.id === event.enterpriseId) || companies[0]; return `<button type="button" class="monitoring-company ${event.id === selectedEvent.id ? "active" : ""}" data-monitoring-event="${event.id}" data-status="${event.status}" aria-pressed="${event.id === selectedEvent.id}"><span class="monitoring-event-icon"><i data-lucide="${event.type === "fire" ? "flame" : event.type === "fault" ? "wrench" : "circle-alert"}"></i></span><span><small>${event.typeLabel} <time>${event.time}</time></small><strong>${escapeHtml(item.name.replace(/（.*?）/g, ""))}</strong><em>${escapeHtml(event.floor)} · ${escapeHtml(event.point)}</em><small>${event.statusLabel} · 指数 ${scoreText(item.score)}</small></span><i data-lucide="chevron-right"></i></button>`; }).join("") || `<div class="monitoring-empty"><strong>当前筛选暂无事件</strong><button type="button" data-monitoring-filter="all">查看全部</button></div>`}
          </div>
          <div class="monitoring-source"><i data-lucide="database"></i><span>${monitoringBackend.status === "live" ? "实时数据已连接" : "评审演示模式 · 本地合成数据"}</span></div>
        </aside>
        <section class="twin-panel" aria-labelledby="twin-title">
          <header class="monitoring-focus-header">
            <div><span>${escapeHtml(selectedEvent.typeLabel)} · ${escapeHtml(selectedEvent.statusLabel)}</span><h1 id="monitoring-title">${escapeHtml(company.name.replace(/（.*?）/g, ""))} ${escapeHtml(selectedEvent.location)}</h1><dl><div><dt>事件时间</dt><dd>${escapeHtml(selectedEvent.time)}</dd></div><div><dt>探测点</dt><dd>${escapeHtml(selectedEvent.point)}</dd></div><div><dt>位置</dt><dd>${escapeHtml(selectedEvent.floor)} / ${escapeHtml(profile.district)} / ${escapeHtml(selectedEvent.location)}</dd></div><div><dt>消防指数</dt><dd>${scoreText(company.score)} / 100</dd></div></dl></div>
            <div class="twin-actions"><button type="button" data-action="inject-demo-event"><i data-lucide="radio-tower"></i>模拟火警帧</button><button type="button" data-action="inject-demo-fault"><i data-lucide="wrench"></i>模拟故障</button></div>
          </header>
          ${monitoringState.spatialLevel === "workshop" ? `<div class="monitoring-workshop-nav"><button type="button" data-return-factory><i data-lucide="arrow-left"></i>返回工厂总览</button><span>工厂总览 / 电池车间 / ${escapeHtml(selectedEvent.floor)}</span></div><nav class="monitoring-view-tabs" role="tablist" aria-label="事件视图">${Object.entries(tabLabels).map(([value,label]) => `<button type="button" role="tab" data-monitoring-tab="${value}" aria-selected="${monitoringState.tab === value}" class="${monitoringState.tab === value ? "active" : ""}">${label}</button>`).join("")}</nav><div class="twin-viewport" data-spatial-level="workshop" data-selected-company="${company.id}" role="region" aria-label="电池车间消防空间视图">${panel}</div>` : factoryPanel}
        </section>
        <aside class="monitoring-detail" aria-labelledby="monitoring-detail-title">
          <div class="detail-eyebrow"><h2 id="monitoring-detail-title">证据摘要</h2><strong>5/5</strong></div>
          <section class="monitoring-evidence-summary" aria-label="证据摘要">
            ${[["chart-no-axes-column-increasing","信号趋势"],["radio-tower","相邻探测器"],["link","联动设备"],["video","视频复核"],["battery-charging","设备状态"]].map(([icon,label]) => `<div><i data-lucide="${icon}"></i><strong>${label}</strong><span>已检查 <i data-lucide="circle-check"></i></span></div>`).join("")}
          </section>
          ${pendingFire ? `<section class="monitoring-human-gate"><header><strong>待人工核实</strong><span>必须</span></header><p>请现场或视频确认是否存在火情。</p><ul><li>进入 Copilot 补齐证据并生成处置草案</li><li>如为误报，登记原因并关闭事件</li></ul><button class="monitoring-primary" type="button" data-action="open-monitoring-copilot"><i data-lucide="shield-alert"></i>进入 Copilot 核实处置</button><button class="monitoring-secondary" type="button" data-action="dismiss-monitoring-event">登记误报并关闭</button></section>`
            : `<section class="monitoring-human-gate monitoring-state-card"><header><strong>${selectedEvent.status === "closed" ? "事件已恢复" : selectedEvent.type === "fault" && selectedEvent.status === "pending" ? "待人工排障" : selectedEvent.type === "fault" ? "故障处理中" : "事件处理中"}</strong><span>${escapeHtml(selectedEvent.statusLabel)}</span></header><p>${selectedEvent.status === "closed" ? "该事件已完成复核并恢复，处置记录保留在历史事件中。" : selectedEvent.type === "fault" ? "该事件按设备维修流程处理，不进入火警确认与应急派单。" : "责任班组已受领，请在流程监管中查看后续进度。"}</p></section>`}
          <section class="monitoring-recommendation"><strong><i data-lucide="clipboard-check"></i>建议行动</strong><ol><li>通知现场人员前往核实</li><li>准备灭火器材，等待支援</li></ol></section>
          <button class="monitoring-dossier-link" type="button" data-action="company-overview">查看 ${escapeHtml(company.name)} 档案 <i data-lucide="arrow-up-right"></i></button>
        </aside>
      </div>
    </section>
  `;
}

function allIssues() {
  return [...dynamicIssues, ...issues];
}

function inspectionTemplate() {
  return `
    <section class="inspection-workspace">
      <header class="workspace-context-bar">
        <div><span>防火巡查员 / 网格责任人</span><h1>防火巡查与隐患闭环</h1><p>拍照识别隐患、语音辅助录入、派发网格责任人整改与复查</p></div>
        <div class="workspace-context-actions">
          <button type="button" class="primary-action" data-action="open-inspect-capture"><i data-lucide="camera"></i>新建巡查识别</button>
          <button type="button" class="secondary-action" data-action="scan-maintenance"><i data-lucide="wrench"></i>扫描维保逾期</button>
          <a href="#/analysis/${selectedCompanyId}" class="secondary-action"><i data-lucide="file-text"></i>AI 分析报告</a>
        </div>
      </header>
      ${maintenanceDrafts.length ? `
        <aside class="maintenance-draft-strip" aria-label="预防性维保草稿">
          <strong>维保逾期工单草稿（${maintenanceDrafts.length}）</strong>
          ${maintenanceDrafts.slice(0, 3).map((item) => `
            <button type="button" data-approve-workorder="${item.id}" ${item.status === "approved" ? "disabled" : ""}>
              #${item.id} · ${escapeHtml(item.summary || "").slice(0, 48)}… · ${item.status === "approved" ? "已派发" : "待确认派发"}
            </button>
          `).join("")}
        </aside>
      ` : ""}
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
              ${allIssues().map((issue) => `<button class="map-pin ${issue.id === selectedIssueId ? "active" : ""}" style="--pin-left:${issue.pin.left}%;--pin-top:${issue.pin.top}%" type="button" data-issue-id="${issue.id}" aria-label="隐患 ${issue.number}：${issue.title}">${issue.number}</button>`).join("")}
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
  const catalog = allIssues();
  const visibleIssues = hazardFilter === "all" ? catalog : catalog.filter((issue) => issue.statusType === hazardFilter);
  return `
    <div class="filter-pills" aria-label="隐患筛选">
      <button class="${hazardFilter === "all" ? "active" : ""}" type="button" data-hazard-filter="all">全部 <b>${catalog.length}</b></button>
      <button class="${hazardFilter === "urgent" ? "active" : ""}" type="button" data-hazard-filter="urgent">待整改 <b>${catalog.filter((item) => item.statusType === "urgent").length}</b></button>
      <button class="${hazardFilter === "progress" ? "active" : ""}" type="button" data-hazard-filter="progress">整改中 <b>${catalog.filter((item) => item.statusType === "progress").length}</b></button>
      <button type="button" data-hazard-filter="closed">已闭环 <b>0</b></button>
    </div>
    <div class="panel-filters"><select aria-label="隐患状态"><option>全部状态</option><option>逾期</option><option>重复隐患</option></select><select aria-label="隐患排序"><option>按发现时间</option><option>按整改期限</option></select></div>
    <div class="issue-list">
      ${visibleIssues.length ? visibleIssues.map(issueCard).join("") : `<div class="empty-panel"><i data-lucide="circle-check-big"></i><strong>当前筛选没有隐患</strong><span>已闭环记录可在历史列表中查看。</span></div>`}
    </div>
    <div class="panel-pagination"><span>共 ${catalog.length} 条</span><div><button type="button" disabled aria-label="上一页"><i data-lucide="chevron-left"></i></button><button type="button" class="active" disabled data-disabled-reason="当前仅一页">1</button></div></div>
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
  if (!assessment) return `
    <section class="report-page report-empty-page">
      <header class="report-header"><div><span>FIRE SAFETY ASSESSMENT</span><h1>${escapeHtml(company.name)}消防健康报告</h1><p>用于完成风险评分后的研判，以及月度、季度消防复盘。</p></div><a href="#/inspections" class="secondary-action"><i data-lucide="arrow-left"></i>返回防火巡查</a></header>
      <div class="report-empty-state"><i data-lucide="file-warning"></i><h2>暂无评分数据</h2><p>当前车间还没有可用于生成报告的结构化评分。请先导入数据，或载入固定演示数据查看完整报告。</p><button type="button" class="primary-action" data-action="use-demo-assessment">使用演示数据</button><small>演示数据不会写入数据库，也不代表真实检查结论。</small></div>
    </section>`;
  const score = assessment.totalScore;
  const level = assessment.riskLevel;
  const rules = assessment.triggeredRules || [];
  return `
    <section class="report-page">
        <header class="report-header"><div><span>结构化模板生成 · ${assessment.ruleVersion || DEMO_RULESET}</span><h1>${escapeHtml(company.name)}消防健康报告</h1><p>用于风险评分后或周期复盘 · 数据截止 ${assessment.dataCutoff?.replace("T", " ").slice(0, 16) || DATA_CUTOFF} · 当前得分 ${scoreText(score)} · ${riskLabel(level)}</p></div><a href="#/inspections" class="secondary-action"><i data-lucide="arrow-left"></i>返回防火巡查</a></header>
      <div class="report-layout">
        <aside class="report-facts"><h2>结构化事实</h2><div><span>触发规则</span><strong>${rules.length}</strong></div><div><span>累计扣分</span><strong>${score === null ? "—" : 100 - score}</strong></div><div><span>原始证据</span><strong>${rules.reduce((sum, rule) => sum + rule.evidence.length, 0)}</strong></div><div><span>数据状态</span><strong>${level === "unrated" ? "不足" : "完整"}</strong></div><p>输入指纹 ${assessment.inputHash || "演示固定输入"}<br />以上字段来自确定性规则，报告不得改写数值。</p></aside>
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
  const [routePath, queryString = ""] = (location.hash || "#/home").replace(/^#\//, "").split("?");
  const route = routePath.split("/");
  applyRouteContext(new URLSearchParams(queryString));
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
  } else if (root === "workflow") {
    app.innerHTML = workflowSupervisionTemplate();
  } else if (root === "copilot") {
    app.innerHTML = copilotTemplate();
    loadCopilotScenarios();
  } else if (root === "station") {
    app.innerHTML = stationTerminalTemplate();
  } else if (root === "owner") {
    app.innerHTML = ownerInboxTemplate();
  } else if (root === "enterprises") {
    if (route[1]) selectedCompanyId = route[1];
    app.innerHTML = enterpriseDossierTemplate(selectedCompanyId);
  } else {
    app.innerHTML = homeTemplate();
  }
  bindDynamicActions();
  refreshIcons();
  window.dispatchEvent(new CustomEvent("fireguard:route-rendered", { detail: { root } }));
  clearTimeout(threeDFallbackTimer);
  if (root === "monitoring") {
    threeDFallbackTimer = setTimeout(() => {
      const host = document.querySelector("#monitoring-3d");
      if (host && host.getAttribute("data-3d-state") !== "ready") renderThreeDFallback(host);
    }, 3500);
  }
  if (root === "enterprises") loadEnterpriseDossier(selectedCompanyId);
  if (root === "monitoring") startMonitoringBackend();
  else if (monitoringEventSource) stopMonitoringBackend();
  if (["incidents", "station", "owner", "copilot", "workflow"].includes(root)) startIncidentBackend();
  else if (incidentEventSource) stopIncidentBackend();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function renderThreeDFallback(host) {
  if (!host || host.getAttribute("data-3d-state") === "ready") return;
  host.setAttribute("data-3d-state", "fallback");
  host.classList.add("no-webgl");
  host.querySelector(".twin-loading")?.remove();
  if (!host.querySelector(".twin-fallback")) host.insertAdjacentHTML("beforeend", `
    <div class="twin-fallback">
      <strong>三维态势暂不可用</strong>
      <span>仍可通过二维入口完成评审流程。</span>
      <button type="button" data-enter-workshop="ent-001">进入电池车间二维平面</button>
    </div>`);
  bindSpatialActions();
}

function bindSpatialActions() {
  app.querySelectorAll("[data-enter-workshop]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.enterWorkshop !== "ent-001") return showToast("本阶段开放电池车间，其余工艺车间将在下一阶段补齐");
    selectedCompanyId = "ent-001";
    monitoringState.selectedId = monitoringState.events.find((event) => event.enterpriseId === "ent-001")?.id || monitoringState.selectedId;
    monitoringState.floor = "2F";
    monitoringState.spatialLevel = "workshop";
    renderRoute();
  }));
  app.querySelectorAll("[data-return-factory]").forEach((button) => button.addEventListener("click", () => {
    monitoringState.spatialLevel = "factory";
    renderRoute();
  }));
}

function bindDynamicActions() {
  bindSpatialActions();
  app.querySelectorAll("[data-signal-select]").forEach((button) => button.addEventListener("click", () => {
    selectedSignalEventId = Number(button.dataset.signalSelect); renderRoute();
  }));
  app.querySelectorAll("[data-incident-select]").forEach((button) => button.addEventListener("click", () => {
    selectedIncidentId = Number(button.dataset.incidentSelect); renderRoute();
  }));
  app.querySelectorAll("[data-station-task]").forEach((button) => button.addEventListener("click", () => {
    selectedStationTaskId = Number(button.dataset.stationTask); renderRoute();
  }));
  app.querySelectorAll("[data-inbox-select]").forEach((button) => button.addEventListener("click", () => {
    selectedInboxId = button.dataset.inboxSelect;
    const item = (incidentBackend.inbox || []).find((row) => row.inbox_id === selectedInboxId);
    if (item?.incident_id) selectedStationTaskId = item.incident_id;
    renderRoute();
  }));
  document.querySelector("#terminal-crew-select")?.addEventListener("change", (event) => {
    terminalStationId = event.target.value;
    selectedInboxId = null;
    scheduleIncidentRefresh();
  });
  document.querySelector("#terminal-owner-select")?.addEventListener("change", (event) => {
    terminalOwnerName = event.target.value;
    selectedInboxId = null;
    scheduleIncidentRefresh();
  });
  document.querySelector("#dossier-enterprise-select")?.addEventListener("change", (event) => {
    selectedCompanyId = event.target.value;
    enterpriseDossierState = { id: null, data: null, loading: false, error: "" };
    location.hash = `#/enterprises/${selectedCompanyId}`;
  });
  app.querySelectorAll("[data-repair-select]").forEach((button) => button.addEventListener("click", () => {
    const eventId = Number(button.dataset.repairEvent);
    const workorderId = Number(button.dataset.repairSelect);
    const draft = (incidentBackend.repairDrafts || []).find((item) => item.workorder_id === workorderId);
    if (eventId) {
      bindHubSignal(eventId, draft?.enterprise_id || selectedCompanyId, "C-controller-fault-diagnosis");
    } else {
      terminalStationId = "crew-wb-01";
      selectedInboxId = `workorder-${workorderId}`;
      location.hash = "#/station";
      scheduleIncidentRefresh();
    }
  }));
  app.querySelectorAll("[data-monitoring-company]").forEach((button) => button.addEventListener("click", () => {
    selectedCompanyId = button.dataset.monitoringCompany;
    renderRoute();
  }));
  app.querySelectorAll("[data-monitoring-filter]").forEach((button) => button.addEventListener("click", () => {
    monitoringState.filter = button.dataset.monitoringFilter;
    const visible = window.FireGuardEngine.filterMonitoringEvents(monitoringState.events, monitoringState.filter);
    if (visible.length && !visible.some((event) => event.id === monitoringState.selectedId)) {
      monitoringState.selectedId = visible[0].id;
      monitoringState.floor = visible[0].floor;
    }
    const selected = monitoringState.events.find((event) => event.id === monitoringState.selectedId);
    if (monitoringState.spatialLevel === "workshop" && selected?.enterpriseId !== "ent-001") monitoringState.spatialLevel = "factory";
    renderRoute();
  }));
  app.querySelectorAll("[data-monitoring-event], [data-monitoring-event-pin]").forEach((button) => button.addEventListener("click", () => {
    monitoringState.selectedId = button.dataset.monitoringEvent || button.dataset.monitoringEventPin;
    const event = monitoringState.events.find((item) => item.id === monitoringState.selectedId);
    if (event) {
      selectedCompanyId = event.enterpriseId;
      monitoringState.floor = event.floor;
      if (monitoringState.spatialLevel === "workshop" && event.enterpriseId !== "ent-001") monitoringState.spatialLevel = "factory";
    }
    renderRoute();
  }));
  app.querySelectorAll("[data-monitoring-tab]").forEach((button) => button.addEventListener("click", () => {
    monitoringState.tab = button.dataset.monitoringTab;
    renderRoute();
  }));
  app.querySelectorAll("[data-monitoring-floor]").forEach((button) => button.addEventListener("click", () => {
    monitoringState.floor = button.dataset.monitoringFloor;
    renderRoute();
  }));
  app.querySelectorAll("[data-enterprise-beacon]").forEach((button) => button.addEventListener("click", () => {
    selectedCompanyId = button.dataset.enterpriseBeacon;
    renderRoute();
  }));
  app.querySelectorAll("[data-copilot-bind]").forEach((button) => button.addEventListener("click", () => {
    copilotState.bindSource = button.dataset.copilotBind;
    if (copilotState.bindSource === "scenario") {
      copilotState.hubEventId = null;
      copilotState.hubEnterpriseId = null;
    }
    renderRoute();
  }));
  app.querySelectorAll("[data-hub-signal]").forEach((button) => button.addEventListener("click", () => {
    copilotState.bindSource = "hub";
    copilotState.hubEventId = Number(button.dataset.hubSignal);
    copilotState.hubEnterpriseId = button.dataset.hubEnterprise || null;
    renderRoute();
  }));

  app.querySelectorAll("[data-company-id]").forEach((button) => button.addEventListener("click", () => {
    selectedCompanyId = button.dataset.companyId;
    selectedIssueId = allIssues()[0]?.id || "hazard-01";
    renderRoute();
  }));

  app.querySelectorAll("[data-approve-workorder]").forEach((button) => button.addEventListener("click", () => {
    approveMaintenanceWorkorder(Number(button.dataset.approveWorkorder));
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

  app.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.action === "approve-inbox-workorder") {
      approveMaintenanceWorkorder(Number(button.dataset.workorderId)).then(() => scheduleIncidentRefresh());
      return;
    }
    if (button.dataset.action === "start-inbox-workorder") {
      startInboxWorkorder(Number(button.dataset.workorderId));
      return;
    }
    if (button.dataset.action === "complete-inbox-workorder") {
      completeInboxWorkorder(Number(button.dataset.workorderId));
      return;
    }
    if (button.dataset.action === "diagnose-event-copilot") {
      bindHubSignal(Number(button.dataset.eventId), button.dataset.enterpriseId, "C-controller-fault-diagnosis");
      return;
    }
    handleAction(button.dataset.action, button.dataset.issueId);
  }));

  app.querySelectorAll("[data-workflow-continue]").forEach((button) => button.addEventListener("click", () => {
    const actor = button.dataset.actor;
    if (actor) setDemoActor(actor);
    if (button.dataset.incidentId) selectedIncidentId = Number(button.dataset.incidentId);
    if (button.dataset.crewId) {
      terminalStationId = button.dataset.crewId;
      selectedInboxId = null;
      selectedStationTaskId = null;
    }
    location.hash = button.dataset.route || "#/workflow";
    scheduleIncidentRefresh();
  }));

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
    if (action === "judge-run") startJudgeDemo();
    else if (action === "run") runCopilotScenario();
    else if (action === "reset") resetCopilot();
    else if (action === "dispatch") confirmCopilotDispatch();
    else if (action === "offline-archive") archiveOfflineJudgeDemo();
    else if (action === "view-record") openCopilotRunRecord();
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
  document.querySelector("#run-record-download")?.addEventListener("click", exportCopilotAuditPack);
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
    recheckInspectionFinding();
  });

  const assetGrid = document.querySelector("#inspect-asset-grid");
  if (assetGrid) {
    assetGrid.innerHTML = DEMO_INSPECT_ASSETS.map((asset) => `
      <button type="button" class="inspect-asset ${asset === inspectCapture.imageAsset ? "selected" : ""}" data-inspect-asset="${asset}" role="option" aria-selected="${asset === inspectCapture.imageAsset}">
        <img src="${asset}" alt="演示证据 ${asset.split("/").pop()}" />
      </button>
    `).join("");
    assetGrid.querySelectorAll("[data-inspect-asset]").forEach((button) => button.addEventListener("click", () => {
      inspectCapture.imageAsset = button.dataset.inspectAsset;
      inspectCapture.draft = null;
      inspectCapture.findingId = null;
      assetGrid.querySelectorAll("[data-inspect-asset]").forEach((item) => {
        const selected = item.dataset.inspectAsset === inspectCapture.imageAsset;
        item.classList.toggle("selected", selected);
        item.setAttribute("aria-selected", selected ? "true" : "false");
      });
      renderInspectDraftPanel();
    }));
  }
  document.querySelector("#inspect-analyze-btn")?.addEventListener("click", () => analyzeInspectionDraft());
  document.querySelector("#inspect-dispatch-btn")?.addEventListener("click", () => dispatchInspectionFinding());
  document.querySelector("#inspect-voice-btn")?.addEventListener("click", () => startInspectVoiceInput());
  document.querySelector("#inspect-voice-text")?.addEventListener("input", (event) => {
    inspectCapture.voiceText = event.target.value;
  });
}

function findingToIssue(finding, number) {
  const statusMap = {
    draft: { status: "待派发确认", statusType: "urgent" },
    assigned: { status: "隐患整改中", statusType: "progress" },
    in_progress: { status: "隐患整改中", statusType: "progress" },
    closed: { status: "已闭环", statusType: "progress" },
    abstained: { status: "证据不足", statusType: "urgent" },
  };
  const mapped = statusMap[finding.status] || statusMap.draft;
  const pin = finding.pin && typeof finding.pin === "object" ? finding.pin : { left: 50, top: 50 };
  return {
    id: `finding-${finding.id}`,
    number,
    title: finding.title,
    location: finding.location || "未知位置",
    tag: finding.category || "巡查隐患",
    status: mapped.status,
    statusType: mapped.statusType,
    description: finding.description || "",
    department: finding.department || "",
    owner: finding.owner || "",
    dueAt: (finding.due_at || "").slice(0, 10) || "—",
    dueText: finding.status === "assigned" ? "已派发网格责任人" : "待人工确认派发",
    foundAt: (finding.created_at || "").replace("T", " ").slice(0, 16) || "刚刚",
    repeated: finding.voice_text ? `口述：${finding.voice_text.slice(0, 24)}` : "巡查识别新建",
    image: finding.image_asset || DEMO_INSPECT_ASSETS[0],
    pin,
    findingId: finding.id,
  };
}

function openInspectCapture() {
  inspectCapture = {
    imageAsset: DEMO_INSPECT_ASSETS[0],
    voiceText: "",
    draft: null,
    findingId: null,
    busy: false,
    recognition: null,
  };
  const voice = document.querySelector("#inspect-voice-text");
  if (voice) voice.value = "";
  const grid = document.querySelector("#inspect-asset-grid");
  if (grid) {
    grid.querySelectorAll("[data-inspect-asset]").forEach((item) => {
      const selected = item.dataset.inspectAsset === inspectCapture.imageAsset;
      item.classList.toggle("selected", selected);
      item.setAttribute("aria-selected", selected ? "true" : "false");
    });
  }
  renderInspectDraftPanel();
  document.querySelector("#inspect-capture-dialog")?.showModal();
  refreshIcons();
}

function renderInspectDraftPanel() {
  const panel = document.querySelector("#inspect-draft-panel");
  const dispatchBtn = document.querySelector("#inspect-dispatch-btn");
  if (!panel || !dispatchBtn) return;
  const draft = inspectCapture.draft;
  if (!draft) {
    panel.hidden = true;
    panel.innerHTML = "";
    dispatchBtn.disabled = true;
    return;
  }
  panel.hidden = false;
  panel.innerHTML = `
    <div class="inspect-draft-card ${draft.abstained ? "abstained" : ""}">
      <strong>${escapeHtml(draft.title)}</strong>
      <span>置信度 ${(Number(draft.confidence || 0) * 100).toFixed(0)}% · 建议责任人 ${escapeHtml(draft.owner)}（${escapeHtml(draft.department)}）</span>
      <p>${escapeHtml(draft.description)}</p>
      <span>识别来源 ${escapeHtml(draft.provider || "unknown")} / ${escapeHtml(draft.model_name || "unknown")} · ${draft.is_simulation ? "演示推理" : "外部模型"}${draft.fallback_reason ? ` · 已回退：${escapeHtml(draft.fallback_reason)}` : ""}</span>
      <small>${escapeHtml(draft.disclaimer || "")}</small>
    </div>
  `;
  dispatchBtn.disabled = Boolean(draft.abstained) || inspectCapture.busy;
}

async function analyzeInspectionDraft() {
  if (inspectCapture.busy) return;
  inspectCapture.busy = true;
  inspectCapture.voiceText = document.querySelector("#inspect-voice-text")?.value || "";
  try {
    const response = await fetch(`${MONITORING_API_BASE}/inspection/analyze`, {
      method: "POST",
      headers: actorHeaders(),
      body: JSON.stringify({
        enterprise_id: selectedCompanyId,
        image_asset: inspectCapture.imageAsset,
        voice_text: inspectCapture.voiceText,
        mode: copilotState.mode,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "analyze_failed");
    inspectCapture.draft = payload.draft;
    renderInspectDraftPanel();
    showToast(payload.draft.abstained ? "证据不足，已安全拒答" : "已生成隐患草稿，请人工确认后派发");
  } catch (error) {
    showToast(`识别失败：${error.message}`);
  } finally {
    inspectCapture.busy = false;
    renderInspectDraftPanel();
  }
}

async function dispatchInspectionFinding() {
  if (!inspectCapture.draft || inspectCapture.draft.abstained || inspectCapture.busy) return;
  inspectCapture.busy = true;
  renderInspectDraftPanel();
  try {
    const created = await fetch(`${MONITORING_API_BASE}/inspection/findings`, {
      method: "POST",
      headers: actorHeaders(),
      body: JSON.stringify({
        enterprise_id: selectedCompanyId,
        image_asset: inspectCapture.imageAsset,
        voice_text: inspectCapture.voiceText,
      }),
    }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "create_failed");
      return payload;
    });
    const findingId = created.finding.id;
    const dispatched = await fetch(`${MONITORING_API_BASE}/inspection/findings/${findingId}/dispatch`, {
      method: "POST",
      headers: actorHeaders(),
      body: JSON.stringify({ note: "巡查员人工确认派发网格责任人（模拟）" }),
    }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "dispatch_failed");
      return payload;
    });
    const issue = findingToIssue(dispatched.finding, dynamicIssues.length + issues.length + 1);
    dynamicIssues = [issue, ...dynamicIssues.filter((item) => item.id !== issue.id)];
    selectedIssueId = issue.id;
    const company = companies.find((item) => item.id === selectedCompanyId);
    if (company) company.openHazards = Number(company.openHazards || 0) + 1;
    document.querySelector("#inspect-capture-dialog")?.close();
    if (issue.owner) terminalOwnerName = issue.owner;
    selectedInboxId = dispatched.workorder?.id ? `workorder-${dispatched.workorder.id}` : null;
    showToast(`已派发整改任务给 ${issue.owner}（${issue.department}），正在打开网格待办…`);
    location.hash = "#/owner";
    scheduleIncidentRefresh();
  } catch (error) {
    showToast(`派发失败：${error.message}`);
  } finally {
    inspectCapture.busy = false;
  }
}

function startInspectVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voice = document.querySelector("#inspect-voice-text");
  if (!SpeechRecognition || !voice) {
    voice.value = (voice.value ? `${voice.value} ` : "") + "PACK 通道东侧灭火器被物料箱挡住了";
    inspectCapture.voiceText = voice.value;
    showToast("当前浏览器不支持语音识别，已填入演示口述文本");
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const text = event.results[0]?.[0]?.transcript || "";
    voice.value = voice.value ? `${voice.value} ${text}` : text;
    inspectCapture.voiceText = voice.value;
    showToast("语音已写入备注");
  };
  recognition.onerror = () => showToast("语音识别失败，可改用手输备注");
  recognition.start();
  showToast("正在聆听…请口述隐患要点");
}

async function scanMaintenanceOverdue() {
  try {
    const response = await fetch(`${MONITORING_API_BASE}/maintenance/overdue-scan`, {
      method: "POST",
      headers: actorHeaders(),
      body: JSON.stringify({ enterprise_id: selectedCompanyId, create_drafts: true }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "scan_failed");
    maintenanceDrafts = payload.workorders || [];
    showToast(`扫描到 ${payload.suggestions?.length || 0} 项维保逾期，已生成草稿待确认`);
    renderRoute();
  } catch (error) {
    showToast(`维保扫描失败：${error.message}`);
  }
}

async function approveMaintenanceWorkorder(workorderId) {
  try {
    const response = await fetch(`${MONITORING_API_BASE}/workorders/${workorderId}/approve`, {
      method: "POST",
      headers: actorHeaders(),
      body: JSON.stringify({ note: "值班负责人确认派发维保组（模拟）" }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "approve_failed");
    maintenanceDrafts = maintenanceDrafts.map((item) => (
      item.id === workorderId ? { ...item, ...payload.workorder } : item
    ));
    showToast(`维保工单 #${workorderId} 已确认派发`);
    renderRoute();
  } catch (error) {
    showToast(`工单确认失败：${error.message}`);
  }
}

async function postWorkorderTransition(workorderId, action, note) {
  const response = await fetch(`${MONITORING_API_BASE}/workorders/${workorderId}/${action}`, {
    method: "POST",
    headers: actorHeaders(),
    body: JSON.stringify({ note }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || `${action}_failed`);
  return payload;
}

async function startInboxWorkorder(workorderId) {
  try {
    await postWorkorderTransition(workorderId, "start", "人工确认开始处理（模拟）");
    showToast(`工单 #${workorderId} 已开始处理`);
    selectedInboxId = `workorder-${workorderId}`;
    scheduleIncidentRefresh();
  } catch (error) {
    showToast(`开工失败：${error.message}`);
  }
}

async function completeInboxWorkorder(workorderId) {
  try {
    await postWorkorderTransition(workorderId, "complete", "人工完成核验（模拟）");
    showToast(`工单 #${workorderId} 已完成核验`);
    selectedInboxId = null;
    scheduleIncidentRefresh();
  } catch (error) {
    showToast(`完成核验失败：${error.message}`);
  }
}

async function recheckInspectionFinding() {
  const issue = selectedIssue();
  if (!issue?.findingId) {
    workflowStarted = true;
    renderWorkflow(issue);
    showToast("演示隐患无后端记录，已本地标记复查发起");
    return;
  }
  try {
    const response = await fetch(`${MONITORING_API_BASE}/inspection/findings/${issue.findingId}/recheck`, {
      method: "POST",
      headers: actorHeaders(),
      body: JSON.stringify({ result: "passed", note: "专项复查通过（模拟）" }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "recheck_failed");
    workflowStarted = true;
    renderWorkflow(issue);
    showToast(`隐患 #${issue.findingId} 复查通过，已闭环`);
    if ((location.hash || "").startsWith("#/inspections")) {
      const findingsResponse = await fetch(`${MONITORING_API_BASE}/inspection/findings?enterprise_id=${encodeURIComponent(selectedCompanyId)}`);
      if (findingsResponse.ok) {
        const body = await findingsResponse.json();
        // 触发巡查列表刷新：复用既有导入后路径
        if (Array.isArray(body.items)) {
          body.items.forEach((finding, index) => {
            const mapped = findingToIssue(finding, index + 1);
            const existing = issues.find((row) => row.findingId === finding.id);
            if (existing) Object.assign(existing, mapped);
          });
        }
      }
      renderRoute();
    }
  } catch (error) {
    showToast(`复查失败：${error.message}`);
  }
}

async function importCsvFiles(files) {
  const names = files.map((file) => file.name).sort();
  if (JSON.stringify(names) !== JSON.stringify(expectedCsvFiles)) throw new Error(`文件不完整，应选择：${expectedCsvFiles.join("、")}`);
  if (files.some((file) => file.size > 1_000_000)) throw new Error("单个 CSV 不得超过 1 MB");
  const bundle = {};
  for (const file of files) {
    bundle[file.name] = window.FireGuardEngine.parseCsv(await file.text());
  }
  const enterpriseId = bundle["enterprises.csv"]?.[0]?.enterprise_id;
  for (const fileName of expectedCsvFiles.slice(1)) bundle[fileName] = bundle[fileName].filter((row) => row.enterprise_id === enterpriseId);
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
  const closed = issue.status === "已闭环" || issue.statusType === "closed";
  button.disabled = workflowStarted || closed;
  button.textContent = closed || workflowStarted ? "复查已完成" : "复查通过并闭环";
  refreshIcons();
}

function handleAction(action, issueId) {
  if (action === "go-inspections") {
    location.hash = "#/inspections";
    return;
  }
  if (action === "open-monitoring-copilot") {
    const event = monitoringState.events.find((item) => item.id === monitoringState.selectedId);
    if (!event || event.type !== "fire" || event.status !== "pending") return showToast("当前事件不需要火警核实");
    event.history = [...event.history, "人工进入 Copilot 核实与处置"];
    location.hash = `#/copilot?source_event=${encodeURIComponent(event.id)}`;
    return;
  }
  if (action === "dismiss-monitoring-event") {
    const event = monitoringState.events.find((item) => item.id === monitoringState.selectedId);
    if (!event || event.type !== "fire" || event.status !== "pending") return showToast("当前事件不能登记为误报");
    Object.assign(event, { status: "closed", statusLabel: "已排除", history: [...event.history, "人工登记误报并关闭"] });
    monitoringState.filter = "all";
    renderRoute();
    return showToast("已登记误报，未建立处置事件");
  }
  if (action === "export-first-response-pack") return exportFirstResponsePack();
  if (action === "confirm-device-signal") return postIncidentAction(`/signals/${selectedSignalEventId}/verification`, { result: "confirmed", note: "人工核实确认（模拟）" }, "已确认火警并建立处置事件，对外报警由人工执行");
  if (action === "dismiss-device-signal") return postIncidentAction(`/signals/${selectedSignalEventId}/verification`, { result: "dismissed", note: "人工核实排除（模拟）" }, "已登记误报，不建立处置事件");
  if (action === "dispatch-incident") {
    const stationId = document.querySelector("#dispatch-station")?.value;
    if (!stationId) return showToast("当前片区没有可派单的班组");
    return postIncidentAction(`/incidents/${selectedIncidentId}/dispatch`, { station_id: stationId }, "工单已派发至处置班组");
  }
  if (action === "close-incident") {
    return postIncidentAction(`/incidents/${selectedIncidentId}/close`, { note: "现场反馈已人工核验，事件归档" }, "事件已归档，处置班组恢复可调派");
  }
  if (action === "station-next-action") {
    const selected = (incidentBackend.inbox || []).find((item) => item.inbox_id === selectedInboxId);
    const task = incidentBackend.tasks.find((item) => item.dispatch?.id === selected?.dispatch_id)
      || incidentBackend.tasks.find((item) => item.id === selectedStationTaskId)
      || incidentBackend.tasks[0];
    const nextAction = document.querySelector("[data-next-action]")?.dataset.nextAction;
    if (!task?.dispatch || !nextAction) return;
    return postIncidentAction(`/dispatches/${task.dispatch.id}/transition`, { action: nextAction, note: "班组状态反馈（模拟）" }, "工单状态已实时回传值班台");
  }
  if (action === "submit-first-report") {
    const selected = (incidentBackend.inbox || []).find((item) => item.inbox_id === selectedInboxId);
    const task = incidentBackend.tasks.find((item) => item.dispatch?.id === selected?.dispatch_id)
      || incidentBackend.tasks.find((item) => item.id === selectedStationTaskId)
      || incidentBackend.tasks[0];
    const situation = document.querySelector("#report-situation")?.value.trim();
    const peopleStatus = document.querySelector("#report-people")?.value;
    if (!situation) return showToast("请填写现场情况");
    return postIncidentAction(`/dispatches/${task.dispatch.id}/report`, { situation, people_status: peopleStatus }, "现场反馈已回传值班台");
  }
  if (action === "bind-signal-copilot") {
    if (!selectedSignalEventId) return showToast("请先选择待核实信号");
    const signal = incidentBackend.signals.find((item) => item.monitoring_event_id === selectedSignalEventId);
    return bindHubSignal(selectedSignalEventId, signal?.enterprise_id, "B-confirmed-fire-battery-workorder");
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
  if (action === "use-demo-assessment") {
    const company = selectedCompany();
    latestAssessment = { ...latestAssessment, enterpriseId: company.id, enterpriseName: company.name, inputHash: `fg-demo-${company.id}` };
    renderRoute();
    return showToast("已载入固定演示评分，不会写入数据库");
  }
  if (action === "regenerate") {
    const editor = document.querySelector("#report-editor");
    if (editor) editor.value = reportText(selectedCompany(), selectedCompanyId === latestAssessment.enterpriseId ? latestAssessment : null);
    return showToast("已根据结构化事实重新生成报告");
  }
  if (action === "confirm-report") return showToast("报告已确认（仅限演示）");
  if (action === "ranking-help") return showToast("风险线索用于安排巡查优先级，不替代现场检查结论");
  if (action === "verify-signal") {
    location.hash = "#/incidents";
    return;
  }
  if (action === "inject-demo-event") return postDemoModbusFrame();
  if (action === "inject-demo-fault") return postDemoModbusFrame(demoFaultFrame, { jumpToVerify: false });
  if (action === "company-overview") {
    location.hash = `#/enterprises/${selectedCompanyId}`;
    return;
  }
  if (action === "company-detail") {
    location.hash = `#/enterprises/${selectedCompanyId}`;
    return;
  }
  if (action === "route-history") return showToast("当前演示保留 2026-07-29 路线，历史记录未导入");
  if (action === "equipment-detail") return showToast("设备状态来自当前车间台账；完整点位编号请在车间档案查看");
  if (action === "all-equipment") {
    activeRightTab = "equipment";
    location.hash = routeHash("inspections", { enterprise_id: selectedCompanyId });
    renderRoute();
    return;
  }
  if (action === "hazards") { activeRightTab = "hazards"; location.hash = "#/inspections"; renderRoute(); return; }
  if (action === "equipment") { activeRightTab = "equipment"; location.hash = "#/inspections"; renderRoute(); return; }
  if (action === "inspection") { activeRightTab = "hazards"; location.hash = "#/inspections"; renderRoute(); return; }
  if (action === "import-data") {
    document.querySelector("#import-dialog").showModal();
    return;
  }
  if (action === "open-inspect-capture") {
    openInspectCapture();
    return;
  }
  if (action === "scan-maintenance") {
    scanMaintenanceOverdue();
    return;
  }
  console.error(`Unhandled UI action: ${action}`);
}

function bindHeaderActions() {
  document.querySelectorAll(".app-header [data-action]").forEach((button) => button.addEventListener("click", () => handleAction(button.dataset.action)));
  const actor = document.querySelector("#demo-actor");
  if (!actor) return;
  actor.value = demoActorId;
  actor.addEventListener("change", () => {
    setDemoActor(actor.value);
    showToast(`已切换演示身份：${actor.options[actor.selectedIndex].text}`);
  });
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
  if (event.detail.id === "ent-001") {
    selectedCompanyId = "ent-001";
    monitoringState.spatialLevel = "workshop";
    monitoringState.selectedId = monitoringState.events.find((item) => item.enterpriseId === "ent-001")?.id || monitoringState.selectedId;
    renderRoute();
  } else {
    showToast("本阶段先开放电池车间，其他工艺车间将在下一阶段补齐");
  }
});

function buildOfflineCopilotRun(stage = "verification") {
  const evidence = [
    { ref: "monitoring_events/OFFLINE-001", kind: "signal", note: "合成 Modbus 报警帧" },
    { ref: "pt-02-01-005", kind: "point", note: "电池车间 PACK 缓存区烟感" },
    { ref: "demo/manual/fire-alarm-01", kind: "knowledge", note: "火警核实与先期处置流程" },
    { ref: "crew-wx-01", kind: "crew", note: "微型消防站·西区站（虚拟）" },
  ];
  const trace = [
    { name: "get_signal_context", ok: true, data: { verification_status: stage === "verification" ? "pending" : "confirmed" }, evidence_refs: [evidence[0].ref, evidence[1].ref] },
    { name: "get_site_packet", ok: true, data: {}, evidence_refs: ["ent-001"] },
    { name: "get_maintenance_context", ok: true, data: {}, evidence_refs: ["demo/maintenance/pack-01"] },
    { name: "find_missing_fields", ok: true, data: { missing_fields: ["未撤出人员最后位置"] }, evidence_refs: [] },
  ];
  if (stage === "verification") {
    trace.push({ name: "create_verification_draft", ok: true, data: { note: "两点报警并有人工见明火报告，建议立即现场核实。", status: "awaiting_human_verification" }, evidence_refs: [evidence[0].ref] });
  } else {
    trace.push(
      { name: "recommend_crew", ok: true, data: { recommended: [{ id: "crew-wx-01" }] }, evidence_refs: ["crew-wx-01"] },
      { name: "create_workorder_draft", ok: true, data: { crew_id: "crew-wx-01", summary: "确认火警先期处置：核查人员撤离、控制火势并回传首报" }, evidence_refs: [evidence[0].ref, "crew-wx-01"] },
      ...["duty_officer", "responder", "area_owner"].map((role) => ({
        name: "build_role_brief", ok: true, data: { role, incident: { response_brief: { address: "电池车间 PACK 半成品缓存区", items: [{ text: "按岗位核对事件、人员与处置状态" }], disclaimer: "合成演示，不控制真实设备" } } }, evidence_refs: ["OFFLINE-INC-001"],
      })),
    );
  }
  return {
    run_id: "OFFLINE-001", mode: "scenario", model_name: "deterministic-template",
    fallback_reason: "公开静态演示：未连接后端", incident_id: stage === "dispatch" ? "OFFLINE-INC-001" : null,
    plan: {
      intent: "incident_response_support", abstained: false,
      plan: ["解析报警帧并定位点位", "汇总现场、设备与制度证据", "生成待人工确认的处置草稿"],
      missing_fields: ["未撤出人员最后位置"], risks: ["锂电池模组半成品存在复燃风险", "严禁 AI 自动启动灭火或对外报警"], evidence,
    },
    rejected_evidence: [], trace,
  };
}

function selectedCopilotScenario() {
  return copilotState.scenarios?.find((item) => item.scenario_id === copilotState.selectedId) || copilotState.scenarios?.[0] || null;
}

function copilotPhaseForRun(run) {
  if (run.plan.abstained) return "abstained";
  const verificationStatus = run.trace.find((entry) => entry.name === "get_signal_context" && entry.ok)?.data?.verification_status;
  const workorder = run.trace.find((entry) => entry.name === "create_workorder_draft");
  if (workorder) return workorder.ok ? "dispatch" : "blocked";
  if (verificationStatus === "confirmed" && run.incident_id) return "handoff";
  if (verificationStatus === "dismissed") return "closed";
  if (run.trace.some((entry) => entry.name === "create_verification_draft" && entry.ok)) return "verification";
  return "advisory";
}

async function loadCopilotScenarios() {
  if (copilotState.scenarios) return;
  try {
    const response = await fetch(`${MONITORING_API_BASE}/copilot/scenarios`);
    if (!response.ok) throw new Error("scenarios_unavailable");
    const payload = await response.json();
    copilotState.offline = false;
    copilotState.scenarios = payload.scenarios || [];
    copilotState.selectedId ||= copilotState.scenarios[0]?.scenario_id || null;
  } catch {
    copilotState.offline = true;
    copilotState.scenarios = [OFFLINE_JUDGE_SCENARIO];
    copilotState.selectedId = OFFLINE_JUDGE_SCENARIO.scenario_id;
  }
  if ((location.hash || "").startsWith("#/copilot")) renderRoute();
}

async function copilotPost(path, body) {
  const response = await fetch(`${MONITORING_API_BASE}${path}`, {
    method: "POST", headers: actorHeaders(), body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.detail || "copilot_action_failed");
  return payload;
}

function bindHubSignal(eventId, enterpriseId, preferredScenarioId) {
  if (!eventId) return showToast("缺少可绑定的中枢信号");
  copilotState.bindSource = "hub";
  copilotState.hubEventId = Number(eventId);
  copilotState.hubEnterpriseId = enterpriseId || null;
  if (preferredScenarioId) copilotState.selectedId = preferredScenarioId;
  copilotState.phase = "select";
  copilotState.run = null;
  location.hash = "#/copilot";
  loadCopilotScenarios().then(() => renderRoute());
  showToast(`已绑定中枢信号 #${eventId}，可直接运行 Copilot`);
}

async function runCopilotScenario() {
  const scenario = selectedCopilotScenario();
  if (!scenario || copilotState.busy) return;
  setDemoActor("duty-demo");
  if (copilotState.offline) {
    copilotState.busy = true;
    renderRoute();
    await new Promise((resolve) => setTimeout(resolve, 300));
    copilotState.eventId = "OFFLINE-001";
    copilotState.run = buildOfflineCopilotRun("verification");
    copilotState.verification = null;
    copilotState.dispatch = null;
    copilotState.phase = "verification";
    copilotState.busy = false;
    renderRoute();
    return;
  }
  copilotState.busy = true;
  renderRoute();
  try {
    let eventId = copilotState.hubEventId;
    let enterpriseId = copilotState.hubEnterpriseId || scenario.enterprise_id;
    if (copilotState.bindSource !== "hub" || !eventId) {
      const event = await copilotPost("/monitoring/events", {
        enterprise_id: scenario.enterprise_id,
        event_type: scenario.input.signal.event_type,
        severity: scenario.input.signal.severity,
        source: "copilot_demo",
        payload: scenario.input.signal.payload,
      });
      eventId = event.id;
      enterpriseId = scenario.enterprise_id;
      copilotState.bindSource = "scenario";
    }
    const run = await copilotPost("/copilot/runs", {
      enterprise_id: enterpriseId,
      event_id: eventId,
      reporter_text: scenario.input.reporter_text,
      image_assets: (scenario.input.images || []).map((image) => image.asset),
      scenario_id: scenario.scenario_id,
      mode: copilotState.mode,
    });
    copilotState.eventId = eventId;
    copilotState.run = run;
    copilotState.verification = null;
    copilotState.dispatch = null;
    copilotState.verificationActor = null;
    copilotState.dispatchActor = null;
    copilotState.phase = copilotPhaseForRun(run);
  } catch (error) {
    showToast(`Copilot 运行失败：${error.message}`);
    copilotState.phase = "select";
  } finally {
    copilotState.busy = false;
    renderRoute();
  }
}

async function startJudgeDemo() {
  if (copilotState.busy) return;
  const scenario = copilotState.scenarios?.find((item) => item.scenario_id === "B-confirmed-fire-battery-workorder");
  if (!scenario) return showToast("评委演示场景尚未加载");
  const station = copilotState.offline ? null : incidentBackend.stations.find((item) => item.id === "crew-wx-01");
  if (station && station.status !== "available") return showToast("西区班组正在执行其他任务，请先到流程监管完成该任务");
  resetCopilot();
  copilotState.judgeMode = true;
  copilotState.selectedId = scenario.scenario_id;
  copilotState.mode = "scenario";
  copilotState.bindSource = "scenario";
  copilotState.judgeProgress = ["Agent 正在解析报警并补齐证据"];
  await runCopilotScenario();
}

async function confirmCopilotVerification(result) {
  const scenario = selectedCopilotScenario();
  if (!scenario || !copilotState.run || copilotState.busy) return;
  if (copilotState.offline) {
    copilotState.verification = result;
    copilotState.verificationActor = demoActorId;
    copilotState.run = result === "confirmed" ? buildOfflineCopilotRun("dispatch") : copilotState.run;
    copilotState.phase = result === "confirmed" ? "dispatch" : "closed";
    renderRoute();
    return;
  }
  copilotState.busy = true;
  try {
    await copilotPost(`/signals/${copilotState.eventId}/verification`, { result, note: "Copilot 演示中的人工确认" });
    await copilotPost(`/copilot/runs/${copilotState.run.run_id}/approve`, { action: "verification_result" });
    copilotState.verification = result;
    copilotState.verificationActor = demoActorId;
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
      copilotState.phase = copilotPhaseForRun(run);
    } else {
      copilotState.phase = "closed";
    }
  } catch (error) {
    if (error.message === "verification_conflict") {
      try {
        const run = await copilotPost("/copilot/runs", {
          enterprise_id: scenario.enterprise_id, event_id: copilotState.eventId,
          reporter_text: scenario.input.reporter_text,
          image_assets: (scenario.input.images || []).map((image) => image.asset),
          scenario_id: scenario.scenario_id, mode: copilotState.mode,
        });
        copilotState.run = run;
        copilotState.phase = copilotPhaseForRun(run);
        showToast("该信号已核实，已恢复到数据库中的当前步骤");
      } catch (refreshError) {
        showToast(`状态恢复失败：${refreshError.message}`);
      }
    } else {
      showToast(`核实登记失败：${incidentErrorMessage(error.message)}`);
    }
  } finally {
    copilotState.busy = false;
    renderRoute();
  }
}

async function confirmCopilotDispatch() {
  const run = copilotState.run;
  const draft = run?.trace.find((entry) => entry.name === "create_workorder_draft" && entry.ok);
  if (!draft || copilotState.busy) return;
  if (copilotState.offline) {
    copilotState.dispatch = draft.data.crew_id;
    copilotState.dispatchActor = demoActorId;
    copilotState.phase = copilotState.judgeMode ? "crew_simulation" : "done";
    renderRoute();
    if (copilotState.judgeMode) await runJudgeCrewSimulation();
    return;
  }
  copilotState.busy = true;
  let autoSimulate = false;
  try {
    // 火警处置单走 incident_dispatches；维修/故障工单写入 ops_workorders 中枢。
    if (run.incident_id) {
      await copilotPost(`/incidents/${run.incident_id}/dispatch`, { station_id: draft.data.crew_id });
    } else {
      const existing = await fetch(`${MONITORING_API_BASE}/workorders?status=draft`).then((r) => r.json()).catch(() => ({ items: [] }));
      const matched = (existing.items || []).find((item) => item.event_id === (draft.data.event_id || copilotState.eventId) && item.kind === "repair");
      if (matched) {
        await copilotPost(`/workorders/${matched.id}/approve`, { note: "Copilot 故障诊断工单人工确认" });
        selectedInboxId = `workorder-${matched.id}`;
      } else {
        const created = await copilotPost("/workorders", {
          enterprise_id: selectedCopilotScenario()?.enterprise_id || "ent-001",
          kind: "repair",
          summary: draft.data.summary || "Copilot 维修工单",
          crew_id: draft.data.crew_id || "crew-wb-01",
          event_id: draft.data.event_id || copilotState.eventId,
          status: "approved",
          evidence_refs: [`monitoring_events/${draft.data.event_id || copilotState.eventId}`],
        });
        selectedInboxId = `workorder-${created.workorder.id}`;
      }
    }
    await copilotPost(`/copilot/runs/${copilotState.run.run_id}/approve`, { action: "workorder_dispatch" });
    copilotState.dispatch = draft.data.crew_id;
    copilotState.dispatchActor = demoActorId;
    copilotState.phase = "done";
    terminalStationId = draft.data.crew_id || (run.incident_id ? "crew-wx-01" : "crew-wb-01");
    autoSimulate = copilotState.judgeMode && Boolean(run.incident_id);
    showToast("工单已派发，下一步由班组签收");
    scheduleIncidentRefresh();
  } catch (error) {
    showToast(`工单派发失败：${incidentErrorMessage(error.message)}`);
  } finally {
    copilotState.busy = false;
    renderRoute();
  }
  if (autoSimulate) await runJudgeCrewSimulation();
}

async function runJudgeCrewSimulation() {
  if (copilotState.offline) {
    copilotState.phase = "crew_simulation";
    copilotState.busy = true;
    copilotState.judgeProgress = [];
    setDemoActor("crew-demo");
    renderRoute();
    for (const label of ["班组已签收", "班组已出动", "班组已到场", "现场反馈已回传"]) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      copilotState.judgeProgress.push(label);
      renderRoute();
    }
    setDemoActor("duty-demo");
    copilotState.phase = "archive";
    copilotState.busy = false;
    renderRoute();
    return;
  }
  const incidentId = copilotState.run?.incident_id;
  if (!incidentId || copilotState.busy) return;
  copilotState.phase = "crew_simulation";
  copilotState.busy = true;
  copilotState.judgeProgress = [];
  setDemoActor("crew-demo");
  renderRoute();
  try {
    await refreshIncidentBackend();
    const incident = incidentBackend.incidents.find((item) => item.id === incidentId);
    const dispatchId = incident?.dispatch?.id;
    if (!dispatchId) throw new Error("dispatch_not_ready");
    for (const [action, label] of [["acknowledge", "班组已签收"], ["depart", "班组已出动"], ["arrive", "班组已到场"]]) {
      await copilotPost(`/dispatches/${dispatchId}/transition`, { action, note: `评委引导演示：${label}（模拟）` });
      copilotState.judgeProgress.push(label);
      renderRoute();
      await new Promise((resolve) => setTimeout(resolve, 450));
    }
    await copilotPost(`/dispatches/${dispatchId}/report`, {
      situation: "评委演示：现场明火已扑灭，人员全部撤离（合成）",
      people_status: "no_risk",
    });
    copilotState.judgeProgress.push("现场反馈已回传");
    await refreshIncidentBackend();
    setDemoActor("duty-demo");
    selectedIncidentId = incidentId;
    location.hash = `#/incidents?incident_id=${incidentId}`;
    showToast("班组模拟处置完成，请值班员核验归档");
  } catch (error) {
    copilotState.phase = "done";
    showToast(`自动演示中断：${incidentErrorMessage(error.message)}`);
  } finally {
    copilotState.busy = false;
    if ((location.hash || "").startsWith("#/copilot")) renderRoute();
  }
}

function archiveOfflineJudgeDemo() {
  copilotState.phase = "archived";
  copilotState.judgeProgress.push("值班员已核验归档");
  renderRoute();
  showToast("离线评委演示已完成，事件证据链可导出");
}

function resetCopilot() {
  setDemoActor("duty-demo");
  copilotState.phase = "select";
  copilotState.run = null;
  copilotState.eventId = null;
  copilotState.verification = null;
  copilotState.dispatch = null;
  copilotState.verificationActor = null;
  copilotState.dispatchActor = null;
  copilotState.judgeMode = false;
  copilotState.judgeProgress = [];
  renderRoute();
}

function exportCopilotAuditPack() {
  const scenario = selectedCopilotScenario();
  const run = copilotState.run;
  if (!scenario || !run) return;
  const pack = {
    schema_version: "fireops-audit-pack/v1",
    exported_at: new Date().toISOString(),
    simulation: true,
    boundaries: ["不控制真实设备", "不自动启动灭火装置", "AI不替代现场处置决策", "对外报警(119)由人工执行"],
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
      copilotState.verification && {
        action: "verification_result", value: copilotState.verification, actor_id: copilotState.verificationActor,
      },
      copilotState.dispatch && {
        action: "workorder_dispatch", value: copilotState.dispatch, actor_id: copilotState.dispatchActor,
      },
    ].filter(Boolean),
    role_briefs: run.trace.filter((entry) => entry.name === "build_role_brief" && entry.ok).map((entry) => entry.data),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `fireops-audit-run-${run.run_id}.json` });
  link.click();
  URL.revokeObjectURL(url);
  showToast("原始 JSON 已下载");
}

function openCopilotRunRecord() {
  const run = copilotState.run;
  const scenario = selectedCopilotScenario();
  if (!run || !scenario) return;
  const toolLabels = {
    get_signal_context: "读取报警与核实状态", get_site_packet: "读取车间与首战资料",
    get_maintenance_context: "核对设备维保记录", find_missing_fields: "检查缺失信息",
    create_verification_draft: "生成待人工核实草稿", recommend_crew: "匹配可用处置班组",
    create_workorder_draft: "生成待人工批准工单", build_role_brief: "生成岗位任务卡",
  };
  document.querySelector("#run-record-content").innerHTML = `
    <section data-copilot-run-section="input"><h3>输入</h3><p>${escapeHtml(scenario.input.reporter_text)}</p><small>事件 ${escapeHtml(copilotState.eventId || run.run_id)} · 固定合成数据</small></section>
    <section data-copilot-run-section="evidence"><h3>证据</h3><ul>${run.plan.evidence.map((item) => `<li><strong>${escapeHtml(item.note || item.kind)}</strong><span>${escapeHtml(item.ref)}</span></li>`).join("")}</ul></section>
    <section data-copilot-run-section="tools"><h3>工具调用</h3><ol>${run.trace.map((item) => `<li><strong>${escapeHtml(toolLabels[item.name] || item.name)}</strong><span>${item.ok ? "完成" : "未完成"}</span></li>`).join("")}</ol></section>
    <section data-copilot-run-section="human"><h3>人工确认</h3><ul><li>火警核实：${copilotState.verification ? (copilotState.verification === "confirmed" ? "已确认" : "已排除") : "等待值班员确认"}</li><li>工单派发：${copilotState.dispatch ? "已由授权人员批准" : "等待授权人员批准"}</li></ul></section>
    <section data-copilot-run-section="result"><h3>结果</h3><p>${copilotState.phase === "archived" ? "事件已完成人工核验并归档。" : copilotState.phase === "dispatch" ? "处置草稿已生成，等待人工派单。" : "核实草稿已生成，等待人工确认。"}</p><small>AI 只整理证据和生成草稿，不控制真实设备，不替代现场决策。</small></section>`;
  document.querySelector("#run-record-dialog").showModal();
  refreshIcons();
}

function copilotTemplate() {
  const scenario = selectedCopilotScenario();
  return `
    <section class="copilot-page" aria-labelledby="copilot-title">
      <header class="copilot-header">
        <div>
          <span>FIREOPS / FACTORY COPILOT</span>
          <h1 id="copilot-title">工厂消防设备运维 Copilot</h1>
          <p>Agent 解析 Modbus 报警帧、补全证据、检索手册并生成草稿；核实与工单派发由授权人员确认。</p>
        </div>
        <div class="copilot-badges">
          <span class="copilot-badge"><i data-lucide="flask-conical"></i>合成数据</span>
          <span class="copilot-badge"><i data-lucide="plug-zap"></i>不控制真实设备</span>
          <span class="copilot-badge"><i data-lucide="shield-check"></i>AI 不替代现场处置决策</span>
        </div>
      </header>
      ${copilotState.offline ? `
        <div class="copilot-offline-banner" role="status">
          <span><i data-lucide="wifi-off"></i>离线评委演示</span>
          <strong>无需启动后端，点击下方按钮即可走完三个人工闸门。</strong>
          <small>数据和工具轨迹均为固定合成回放；连接真实后端后会自动切回数据库流程。</small>
        </div>
      ` : `<a class="copilot-workflow-jump" href="#/workflow"><span><i data-lucide="route"></i>流程监管</span><strong>${incidentBackend.incidents.filter((incident) => incident.status !== "closed").length} 个进行中事件</strong><small>查看当前步骤、责任角色和下一动作</small><i data-lucide="arrow-right"></i></a>`}
      ${copilotState.scenarios === null ? `<div class="copilot-empty">正在加载演示场景…</div>` : ""}
      ${scenario ? copilotSelectTemplate(scenario) : ""}
      ${copilotState.run ? copilotRunTemplate() : ""}
    </section>
  `;
}

function copilotSelectTemplate(scenario) {
  const pendingSignals = (incidentBackend.signals || []).filter((item) => item.verification_status === "pending");
  const repairDrafts = incidentBackend.repairDrafts || [];
  if (copilotState.phase !== "select") {
    return `
      <div class="copilot-context">
        <strong>${escapeHtml(scenario.title)}</strong>
        <span>${copilotState.bindSource === "hub" ? "中枢信号绑定" : copilotState.mode === "live" ? "Live 模型模式" : "场景回放模式"} · 信号事件 #${copilotState.eventId}</span>
        <button type="button" class="secondary-action" data-copilot-action="reset"><i data-lucide="rotate-ccw"></i>重新开始</button>
      </div>
    `;
  }
  return `
    <section class="judge-demo-entry" aria-labelledby="judge-demo-title">
      <div><span>JUDGE DEMO / 90 SEC</span><h2 id="judge-demo-title">一条主线看懂 FireOps AI</h2><p>自动运行报警解析、工具调用和班组模拟；仅在火警核实、派单批准、最终归档时由人确认。</p></div>
      <ol><li>AI 研判</li><li>人工核实</li><li>人工派单</li><li>模拟处置</li><li>人工归档</li></ol>
      <button type="button" class="primary-action" data-copilot-action="judge-run"><i data-lucide="play"></i>开始评委演示</button>
    </section>
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
        <div class="copilot-mode" role="group" aria-label="信号来源">
          <button type="button" class="${copilotState.bindSource !== "hub" ? "active" : ""}" data-copilot-bind="scenario">独立场景<small>新建演示信号</small></button>
          <button type="button" class="${copilotState.bindSource === "hub" ? "active" : ""}" data-copilot-bind="hub" ${copilotState.offline ? "disabled" : ""}>中枢信号<small>${copilotState.offline ? "需连接后端" : "接监测/核实台"}</small></button>
        </div>
        <div class="copilot-mode" role="group" aria-label="运行模式">
          <button type="button" class="${copilotState.mode === "scenario" ? "active" : ""}" data-copilot-mode="scenario">场景回放<small>离线可复现</small></button>
          <button type="button" class="${copilotState.mode === "live" ? "active" : ""}" data-copilot-mode="live" ${copilotState.offline ? "disabled" : ""}>Live 模型<small>${copilotState.offline ? "需连接后端" : "失败自动回退"}</small></button>
        </div>
        ${copilotState.bindSource === "hub" ? `
          <div class="copilot-report">
            <h2>绑定中枢待处理信号</h2>
            ${pendingSignals.length ? pendingSignals.map((item) => `
              <button type="button" class="copilot-hub-signal ${copilotState.hubEventId === item.monitoring_event_id ? "selected" : ""}" data-hub-signal="${item.monitoring_event_id}" data-hub-enterprise="${item.enterprise_id}">
                火警待核实 #${item.monitoring_event_id} · ${escapeHtml(item.enterprise_name)}
              </button>
            `).join("") : `<p>暂无待核实火警。可先到态势监测注入火警帧。</p>`}
            ${repairDrafts.length ? repairDrafts.map((item) => `
              <button type="button" class="copilot-hub-signal ${copilotState.hubEventId === item.event_id ? "selected" : ""}" data-hub-signal="${item.event_id || ""}" data-hub-enterprise="${item.enterprise_id}">
                故障草稿 #${item.workorder_id} · ${escapeHtml(item.enterprise_name)}
              </button>
            `).join("") : ""}
            ${copilotState.hubEventId ? `<p>已绑定事件 <strong>#${copilotState.hubEventId}</strong>，运行时不再新建信号。</p>` : `<p>请选择一条中枢信号后再运行。</p>`}
          </div>
        ` : `
          <div class="copilot-report">
            <h2>上报内容</h2>
            <p>${escapeHtml(scenario.input.reporter_text)}</p>
            ${(scenario.input.images || []).map((image) => `
              <figure><img src="${escapeHtml(image.asset)}" alt="${escapeHtml(image.note)}" /><figcaption>${escapeHtml(image.note)}</figcaption></figure>
            `).join("")}
          </div>
        `}
        <button type="button" class="primary-action copilot-run-button" data-copilot-action="run" ${copilotState.busy || (copilotState.bindSource === "hub" && !copilotState.hubEventId) ? "disabled" : ""}>
          <i data-lucide="play"></i>${copilotState.busy ? "正在运行…" : copilotState.bindSource === "hub" ? "对中枢信号运行 Copilot" : "运行 Copilot"}
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
        ${copilotState.offline ? `<span class="copilot-badge copilot-offline-badge"><i data-lucide="wifi-off"></i>离线合成回放</span>` : ""}
        <span class="copilot-badge">${run.mode === "live" ? "Live 模式" : "场景回放"}</span>
        <span class="copilot-badge">模型：${escapeHtml(run.model_name)}</span>
        ${run.fallback_reason ? `<span class="copilot-badge copilot-badge-warn">模型不可用，已回退模板（${escapeHtml(run.fallback_reason)}）</span>` : ""}
        <span class="copilot-badge">运行 #${run.run_id} · 模拟</span>
        <button type="button" class="primary-action copilot-record-action" data-copilot-action="view-record"><i data-lucide="list-tree"></i>查看运行记录</button>
        <button type="button" class="secondary-action copilot-audit-action" data-copilot-action="export-audit"><i data-lucide="download"></i>下载原始 JSON</button>
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
          ${plan.evidence.length ? `<ul class="copilot-evidence">${plan.evidence.map((ref) => `<li><i data-lucide="link"></i><span><code>${escapeHtml(ref.ref)}</code><small>${escapeHtml(ref.kind)}${ref.note ? ` · ${escapeHtml(ref.note)}` : ""}</small></span></li>`).join("")}</ul>` : `<p class="copilot-empty">本次运行没有可引用的证据。</p>`}
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
  const labels = { duty_officer: "消控室值班简报", responder: "处置班组任务卡", area_owner: "网格责任人待办" };
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
  if (copilotState.phase === "archive") {
    return `
      <section class="copilot-panel copilot-approval">
        <div class="judge-gate"><b>人工闸门 3/3</b><span>班组已回传现场结果，最终归档仍由消控室值班员确认。</span></div>
        <h2><i data-lucide="archive"></i>人工确认 · 核验反馈并归档</h2>
        <p>现场反馈：明火已扑灭，人员已全部撤离；事件、工单、班组反馈和时间戳已汇总。</p>
        <small>离线演示只记录在当前浏览器，不写入真实数据库。</small>
        <div class="copilot-actions"><button type="button" class="primary-action" data-copilot-action="offline-archive"><i data-lucide="check-check"></i>核验反馈并归档</button></div>
      </section>`;
  }
  if (copilotState.phase === "archived") {
    return `
      <section class="copilot-panel copilot-done offline-demo-complete">
        <span>DEMO COMPLETE</span><h2><i data-lucide="badge-check"></i>离线评委演示已闭环</h2>
        <p>同一事件已完成：AI 研判 → 人工核实 → 人工派单 → 班组反馈 → 人工归档。</p>
        <ol>${copilotState.judgeProgress.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
        <div class="copilot-actions"><button type="button" class="primary-action" data-copilot-action="view-record"><i data-lucide="list-tree"></i>查看运行记录</button><button type="button" class="secondary-action" data-copilot-action="export-audit"><i data-lucide="download"></i>下载原始 JSON</button><button type="button" class="secondary-action" data-copilot-action="reset"><i data-lucide="rotate-ccw"></i>重新演示</button></div>
      </section>`;
  }
  if (copilotState.phase === "abstained") {
    return `
      <section class="copilot-panel copilot-abstain">
        <h2><i data-lucide="pause-circle"></i>安全拒答</h2>
        <p>证据不足，Agent 不生成处置建议、不起草工单。缺失字段全部标注为未知，需人工补充信息后重新上报。</p>
      </section>
    `;
  }
  if (copilotState.phase === "blocked") {
    const failure = run.trace.find((entry) => entry.name === "create_workorder_draft" && !entry.ok);
    return `
      <section class="copilot-panel copilot-blocked">
        <h2><i data-lucide="circle-alert"></i>派单暂时受阻</h2>
        <p>${failure?.error === "crew_unavailable" ? "对应片区的处置班组正在执行其他任务，系统没有生成一张无法履行的工单。" : `工单草稿未通过校验：${escapeHtml(failure?.error || "未知原因")}`}</p>
        <small>先到流程监管完成占用班组的签收、到场、反馈与归档，班组释放后再派发本事件。</small>
        <div class="copilot-actions"><a class="primary-action" href="#/workflow"><i data-lucide="route"></i>查看流程监管</a><a class="secondary-action" href="#/incidents"><i data-lucide="radio-tower"></i>返回值班台</a></div>
      </section>`;
  }
  if (copilotState.phase === "advisory") {
    return `<section class="copilot-panel copilot-done"><h2><i data-lucide="badge-info"></i>咨询卡已生成</h2><p>本场景只提供证据与人工操作指引，不生成工单，也不控制现场设备。</p><div class="copilot-actions"><a class="secondary-action" href="#/workflow"><i data-lucide="route"></i>查看其他事件流程</a></div></section>`;
  }
  if (copilotState.phase === "handoff") {
    const incident = incidentBackend.incidents.find((item) => item.id === run.incident_id);
    const state = incident ? incidentWorkflowState(incident) : { actor: "duty-demo", action: "进入流程监管", route: "#/workflow" };
    return `<section class="copilot-panel copilot-done"><h2><i data-lucide="check-circle-2"></i>该信号已经完成核实</h2><p>处置事件 #${run.incident_id} 已建立。${state.actor === "crew-demo" ? "本片区班组正在执行其他事件，请先完成该任务并释放班组。" : "下一步由值班员选择可用班组并派单。"}</p><div class="copilot-actions"><button type="button" class="primary-action" data-workflow-continue data-actor="${state.actor}" data-incident-id="${run.incident_id}" data-crew-id="${state.crewId || ""}" data-route="${state.route}"><i data-lucide="send"></i>${state.action}</button><a class="secondary-action" href="#/workflow"><i data-lucide="route"></i>查看流程监管</a></div></section>`;
  }
  const verificationDraft = run.trace.find((entry) => entry.name === "create_verification_draft" && entry.ok);
  if (copilotState.phase === "verification" && verificationDraft) {
    return `
      <section class="copilot-panel copilot-approval">
        ${copilotState.judgeMode ? `<div class="judge-gate"><b>人工闸门 1/3</b><span>Agent 只生成核实草稿，火警结论由值班员确认。</span></div>` : ""}
        <h2><i data-lucide="stamp"></i>人工确认 · 报警核实</h2>
        <p>${escapeHtml(verificationDraft.data.note || "")}</p>
        <small>草稿状态：${escapeHtml(verificationDraft.data.status || "")}。Agent 只生成草稿，核实结果由消控室值班员登记。</small>
        <div class="copilot-actions">
          <button type="button" class="primary-action" data-copilot-verify="confirmed" ${copilotState.busy ? "disabled" : ""}><i data-lucide="check"></i>确认火警，建立处置事件</button>
          <button type="button" class="secondary-action" data-copilot-verify="dismissed" ${copilotState.busy ? "disabled" : ""}><i data-lucide="x"></i>确认误报，不建事件</button>
        </div>
      </section>
    `;
  }
  if (copilotState.phase === "dispatch") {
    const draft = run.trace.find((entry) => entry.name === "create_workorder_draft" && entry.ok);
    const recommend = run.trace.find((entry) => entry.name === "recommend_crew" && entry.ok);
    const briefs = run.trace.filter((entry) => entry.name === "build_role_brief" && entry.ok);
    const isRepairOrder = !run.incident_id;
    return `
      <section class="copilot-panel copilot-approval">
        ${copilotState.judgeMode ? `<div class="judge-gate"><b>人工闸门 2/3</b><span>确认后自动演示班组签收、出动、到场和反馈。</span></div>` : ""}
        <h2><i data-lucide="stamp"></i>人工确认 · ${isRepairOrder ? "维修工单派发" : "处置单派发"}</h2>
        <p>建议班组：<strong>${escapeHtml(draft?.data.crew_id || "未知")}</strong>${recommend ? `（当班可用：${recommend.data.recommended.map((crew) => escapeHtml(crew.id)).join("、")}）` : ""}</p>
        ${draft?.data.summary ? `<p class="copilot-workorder-summary">${escapeHtml(draft.data.summary)}</p>` : ""}
        <small>草稿不会自动生效。${isRepairOrder ? "维修工单经人工确认后派发，故障超过 24 小时未消除须上报消防安全责任人。" : "派发后写入事件时间线，班组工单终端实时接收。"}</small>
        <div class="copilot-actions">
          <button type="button" class="primary-action" data-copilot-action="dispatch" ${copilotState.busy ? "disabled" : ""}><i data-lucide="send"></i>派发工单（人工确认）</button>
        </div>
      </section>
      ${copilotBriefsTemplate(briefs)}
    `;
  }
  if (copilotState.phase === "crew_simulation") {
    const steps = ["班组已签收", "班组已出动", "班组已到场", "现场反馈已回传"];
    return `<section class="copilot-panel judge-simulation"><span>CREW SIMULATION</span><h2>正在模拟班组处置</h2><p>以下动作均为合成演示，不控制真实设备。</p><ol>${steps.map((step) => `<li class="${copilotState.judgeProgress.includes(step) ? "done" : "pending"}">${step}</li>`).join("")}</ol></section>`;
  }
  if (copilotState.phase === "done") {
    return `
      <section class="copilot-panel copilot-done">
        <h2><i data-lucide="check-circle-2"></i>工单已派发：${escapeHtml(copilotState.dispatch || "")}</h2>
        <p>值班员的工作到这里结束。下一步由处置/维保班组签收，状态会继续回传到流程监管。</p>
        <div class="copilot-actions">
          <button type="button" class="primary-action" data-workflow-continue data-actor="crew-demo" data-incident-id="${run.incident_id || ""}" data-crew-id="${escapeHtml(copilotState.dispatch || "")}" data-route="#/station?crew_id=${encodeURIComponent(copilotState.dispatch || "")}"><i data-lucide="siren"></i>交接给班组并继续</button>
          <a class="secondary-action" href="#/workflow"><i data-lucide="route"></i>查看完整流程</a>
        </div>
      </section>
    `;
  }
  if (copilotState.phase === "closed") {
    return `
      <section class="copilot-panel copilot-done">
        <h2><i data-lucide="check-circle-2"></i>已登记为误报</h2>
        <p>信号未转为处置事件，核实结果与操作时间已留痕；可按说明书误报处理流程安排探测器清洁保养。</p>
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
