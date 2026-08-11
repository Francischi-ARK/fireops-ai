"""Server-side tool layer for the FireOps Copilot（工厂消防设备运维 Agent）.

Tools are read-only or produce drafts. Domain state changes stay behind the
existing verification/dispatch APIs; the single exception is
append_incident_activity, which only runs after a recorded human approval.
"""

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Set

from pydantic import BaseModel, Field, ValidationError

from .copilot_schema import AgentPlan, EvidenceRef, ToolCall

# 现场核实一次报警前应补齐的要素（对应企业应急处置卡的首问项）。
INCIDENT_REQUIRED_FIELDS = ["具体位置", "现场烟雾或火光", "人员情况", "工艺运行状态", "已采取措施"]


class SignalArgs(BaseModel):
    event_id: int


class EnterpriseArgs(BaseModel):
    enterprise_id: str = Field(min_length=1, max_length=80)


class MissingFieldsArgs(BaseModel):
    reporter_text: str = Field(default="", max_length=2000)
    known_fields: Dict[str, Any] = Field(default_factory=dict)


class VerificationDraftArgs(BaseModel):
    event_id: int
    note: str = Field(default="", max_length=300)


class SearchManualArgs(BaseModel):
    query: str = Field(min_length=1, max_length=200)
    limit: int = Field(default=3, ge=1, le=8)


class WorkorderDraftArgs(BaseModel):
    crew_id: str = Field(min_length=1, max_length=80)
    incident_id: Optional[int] = None
    event_id: Optional[int] = None
    summary: str = Field(default="", max_length=300)


class RoleBriefArgs(BaseModel):
    incident_id: int
    role: str = Field(min_length=1, max_length=20)


class AppendActivityArgs(BaseModel):
    incident_id: int
    event_type: str = Field(min_length=1, max_length=60)
    note: str = Field(default="", max_length=300)


@dataclass
class ToolResult:
    ok: bool
    data: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    evidence: List[EvidenceRef] = field(default_factory=list)


@dataclass
class RunContext:
    enterprise_id: str
    event_id: Optional[int] = None
    incident_id: Optional[int] = None
    event_type: str = ""
    verification_status: str = "pending"
    approvals: Set[str] = field(default_factory=set)
    collected_evidence: List[EvidenceRef] = field(default_factory=list)


def _fail(error: str) -> ToolResult:
    return ToolResult(ok=False, error=error)


async def _get_signal_context(provider, args: SignalArgs, ctx: RunContext) -> ToolResult:
    signal = await provider.get_signal(args.event_id)
    if not signal:
        return _fail("signal_not_found")
    evidence = []
    if signal.get("raw_ref"):
        evidence.append(EvidenceRef(ref=signal["raw_ref"], kind="signal"))
    payload = signal.get("payload") or {}
    # 报警信号若来自网关解析的 Modbus 帧，补充点位编码表档案作为证据。
    if all(key in payload for key in ("controller_no", "loop_no", "point_no")):
        point = await provider.get_device_point(
            payload["controller_no"], payload["loop_no"], payload["point_no"],
        )
        if point:
            signal = dict(signal)
            signal["device_point"] = point
            evidence.append(EvidenceRef(
                ref=point["point_id"], kind="point",
                note=f"机{point['controller_no']}回路{point['loop_no']}点位{point['point_no']} {point['location']}",
            ))
    return ToolResult(ok=True, data=signal, evidence=evidence)


async def _get_site_packet(provider, args: EnterpriseArgs, ctx: RunContext) -> ToolResult:
    enterprise = await provider.get_enterprise(args.enterprise_id)
    if not enterprise:
        return _fail("enterprise_not_found")
    profile = await provider.get_site_profile(args.enterprise_id) or {}
    return ToolResult(
        ok=True,
        data={"enterprise": enterprise, "profile": profile},
        evidence=[EvidenceRef(ref=enterprise["id"], kind="site", note="厂区单元与应急处置档案")],
    )


async def _get_maintenance_context(provider, args: EnterpriseArgs, ctx: RunContext) -> ToolResult:
    records = await provider.get_maintenance(args.enterprise_id)
    evidence = []
    for record in records:
        if record.get("maintenance_id"):
            evidence.append(EvidenceRef(ref=record["maintenance_id"], kind="maintenance"))
        if record.get("raw_ref"):
            evidence.append(EvidenceRef(ref=record["raw_ref"], kind="maintenance"))
    return ToolResult(ok=True, data={"records": records}, evidence=evidence)


async def _find_missing_fields(provider, args: MissingFieldsArgs, ctx: RunContext) -> ToolResult:
    known = {key for key, value in args.known_fields.items() if value not in (None, "", [])}
    missing = [field for field in INCIDENT_REQUIRED_FIELDS if field not in known]
    return ToolResult(ok=True, data={"missing_fields": missing, "required": INCIDENT_REQUIRED_FIELDS})


async def _create_verification_draft(provider, args: VerificationDraftArgs, ctx: RunContext) -> ToolResult:
    signal = await provider.get_signal(args.event_id)
    if not signal:
        return _fail("signal_not_found")
    return ToolResult(ok=True, data={
        "is_draft": True,
        "event_id": args.event_id,
        "note": args.note,
        "status": "awaiting_human_verification",
        "requires_approval": "verification_result",
    })


async def _search_manual(provider, args: SearchManualArgs, ctx: RunContext) -> ToolResult:
    """在说明书/规约/管理制度知识库中做确定性关键词检索。"""
    entries = await provider.search_knowledge(args.query, args.limit)
    evidence = [
        EvidenceRef(ref=entry["kb_id"], kind="knowledge",
                    note=f"{entry['source']} {entry['section']}")
        for entry in entries
    ]
    return ToolResult(ok=True, data={"query": args.query, "entries": entries}, evidence=evidence)


async def _recommend_crew(provider, args: EnterpriseArgs, ctx: RunContext) -> ToolResult:
    enterprise = await provider.get_enterprise(args.enterprise_id)
    if not enterprise:
        return _fail("enterprise_not_found")
    crews = await provider.list_crews()
    available = [c for c in crews if c.get("status") == "available"]
    in_district = [c for c in available if c.get("district") == enterprise.get("district")]
    recommended = in_district or available
    return ToolResult(
        ok=True,
        data={"recommended": recommended, "backup": [c for c in available if c not in recommended]},
        evidence=[EvidenceRef(ref=c["id"], kind="crew") for c in recommended],
    )


async def _create_workorder_draft(provider, args: WorkorderDraftArgs, ctx: RunContext) -> ToolResult:
    """处置/维修工单草稿：火警走事件链（incident_id），设施故障走信号链（event_id）。"""
    if args.incident_id is None and args.event_id is None:
        return _fail("invalid_arguments")
    if args.incident_id is not None:
        incident = await provider.get_incident(args.incident_id)
        if not incident:
            return _fail("incident_not_found")
    else:
        signal = await provider.get_signal(args.event_id)
        if not signal:
            return _fail("signal_not_found")
    return ToolResult(ok=True, data={
        "is_draft": True,
        "incident_id": args.incident_id,
        "event_id": args.event_id,
        "crew_id": args.crew_id,
        "summary": args.summary,
        "requires_approval": "workorder_dispatch",
    })


async def _build_role_brief(provider, args: RoleBriefArgs, ctx: RunContext) -> ToolResult:
    if args.role not in ("duty_officer", "responder", "area_owner"):
        return _fail("invalid_arguments")
    incident = await provider.get_incident(args.incident_id)
    if not incident:
        return _fail("incident_not_found")
    return ToolResult(
        ok=True,
        data={"role": args.role, "incident": incident, "is_draft": True,
              "disclaimer": "仅供辅助，不替代现场处置决策与企业安全规程"},
        evidence=[EvidenceRef(ref=f"incident/{args.incident_id}", kind="incident")],
    )


async def _append_incident_activity(provider, args: AppendActivityArgs, ctx: RunContext) -> ToolResult:
    record = await provider.append_incident_activity(
        args.incident_id, args.event_type, args.note, actor="copilot+human-approval",
    )
    return ToolResult(ok=True, data=record)


@dataclass
class ToolSpec:
    args_model: Any
    handler: Callable
    description: str
    requires_approval: bool = False
    state_check: Optional[Callable[[RunContext], bool]] = None


def _workorder_allowed(ctx: RunContext) -> bool:
    # 火警必须先经人工核实确认；设施故障类事件可直接起草维修工单。
    return ctx.verification_status == "confirmed" or ctx.event_type == "fault"


TOOLS: Dict[str, ToolSpec] = {
    "get_signal_context": ToolSpec(SignalArgs, _get_signal_context, "读取报警/故障信号、Modbus 解码与点位档案"),
    "get_site_packet": ToolSpec(EnterpriseArgs, _get_site_packet, "读取厂区单元、危险源、出入口、水源与消防设施档案"),
    "get_maintenance_context": ToolSpec(EnterpriseArgs, _get_maintenance_context, "读取维保计划与历史记录"),
    "find_missing_fields": ToolSpec(MissingFieldsArgs, _find_missing_fields, "对照现场核实要素列出信息缺口"),
    "create_verification_draft": ToolSpec(VerificationDraftArgs, _create_verification_draft, "生成待核实任务草稿"),
    "search_manual": ToolSpec(SearchManualArgs, _search_manual, "检索控制器说明书、通讯规约与管理制度知识库"),
    "recommend_crew": ToolSpec(EnterpriseArgs, _recommend_crew, "按片区与班组状态给出处置/维保班组建议"),
    "create_workorder_draft": ToolSpec(
        WorkorderDraftArgs, _create_workorder_draft, "生成处置/维修工单草稿（不执行派发）",
        state_check=_workorder_allowed,
    ),
    "build_role_brief": ToolSpec(RoleBriefArgs, _build_role_brief, "生成值班台/处置班组/网格责任人角色摘要"),
    "append_incident_activity": ToolSpec(
        AppendActivityArgs, _append_incident_activity, "人工确认后写入事件时间线",
        requires_approval=True,
    ),
}


class ToolGuard:
    """Validates every model-issued tool call before it touches anything."""

    def __init__(self, provider):
        self.provider = provider

    async def execute(self, call: ToolCall, ctx: RunContext) -> ToolResult:
        spec = TOOLS.get(call.name)
        if spec is None:
            return _fail("unknown_tool")
        try:
            args = spec.args_model.model_validate(call.arguments)
        except ValidationError:
            return _fail("invalid_arguments")
        if spec.state_check is not None and not spec.state_check(ctx):
            return _fail("state_not_allowed")
        if spec.requires_approval and getattr(args, "event_type", None) not in ctx.approvals:
            return _fail("approval_required")
        result = await spec.handler(self.provider, args, ctx)
        if result.ok:
            ctx.collected_evidence.extend(result.evidence)
        return result


def validate_evidence(plan: AgentPlan, collected: List[EvidenceRef]) -> List[str]:
    """Drop evidence the tools never produced. Returns the rejected refs."""
    valid = {ref.ref for ref in collected}
    rejected = [ref.ref for ref in plan.evidence if ref.ref not in valid]
    plan.evidence = [ref for ref in plan.evidence if ref.ref in valid]
    return rejected
