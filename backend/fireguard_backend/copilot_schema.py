"""Pydantic schemas for the FireGuard Incident Copilot.

The model may only produce these structures. Everything outside them is
rejected before any tool runs or any domain state changes.
"""

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

Intent = Literal[
    "signal_verification",
    "incident_response_support",
    "fault_diagnosis",
    "gas_release_advisory",
    "unknown",
]

EvidenceKind = Literal[
    "signal", "maintenance", "iot", "site", "finding", "point",
    "crew", "incident", "knowledge", "image", "report",
]

ApprovalAction = Literal["verification_result", "workorder_dispatch"]


class EvidenceRef(BaseModel):
    ref: str = Field(min_length=1, max_length=200)
    kind: EvidenceKind
    note: str = Field(default="", max_length=200)


class ToolCall(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    arguments: Dict[str, Any] = Field(default_factory=dict)


class AgentPlan(BaseModel):
    intent: Intent
    missing_fields: List[str] = Field(default_factory=list)
    plan: List[str] = Field(default_factory=list)
    tool_calls: List[ToolCall] = Field(default_factory=list)
    evidence: List[EvidenceRef] = Field(default_factory=list)
    draft_outputs: Dict[str, Any] = Field(default_factory=dict)
    risks: List[str] = Field(default_factory=list)
    approval_required: List[str] = Field(default_factory=list)
    abstained: bool = False


class ToolTraceEntry(BaseModel):
    name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)
    ok: bool
    error: Optional[str] = None
    data: Dict[str, Any] = Field(default_factory=dict)
    evidence_refs: List[str] = Field(default_factory=list)


class CopilotRunResult(BaseModel):
    scenario_id: Optional[str] = None
    incident_id: Optional[int] = None
    mode: Literal["live", "scenario"]
    model_name: str
    status: Literal["completed", "abstained", "failed"]
    plan: AgentPlan
    trace: List[ToolTraceEntry] = Field(default_factory=list)
    rejected_evidence: List[str] = Field(default_factory=list)
    fallback_reason: Optional[str] = None
    is_simulation: bool = True
    external_system: str = "none"


class CopilotRunCreate(BaseModel):
    enterprise_id: str = Field(min_length=1, max_length=80)
    event_id: Optional[int] = None
    incident_id: Optional[int] = None
    reporter_text: str = Field(default="", max_length=2000)
    image_assets: List[str] = Field(default_factory=list)
    scenario_id: Optional[str] = None
    mode: Literal["live", "scenario"] = "scenario"
