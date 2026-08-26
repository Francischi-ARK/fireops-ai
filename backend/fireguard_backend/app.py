import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, field_validator

from . import modbus
from .inspection import DEMO_ASSETS, analyze_inspection, scan_overdue_maintenance
from .repository import PostgresRepository
from .streaming import EventBroker

from .copilot import CopilotEngine, OpenAICompatibleClient
from .copilot_provider import CopilotProvider
from .copilot_schema import CopilotRunCreate


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://fireguard:fireguard-demo@127.0.0.1:54330/fireguard",
)
repository = PostgresRepository(DATABASE_URL)
broker = EventBroker()
incident_broker = EventBroker()
copilot_engine = CopilotEngine(CopilotProvider(repository), OpenAICompatibleClient())

DEMO_ACTORS = {
    "duty-demo": {"id": "duty-demo", "role": "duty", "label": "消控室值班员（演示）"},
    "crew-demo": {"id": "crew-demo", "role": "crew", "label": "处置/维保班组（演示）"},
    "owner-demo": {"id": "owner-demo", "role": "owner", "label": "网格责任人（演示）"},
    "inspector-demo": {"id": "inspector-demo", "role": "inspector", "label": "防火巡查员（演示）"},
    "ehs-demo": {"id": "ehs-demo", "role": "management", "label": "公司管理层（演示）"},
}


def require_actor(request: Request, allowed_roles):
    actor = DEMO_ACTORS.get(request.headers.get("X-FireOps-Actor", ""))
    if actor is None:
        raise HTTPException(status_code=401, detail="actor_required")
    if actor["role"] not in allowed_roles:
        raise HTTPException(status_code=403, detail="role_not_allowed")
    return actor


MonitoringEventType = Literal[
    "fire_alarm", "fault", "start", "stop", "isolate", "release", "supervise",
    "feedback", "action", "reset", "restore", "controller_status",
    "maintenance_overdue", "verification_requested",
]


class MonitoringEventCreate(BaseModel):
    enterprise_id: str = Field(min_length=1, max_length=80)
    event_type: MonitoringEventType
    severity: Literal["critical", "high", "medium", "low", "info"] = "high"
    source: str = Field(default="demo_console", min_length=1, max_length=100)
    payload: Dict[str, Any] = Field(default_factory=dict)
    occurred_at: Optional[datetime] = None

    @field_validator("occurred_at")
    @classmethod
    def validate_occurred_at(cls, value):
        if value is None:
            return value
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("occurred_at must include a timezone")
        now = datetime.now(timezone.utc)
        if value < now - timedelta(days=7) or value > now + timedelta(minutes=5):
            raise ValueError("occurred_at is outside the allowed demo window")
        return value


class VerificationRequest(BaseModel):
    result: Literal["confirmed", "dismissed"]
    note: str = Field(default="", max_length=300)


class DispatchRequest(BaseModel):
    station_id: str = Field(min_length=1, max_length=80)


class DispatchTransitionRequest(BaseModel):
    action: Literal["acknowledge", "depart", "arrive"]
    note: str = Field(default="", max_length=300)


class DispatchReportRequest(BaseModel):
    situation: str = Field(min_length=1, max_length=300)
    people_status: Literal["unknown", "no_risk", "at_risk"]


class IncidentCloseRequest(BaseModel):
    note: str = Field(default="现场反馈已核验，人工归档", max_length=300)


class CopilotApprovalRequest(BaseModel):
    action: Literal["verification_result", "workorder_dispatch"]
    note: str = Field(default="", max_length=300)


class ModbusFrameIngest(BaseModel):
    """ARK 网关上报的一帧控制器事件（十六进制字符串，含 CRC）。"""

    frame_hex: str = Field(min_length=16, max_length=64)
    gateway_id: str = Field(default="ark-gw-01", min_length=1, max_length=80)


class InspectionAnalyzeRequest(BaseModel):
    enterprise_id: str = Field(min_length=1, max_length=80)
    image_asset: str = Field(default="", max_length=300)
    voice_text: str = Field(default="", max_length=500)
    mode: Literal["scenario", "live"] = "scenario"


class InspectionFindingCreate(BaseModel):
    enterprise_id: str = Field(min_length=1, max_length=80)
    image_asset: str = Field(default="", max_length=300)
    voice_text: str = Field(default="", max_length=500)
    title: Optional[str] = Field(default=None, max_length=120)
    description: Optional[str] = Field(default=None, max_length=800)
    owner: Optional[str] = Field(default=None, max_length=80)
    department: Optional[str] = Field(default=None, max_length=80)
    mode: Literal["scenario", "live"] = "scenario"


class InspectionDispatchRequest(BaseModel):
    note: str = Field(default="", max_length=300)


class MaintenanceScanRequest(BaseModel):
    enterprise_id: Optional[str] = Field(default=None, max_length=80)
    create_drafts: bool = True


class WorkorderApproveRequest(BaseModel):
    note: str = Field(default="", max_length=300)


class WorkorderCompleteRequest(BaseModel):
    note: str = Field(default="", max_length=300)


class InspectionRecheckRequest(BaseModel):
    result: Literal["passed", "failed"] = "passed"
    note: str = Field(default="", max_length=300)


INCIDENT_ERROR_STATUS = {
    "signal_not_found": 404, "incident_not_found": 404,
    "station_not_found": 404, "dispatch_not_found": 404,
    "station_outside_jurisdiction": 422,
    "verification_conflict": 409, "dispatch_conflict": 409,
    "incident_state_conflict": 409, "station_busy": 409,
    "invalid_transition": 409, "report_conflict": 409,
    "report_before_arrival": 409, "close_before_report": 409,
}


def simulation_payload(**data):
    return {"is_simulation": True, "external_system": "none", **data}


async def incident_action(operation, action, entity_id):
    try:
        result = await operation
    except ValueError as error:
        code = str(error)
        raise HTTPException(status_code=INCIDENT_ERROR_STATUS.get(code, 409), detail=code) from error
    if result.get("changed"):
        await incident_broker.publish(simulation_payload(
            topic="incident", action=action, entity_id=str(entity_id), changed=True,
            occurred_at=datetime.now(timezone.utc).isoformat(),
        ))
    return simulation_payload(**result)


@asynccontextmanager
async def lifespan(_app):
    await repository.init()
    yield


app = FastAPI(title="FireOps 工厂消防设备运维 Agent API", version="0.2.0", lifespan=lifespan)
origins = [item.strip() for item in os.getenv(
    "FIREGUARD_CORS_ORIGINS", "http://127.0.0.1:4173,http://localhost:4173"
).split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-FireOps-Actor"],
)


@app.get("/health")
async def health():
    try:
        ready = await repository.ping()
    except Exception:
        ready = False
    return JSONResponse(
        status_code=200 if ready else 503,
        content={"status": "ok" if ready else "unavailable", "database": "ok" if ready else "unavailable"},
    )


@app.get("/monitoring/summary")
async def monitoring_summary():
    return await repository.get_summary()


@app.get("/monitoring/enterprises")
async def monitoring_enterprises():
    return {"items": await repository.list_enterprises()}


@app.get("/enterprises/{enterprise_id}")
async def enterprise_detail(enterprise_id: str):
    dossier = await repository.get_enterprise_dossier(enterprise_id)
    if not dossier:
        raise HTTPException(status_code=404, detail="enterprise_not_found")
    maintenance = await CopilotProvider(repository).get_maintenance(enterprise_id)
    dossier["maintenance_records"] = maintenance
    evidence_refs = [
        *dossier["evidence_refs"],
        *(row.get("maintenance_id") for row in maintenance),
        *(row.get("raw_ref") for row in maintenance),
    ]
    dossier["evidence_refs"] = list(dict.fromkeys(ref for ref in evidence_refs if ref))
    return simulation_payload(**dossier)


async def _publish_event(event):
    await broker.publish(event)
    if event["event_type"] == "fire_alarm":
        await incident_broker.publish(simulation_payload(
            topic="incident", action="signal_created", entity_id=str(event["id"]),
            changed=True, occurred_at=event["created_at"],
        ))


@app.post("/monitoring/events", status_code=201)
async def create_monitoring_event(payload: MonitoringEventCreate):
    event = await repository.create_event(payload.model_dump())
    if not event:
        raise HTTPException(status_code=404, detail="enterprise_not_found")
    await _publish_event(event)
    return event


# 事件严重度：手报动作按最高级处理，火警高，故障中，启动/反馈/监管类高，其余提示级。
def _modbus_severity(event) -> str:
    if event.event_type == "fire_alarm":
        return "critical" if event.device_type_code == 11 else "high"
    if event.event_type in ("start", "feedback", "supervise", "action", "release"):
        return "high"
    if event.event_type == "fault":
        return "medium"
    return "info"


@app.post("/gateway/modbus/frames", status_code=201)
async def ingest_modbus_frame(payload: ModbusFrameIngest):
    """模拟 ARK 工业网关的上报入口：解析海湾规约事件帧并落库为监测事件。

    仅做单向数据采集与解析，不向控制器下发任何控制指令。
    """
    try:
        decoded = modbus.parse_event_frame_hex(payload.frame_hex)
    except modbus.ModbusFrameError as error:
        raise HTTPException(status_code=422, detail=str(error))
    if decoded is None:
        return simulation_payload(decoded=None, event=None, note="no_event_update")

    point = await repository.get_device_point(
        decoded.controller_no, decoded.loop_no, decoded.point_no,
    )
    enterprise_id = (
        point["enterprise_id"] if point
        else await repository.get_controller_area(decoded.controller_no)
    )
    if not enterprise_id:
        raise HTTPException(status_code=404, detail="point_not_registered")

    event_payload = decoded.to_payload()
    event_payload["gateway_id"] = payload.gateway_id
    if point:
        event_payload["device_ref"] = point["point_id"]
        event_payload["location"] = point["location"]
        event_payload["protect_target"] = point["protect_target"]
    else:
        event_payload["device_ref"] = f"controller-{decoded.controller_no:02d}"
        event_payload["location"] = f"机{decoded.controller_no}火警主机（{decoded.data_source_label}）"

    event = await repository.create_event({
        "enterprise_id": enterprise_id,
        "event_type": decoded.event_type,
        "severity": _modbus_severity(decoded),
        "source": "ark-gateway-modbus",
        "payload": event_payload,
        "occurred_at": None,
    })
    if not event:
        raise HTTPException(status_code=404, detail="enterprise_not_found")
    await _publish_event(event)
    return simulation_payload(decoded=event_payload, event=event)


@app.get("/monitoring/events/stream")
async def monitoring_event_stream(request: Request):
    async def stream():
        yield "retry: 3000\n\n"
        async for event in broker.subscribe():
            if await request.is_disconnected():
                break
            if event is None:
                yield ": keep-alive\n\n"
            else:
                yield f"id: {event['id']}\nevent: monitoring\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@app.get("/incidents/overview")
async def incident_overview():
    return simulation_payload(**await repository.get_incident_overview())


@app.get("/stations/{station_id}/tasks")
async def station_tasks(station_id: str):
    result = await repository.get_station_tasks(station_id)
    if not result:
        raise HTTPException(status_code=404, detail="station_not_found")
    return simulation_payload(**result)


@app.post("/signals/{event_id}/verification")
async def verify_signal(event_id: int, payload: VerificationRequest, request: Request):
    actor = require_actor(request, {"duty", "ehs"})
    return await incident_action(
        repository.verify_signal(event_id, payload.result, payload.note, actor["label"]),
        f"verification_{payload.result}", event_id,
    )


@app.post("/incidents/{incident_id}/dispatch")
async def dispatch_incident(incident_id: int, payload: DispatchRequest, request: Request):
    actor = require_actor(request, {"duty", "ehs"})
    return await incident_action(
        repository.dispatch_incident(incident_id, payload.station_id, actor["label"]),
        "dispatch_issued", incident_id,
    )


@app.post("/dispatches/{dispatch_id}/transition")
async def transition_dispatch(dispatch_id: int, payload: DispatchTransitionRequest, request: Request):
    actor = require_actor(request, {"crew", "ehs"})
    return await incident_action(
        repository.transition_dispatch(dispatch_id, payload.action, payload.note, actor["label"]),
        payload.action, dispatch_id,
    )


@app.post("/dispatches/{dispatch_id}/report")
async def create_dispatch_report(dispatch_id: int, payload: DispatchReportRequest, request: Request):
    actor = require_actor(request, {"crew", "ehs"})
    return await incident_action(
        repository.add_dispatch_report(dispatch_id, payload.situation, payload.people_status, actor["label"]),
        "first_report", dispatch_id,
    )


@app.post("/incidents/{incident_id}/close")
async def close_incident(incident_id: int, payload: IncidentCloseRequest, request: Request):
    actor = require_actor(request, {"duty", "ehs"})
    return await incident_action(
        repository.close_incident(incident_id, payload.note, actor["label"]),
        "incident_closed", incident_id,
    )


@app.post("/copilot/runs", status_code=201)
async def create_copilot_run(payload: CopilotRunCreate):
    try:
        result = await copilot_engine.run(payload)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))
    run_id = await repository.create_copilot_run(payload, result)
    return simulation_payload(run_id=run_id, **result.model_dump())


@app.get("/copilot/runs/{run_id}")
async def get_copilot_run(run_id: int):
    row = await repository.get_copilot_run(run_id)
    if not row:
        raise HTTPException(status_code=404, detail="copilot_run_not_found")
    return simulation_payload(**row)


@app.post("/copilot/runs/{run_id}/approve")
async def approve_copilot_run(run_id: int, payload: CopilotApprovalRequest, request: Request):
    actor = require_actor(request, {"duty", "ehs"})
    result = await repository.add_copilot_approval(run_id, payload.action, payload.note, actor["label"])
    if result is None:
        raise HTTPException(status_code=404, detail="copilot_run_not_found")
    return simulation_payload(**result)


@app.get("/copilot/scenarios")
async def copilot_scenarios():
    return simulation_payload(**copilot_engine.scenarios_document())


@app.get("/inspection/demo-assets")
async def inspection_demo_assets():
    return simulation_payload(assets=DEMO_ASSETS)


@app.post("/inspection/analyze")
async def inspection_analyze(payload: InspectionAnalyzeRequest):
    draft = analyze_inspection(
        payload.enterprise_id, payload.image_asset, payload.voice_text, mode=payload.mode,
    )
    return simulation_payload(draft=draft)


@app.post("/inspection/findings", status_code=201)
async def create_inspection_finding(payload: InspectionFindingCreate, request: Request):
    require_actor(request, {"inspector", "ehs"})
    draft = analyze_inspection(
        payload.enterprise_id, payload.image_asset, payload.voice_text, mode=payload.mode,
    )
    if draft["abstained"] and not payload.title:
        raise HTTPException(status_code=422, detail="recognition_abstained")
    finding = await repository.create_inspection_finding({
        "enterprise_id": payload.enterprise_id,
        "title": payload.title or draft["title"],
        "category": draft.get("category", ""),
        "severity": draft.get("severity", "medium"),
        "location": draft.get("location", ""),
        "description": payload.description or draft["description"],
        "department": payload.department or draft.get("department", ""),
        "owner": payload.owner or draft.get("owner", ""),
        "image_asset": payload.image_asset or draft.get("image_asset", ""),
        "voice_text": payload.voice_text,
        "confidence": draft.get("confidence", 0),
        "status": "abstained" if draft.get("abstained") else "draft",
        "pin": draft.get("pin") or {},
        "evidence_refs": draft.get("evidence_refs") or [],
    })
    if not finding:
        raise HTTPException(status_code=404, detail="enterprise_not_found")
    return simulation_payload(finding=finding, draft=draft)


@app.get("/inspection/findings")
async def list_inspection_findings(enterprise_id: Optional[str] = None):
    items = await repository.list_inspection_findings(enterprise_id)
    return simulation_payload(items=items)


@app.post("/inspection/findings/{finding_id}/dispatch")
async def dispatch_inspection_finding(finding_id: int, payload: InspectionDispatchRequest, request: Request):
    require_actor(request, {"inspector", "ehs"})
    try:
        result = await repository.dispatch_inspection_finding(finding_id, payload.note)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    if result is None:
        raise HTTPException(status_code=404, detail="finding_not_found")
    return simulation_payload(**result)


@app.post("/inspection/findings/{finding_id}/recheck")
async def recheck_inspection_finding(finding_id: int, payload: InspectionRecheckRequest, request: Request):
    require_actor(request, {"inspector", "ehs"})
    try:
        result = await repository.recheck_inspection_finding(
            finding_id, result=payload.result, note=payload.note,
        )
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    if result is None:
        raise HTTPException(status_code=404, detail="finding_not_found")
    return simulation_payload(**result)


@app.post("/maintenance/overdue-scan")
async def maintenance_overdue_scan(payload: MaintenanceScanRequest, request: Request):
    require_actor(request, {"inspector", "ehs"})
    provider = CopilotProvider(repository)
    rows = await provider.get_maintenance(payload.enterprise_id) if payload.enterprise_id else []
    if not payload.enterprise_id:
        # 全厂扫描：合并各单元逾期项
        for enterprise_id in ("ent-001", "ent-002", "ent-003", "ent-004", "ent-005"):
            rows.extend(await provider.get_maintenance(enterprise_id))
    suggestions = scan_overdue_maintenance(rows, payload.enterprise_id)
    created = []
    if payload.create_drafts:
        for item in suggestions:
            workorder = await repository.create_maintenance_workorder({
                "enterprise_id": item["enterprise_id"],
                "maintenance_id": item["maintenance_id"],
                "crew_id": item["recommended_crew_id"],
                "summary": item["summary"],
                "evidence_refs": [ref for ref in item["evidence_refs"] if ref],
            })
            if workorder:
                created.append(workorder)
    return simulation_payload(suggestions=suggestions, workorders=created)


@app.get("/workorders")
async def list_workorders(enterprise_id: Optional[str] = None, status: Optional[str] = None):
    items = await repository.list_workorders(enterprise_id, status)
    return simulation_payload(items=items)


@app.post("/workorders/{workorder_id}/approve")
async def approve_workorder(workorder_id: int, payload: WorkorderApproveRequest, request: Request):
    require_actor(request, {"duty", "inspector", "ehs"})
    try:
        result = await repository.approve_workorder(workorder_id, payload.note)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    if result is None:
        raise HTTPException(status_code=404, detail="workorder_not_found")
    return simulation_payload(**result)


@app.post("/workorders/{workorder_id}/start")
async def start_workorder(workorder_id: int, payload: WorkorderCompleteRequest, request: Request):
    require_actor(request, {"crew", "owner", "ehs"})
    try:
        result = await repository.start_workorder(workorder_id, payload.note)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    if result is None:
        raise HTTPException(status_code=404, detail="workorder_not_found")
    return simulation_payload(**result)


@app.post("/workorders/{workorder_id}/complete")
async def complete_workorder(workorder_id: int, payload: WorkorderCompleteRequest, request: Request):
    require_actor(request, {"crew", "owner", "ehs"})
    try:
        result = await repository.complete_workorder(workorder_id, payload.note)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    if result is None:
        raise HTTPException(status_code=404, detail="workorder_not_found")
    return simulation_payload(**result)


class OpsWorkorderCreate(BaseModel):
    enterprise_id: str = Field(min_length=1, max_length=80)
    kind: Literal["rectification", "maintenance", "repair"] = "repair"
    summary: str = Field(min_length=1, max_length=500)
    crew_id: str = Field(default="crew-wb-01", min_length=1, max_length=80)
    owner: str = Field(default="维保组带班员", max_length=80)
    event_id: Optional[int] = None
    maintenance_id: Optional[str] = None
    status: Literal["draft", "approved"] = "draft"
    evidence_refs: List[str] = Field(default_factory=list)


@app.post("/workorders", status_code=201)
async def create_workorder(payload: OpsWorkorderCreate, request: Request):
    require_actor(request, {"duty", "ehs"})
    workorder = await repository.create_ops_workorder(payload.model_dump())
    if not workorder:
        raise HTTPException(status_code=404, detail="enterprise_not_found")
    return simulation_payload(workorder=workorder)


@app.get("/workbench/inbox")
async def workbench_inbox(
    role: Literal["crew", "duty", "owner"] = "crew",
    crew_id: Optional[str] = None,
    owner: Optional[str] = None,
):
    if role == "crew" and not crew_id:
        crew_id = "crew-wx-01"
    result = await repository.get_workbench_inbox(role=role, crew_id=crew_id, owner=owner)
    return simulation_payload(**result)


@app.get("/incidents/events/stream")
async def incident_event_stream(request: Request):
    async def stream():
        yield "retry: 3000\n\n"
        async for event in incident_broker.subscribe():
            if await request.is_disconnected():
                break
            if event is None:
                yield ": keep-alive\n\n"
            else:
                yield f"event: incident\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})
