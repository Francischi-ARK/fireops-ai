import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Literal, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, field_validator

from .repository import PostgresRepository
from .streaming import EventBroker

from .copilot import CopilotEngine, OpenAICompatibleClient
from .copilot_provider import CopilotProvider
from .copilot_schema import CopilotRunCreate


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://fireguard:fireguard-demo@127.0.0.1:54329/fireguard",
)
repository = PostgresRepository(DATABASE_URL)
broker = EventBroker()
incident_broker = EventBroker()
copilot_engine = CopilotEngine(CopilotProvider(repository), OpenAICompatibleClient())


class MonitoringEventCreate(BaseModel):
    enterprise_id: str = Field(min_length=1, max_length=80)
    event_type: Literal["fire_alarm", "fault", "maintenance_overdue", "verification_requested"]
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


class CopilotApprovalRequest(BaseModel):
    action: Literal["verification_result", "dispatch_order"]
    note: str = Field(default="", max_length=300)


INCIDENT_ERROR_STATUS = {
    "signal_not_found": 404, "incident_not_found": 404,
    "station_not_found": 404, "dispatch_not_found": 404,
    "station_outside_jurisdiction": 422,
    "verification_conflict": 409, "dispatch_conflict": 409,
    "incident_state_conflict": 409, "station_busy": 409,
    "invalid_transition": 409, "report_conflict": 409,
    "report_before_arrival": 409,
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


app = FastAPI(title="FireGuard AI Monitoring API", version="0.1.0", lifespan=lifespan)
origins = [item.strip() for item in os.getenv(
    "FIREGUARD_CORS_ORIGINS", "http://127.0.0.1:4173,http://localhost:4173"
).split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
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
    enterprise = await repository.get_enterprise(enterprise_id)
    if not enterprise:
        raise HTTPException(status_code=404, detail="enterprise_not_found")
    return enterprise


@app.post("/monitoring/events", status_code=201)
async def create_monitoring_event(payload: MonitoringEventCreate):
    event = await repository.create_event(payload.model_dump())
    if not event:
        raise HTTPException(status_code=404, detail="enterprise_not_found")
    await broker.publish(event)
    if event["event_type"] == "fire_alarm":
        await incident_broker.publish(simulation_payload(
            topic="incident", action="signal_created", entity_id=str(event["id"]),
            changed=True, occurred_at=event["created_at"],
        ))
    return event


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
async def verify_signal(event_id: int, payload: VerificationRequest):
    return await incident_action(
        repository.verify_signal(event_id, payload.result, payload.note),
        f"verification_{payload.result}", event_id,
    )


@app.post("/incidents/{incident_id}/dispatch")
async def dispatch_incident(incident_id: int, payload: DispatchRequest):
    return await incident_action(
        repository.dispatch_incident(incident_id, payload.station_id),
        "dispatch_issued", incident_id,
    )


@app.post("/dispatches/{dispatch_id}/transition")
async def transition_dispatch(dispatch_id: int, payload: DispatchTransitionRequest):
    return await incident_action(
        repository.transition_dispatch(dispatch_id, payload.action, payload.note),
        payload.action, dispatch_id,
    )


@app.post("/dispatches/{dispatch_id}/report")
async def create_dispatch_report(dispatch_id: int, payload: DispatchReportRequest):
    return await incident_action(
        repository.add_dispatch_report(dispatch_id, payload.situation, payload.people_status),
        "first_report", dispatch_id,
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
async def approve_copilot_run(run_id: int, payload: CopilotApprovalRequest):
    result = await repository.add_copilot_approval(run_id, payload.action, payload.note)
    if result is None:
        raise HTTPException(status_code=404, detail="copilot_run_not_found")
    return simulation_payload(**result)


@app.get("/copilot/scenarios")
async def copilot_scenarios():
    return simulation_payload(**copilot_engine.scenarios_document())


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
