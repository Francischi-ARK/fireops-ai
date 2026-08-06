"""Server-side tool layer for the Incident Copilot.

Tools are read-only or produce drafts. Domain state changes stay behind the
existing verification/dispatch APIs; the single exception is
append_incident_activity, which only runs after a recorded human approval.
"""

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Set

from pydantic import BaseModel, Field, ValidationError

from .copilot_schema import AgentPlan, EvidenceRef, ToolCall

# Fields an incident report should cover before anyone recommends dispatch.
INCIDENT_REQUIRED_FIELDS = ["具体地点", "人员情况", "危险源", "发展趋势", "已采取措施"]


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


class DispatchDraftArgs(BaseModel):
    incident_id: int
    station_id: str = Field(min_length=1, max_length=80)


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
    return ToolResult(ok=True, data=signal, evidence=evidence)


async def _get_site_packet(provider, args: EnterpriseArgs, ctx: RunContext) -> ToolResult:
    enterprise = await provider.get_enterprise(args.enterprise_id)
    if not enterprise:
        return _fail("enterprise_not_found")
    profile = await provider.get_site_profile(args.enterprise_id) or {}
    return ToolResult(
        ok=True,
        data={"enterprise": enterprise, "profile": profile},
        evidence=[EvidenceRef(ref=enterprise["id"], kind="site", note="企业与场地档案")],
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


async def _recommend_station(provider, args: EnterpriseArgs, ctx: RunContext) -> ToolResult:
    enterprise = await provider.get_enterprise(args.enterprise_id)
    if not enterprise:
        return _fail("enterprise_not_found")
    stations = await provider.list_stations()
    available = [s for s in stations if s.get("status") == "available"]
    in_district = [s for s in available if s.get("district") == enterprise.get("district")]
    recommended = in_district or available
    return ToolResult(
        ok=True,
        data={"recommended": recommended, "backup": [s for s in available if s not in recommended]},
        evidence=[EvidenceRef(ref=s["id"], kind="station") for s in recommended],
    )


async def _create_dispatch_draft(provider, args: DispatchDraftArgs, ctx: RunContext) -> ToolResult:
    incident = await provider.get_incident(args.incident_id)
    if not incident:
        return _fail("incident_not_found")
    return ToolResult(ok=True, data={
        "is_draft": True,
        "incident_id": args.incident_id,
        "station_id": args.station_id,
        "requires_approval": "dispatch_order",
    })


async def _build_role_brief(provider, args: RoleBriefArgs, ctx: RunContext) -> ToolResult:
    if args.role not in ("commander", "station", "enterprise"):
        return _fail("invalid_arguments")
    incident = await provider.get_incident(args.incident_id)
    if not incident:
        return _fail("incident_not_found")
    return ToolResult(
        ok=True,
        data={"role": args.role, "incident": incident, "is_draft": True,
              "disclaimer": "仅供辅助，不替代现场指挥"},
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


TOOLS: Dict[str, ToolSpec] = {
    "get_signal_context": ToolSpec(SignalArgs, _get_signal_context, "读取设备信号与核实状态"),
    "get_site_packet": ToolSpec(EnterpriseArgs, _get_site_packet, "读取企业、建筑、危险源、入口、水源与预案档案"),
    "get_maintenance_context": ToolSpec(EnterpriseArgs, _get_maintenance_context, "读取维保与故障记录"),
    "find_missing_fields": ToolSpec(MissingFieldsArgs, _find_missing_fields, "对照必填字段列出信息缺口"),
    "create_verification_draft": ToolSpec(VerificationDraftArgs, _create_verification_draft, "生成待核实任务草稿"),
    "recommend_station": ToolSpec(EnterpriseArgs, _recommend_station, "按辖区与站点状态给出调派建议"),
    "create_dispatch_draft": ToolSpec(
        DispatchDraftArgs, _create_dispatch_draft, "生成调派草稿（不执行调派）",
        state_check=lambda ctx: ctx.verification_status == "confirmed",
    ),
    "build_role_brief": ToolSpec(RoleBriefArgs, _build_role_brief, "生成指挥台/站端/企业端角色摘要"),
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
