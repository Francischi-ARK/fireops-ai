from datetime import datetime, timedelta, timezone
from uuid import uuid4

from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .domain import (
    apply_monitoring_event,
    build_response_brief,
    next_dispatch_status,
    station_status_for_dispatch,
    summarize_enterprises,
)


CREATE_ENTERPRISES_SQL = """
CREATE TABLE IF NOT EXISTS enterprises (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    industry TEXT NOT NULL,
    district TEXT NOT NULL,
    building TEXT NOT NULL,
    health_score SMALLINT NOT NULL CHECK (health_score BETWEEN 0 AND 100),
    risk_level TEXT NOT NULL CHECK (risk_level IN ('high', 'medium', 'low', 'unrated')),
    online_rate NUMERIC(5,2) NOT NULL CHECK (online_rate BETWEEN 0 AND 100),
    open_hazards INTEGER NOT NULL DEFAULT 0 CHECK (open_hazards >= 0),
    pending_signal_count INTEGER NOT NULL DEFAULT 0 CHECK (pending_signal_count >= 0),
    fault_count_30d INTEGER NOT NULL DEFAULT 0 CHECK (fault_count_30d >= 0),
    maintenance_overdue INTEGER NOT NULL DEFAULT 0 CHECK (maintenance_overdue >= 0),
    last_seen_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""

CREATE_EVENTS_SQL = """
CREATE TABLE IF NOT EXISTS monitoring_events (
    id BIGSERIAL PRIMARY KEY,
    enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
    event_type TEXT NOT NULL CHECK (event_type IN ('fire_alarm', 'fault', 'maintenance_overdue', 'verification_requested')),
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    source TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""

INCIDENT_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS fire_stations (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, district TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('available','awaiting_ack','assigned','enroute','on_scene')),
    crew_count INTEGER NOT NULL CHECK (crew_count >= 0),
    vehicle_count INTEGER NOT NULL CHECK (vehicle_count >= 0)
);
CREATE TABLE IF NOT EXISTS enterprise_response_profiles (
    enterprise_id TEXT PRIMARY KEY REFERENCES enterprises(id), address TEXT,
    hazards JSONB NOT NULL DEFAULT '[]', access_points JSONB NOT NULL DEFAULT '[]',
    water_sources JSONB NOT NULL DEFAULT '[]', facilities JSONB NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS signal_verifications (
    id BIGSERIAL PRIMARY KEY, monitoring_event_id BIGINT UNIQUE NOT NULL REFERENCES monitoring_events(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','dismissed')),
    resolved_at TIMESTAMPTZ, note TEXT
);
CREATE TABLE IF NOT EXISTS fire_incidents (
    id BIGSERIAL PRIMARY KEY, source_event_id BIGINT UNIQUE NOT NULL REFERENCES monitoring_events(id),
    enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
    status TEXT NOT NULL DEFAULT 'pending_dispatch' CHECK (status IN ('pending_dispatch','dispatched','acknowledged','enroute','arrived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS incident_dispatches (
    id BIGSERIAL PRIMARY KEY, incident_id BIGINT UNIQUE NOT NULL REFERENCES fire_incidents(id),
    station_id TEXT NOT NULL REFERENCES fire_stations(id),
    status TEXT NOT NULL CHECK (status IN ('issued','acknowledged','enroute','arrived')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), acknowledged_at TIMESTAMPTZ,
    departed_at TIMESTAMPTZ, arrived_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS dispatch_reports (
    id BIGSERIAL PRIMARY KEY, dispatch_id BIGINT UNIQUE NOT NULL REFERENCES incident_dispatches(id),
    situation TEXT NOT NULL CHECK (char_length(situation) BETWEEN 1 AND 300),
    people_status TEXT NOT NULL CHECK (people_status IN ('unknown','no_risk','at_risk')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS incident_timeline (
    id BIGSERIAL PRIMARY KEY, incident_id BIGINT NOT NULL REFERENCES fire_incidents(id),
    event_key TEXT UNIQUE NOT NULL, event_type TEXT NOT NULL, actor TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '', occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""

CREATE_COPILOT_RUNS_SQL = """
CREATE TABLE IF NOT EXISTS copilot_runs (
    id BIGSERIAL PRIMARY KEY,
    scenario_id TEXT, enterprise_id TEXT NOT NULL,
    event_id BIGINT, incident_id BIGINT,
    mode TEXT NOT NULL CHECK (mode IN ('live', 'scenario')),
    model_name TEXT NOT NULL, status TEXT NOT NULL,
    input_summary TEXT NOT NULL DEFAULT '',
    trace_json JSONB NOT NULL DEFAULT '{}',
    approvals TEXT[] NOT NULL DEFAULT '{}',
    is_simulation BOOLEAN NOT NULL DEFAULT TRUE,
    external_system TEXT NOT NULL DEFAULT 'none',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""

SEED_ENTERPRISES = [
    ("ent-001", "皓源新能源（虚拟）", "锂离子电池制造", "高新区", "1号生产厂房", 58, "high", 89, 12, 3, 18, 2, 2),
    ("ent-005", "恒泽材料（虚拟）", "新材料制造", "临港区", "1号生产厂房", 69, "high", 93, 8, 1, 9, 1, 4),
    ("ent-002", "瑞虎机械（虚拟）", "通用设备制造", "经开区", "总装厂房", 76, "medium", 97, 6, 0, 4, 1, 3),
    ("ent-003", "安澜仓储（虚拟）", "普通仓储", "物流园区", "1号仓库", 91, "low", 99, 2, 0, 1, 0, 1),
    ("ent-004", "启明电子（虚拟）", "电子元件制造", "新城区", "2号厂房", 0, "unrated", 62, 0, 0, 0, 0, 1800),
]

SEED_STATIONS = [
    ("station-hx-01", "高新消防救援站一站（虚拟）", "高新区", "available", 18, 4),
    ("station-hx-02", "科创消防救援站（虚拟）", "高新区", "available", 16, 3),
    ("station-jk-01", "经开消防救援站（虚拟）", "经开区", "available", 20, 5),
]

SEED_PROFILES = {
    "ent-001": ("高新区新能源产业园 1 号生产厂房（合成）", ["锂电池生产区域（合成）"], ["厂区东门（合成）"], ["厂区消防水池（合成）"], ["自动喷水灭火系统（合成）"]),
    "ent-002": ("经开区装备路 8 号（合成）", ["机加工油品区域（合成）"], ["南侧主入口（合成）"], ["市政消火栓（合成）"], ["室内消火栓系统（合成）"]),
}

ENTERPRISE_COLUMNS = """id, name, industry, district, building, health_score, risk_level,
online_rate, open_hazards, pending_signal_count, fault_count_30d, maintenance_overdue,
last_seen_at, updated_at"""


def serialize_row(row):
    data = dict(row)
    for key in ("last_seen_at", "updated_at", "occurred_at", "created_at"):
        if isinstance(data.get(key), datetime):
            data[key] = data[key].isoformat()
    if "online_rate" in data:
        data["online_rate"] = float(data["online_rate"])
    return data


class PostgresRepository:
    def __init__(self, dsn):
        self.dsn = dsn

    async def _connect(self):
        return await AsyncConnection.connect(self.dsn, row_factory=dict_row)

    async def init(self):
        now = datetime.now(timezone.utc)
        async with await self._connect() as connection:
            await connection.execute(CREATE_ENTERPRISES_SQL)
            await connection.execute(CREATE_EVENTS_SQL)
            await connection.execute(INCIDENT_SCHEMA_SQL)
            await connection.execute(CREATE_COPILOT_RUNS_SQL)
            async with connection.cursor() as cursor:
                await cursor.executemany(
                    """INSERT INTO enterprises (
                        id, name, industry, district, building, health_score, risk_level,
                        online_rate, open_hazards, pending_signal_count, fault_count_30d,
                        maintenance_overdue, last_seen_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING""",
                    [(*row[:-1], now - timedelta(minutes=row[-1])) for row in SEED_ENTERPRISES],
                )
                await cursor.executemany(
                    """INSERT INTO fire_stations (id, name, district, status, crew_count, vehicle_count)
                    VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING""",
                    SEED_STATIONS,
                )
                await cursor.executemany(
                    """INSERT INTO enterprise_response_profiles
                    (enterprise_id, address, hazards, access_points, water_sources, facilities)
                    VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (enterprise_id) DO NOTHING""",
                    [(enterprise_id, address, Jsonb(hazards), Jsonb(access), Jsonb(water), Jsonb(facilities))
                     for enterprise_id, (address, hazards, access, water, facilities) in SEED_PROFILES.items()],
                )
            await connection.execute(
                """INSERT INTO signal_verifications (monitoring_event_id)
                SELECT id FROM monitoring_events WHERE event_type = 'fire_alarm'
                ON CONFLICT (monitoring_event_id) DO NOTHING"""
            )

    async def ping(self):
        async with await self._connect() as connection:
            row = await (await connection.execute("SELECT 1 AS ok")).fetchone()
            return bool(row and row["ok"] == 1)

    async def list_enterprises(self):
        async with await self._connect() as connection:
            rows = await (await connection.execute(
                f"SELECT {ENTERPRISE_COLUMNS} FROM enterprises ORDER BY health_score ASC, id ASC"
            )).fetchall()
        return [serialize_row(row) for row in rows]

    async def get_enterprise(self, enterprise_id):
        async with await self._connect() as connection:
            row = await (await connection.execute(
                f"SELECT {ENTERPRISE_COLUMNS} FROM enterprises WHERE id = %s", (enterprise_id,)
            )).fetchone()
        return serialize_row(row) if row else None

    async def get_summary(self):
        return summarize_enterprises(await self.list_enterprises())

    async def create_event(self, data):
        occurred_at = data.get("occurred_at") or datetime.now(timezone.utc)
        async with await self._connect() as connection:
            row = await (await connection.execute(
                f"SELECT {ENTERPRISE_COLUMNS} FROM enterprises WHERE id = %s FOR UPDATE",
                (data["enterprise_id"],),
            )).fetchone()
            if not row:
                return None

            updated = apply_monitoring_event(dict(row), data)
            last_seen_at = (
                max(row["last_seen_at"], occurred_at)
                if data["event_type"] in {"fire_alarm", "fault"}
                else row["last_seen_at"]
            )
            await connection.execute(
                """UPDATE enterprises SET health_score = %s, risk_level = %s,
                    pending_signal_count = %s, fault_count_30d = %s,
                    maintenance_overdue = %s, last_seen_at = %s, updated_at = NOW()
                    WHERE id = %s""",
                (
                    updated["health_score"], updated["risk_level"], updated["pending_signal_count"],
                    updated["fault_count_30d"], updated["maintenance_overdue"], last_seen_at,
                    data["enterprise_id"],
                ),
            )
            event = await (await connection.execute(
                """INSERT INTO monitoring_events
                    (enterprise_id, event_type, severity, source, payload, occurred_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id, enterprise_id, event_type, severity, source, payload, occurred_at, created_at""",
                (
                    data["enterprise_id"], data["event_type"], data["severity"], data["source"],
                    Jsonb(data.get("payload") or {}), occurred_at,
                ),
            )).fetchone()
            if data["event_type"] == "fire_alarm":
                await connection.execute(
                    """INSERT INTO signal_verifications (monitoring_event_id)
                    VALUES (%s) ON CONFLICT (monitoring_event_id) DO NOTHING""",
                    (event["id"],),
                )
        result = serialize_row(event)
        result["enterprise"] = await self.get_enterprise(data["enterprise_id"])
        return result

    async def _incident_detail(self, connection, incident_id):
        incident = await (await connection.execute(
            """SELECT i.id, i.source_event_id, i.enterprise_id, e.name AS enterprise_name,
                e.district, i.status, i.created_at, i.updated_at,
                p.address, p.hazards, p.access_points, p.water_sources, p.facilities
            FROM fire_incidents i JOIN enterprises e ON e.id = i.enterprise_id
            LEFT JOIN enterprise_response_profiles p ON p.enterprise_id = i.enterprise_id
            WHERE i.id = %s""", (incident_id,)
        )).fetchone()
        if not incident:
            return None
        dispatch = await (await connection.execute(
            """SELECT d.id, d.incident_id, d.station_id, s.name AS station_name, d.status,
                d.issued_at, d.acknowledged_at, d.departed_at, d.arrived_at
            FROM incident_dispatches d JOIN fire_stations s ON s.id = d.station_id
            WHERE d.incident_id = %s""", (incident_id,)
        )).fetchone()
        report = None
        if dispatch:
            report = await (await connection.execute(
                """SELECT id, dispatch_id, situation, people_status, created_at
                FROM dispatch_reports WHERE dispatch_id = %s""", (dispatch["id"],)
            )).fetchone()
        timeline = await (await connection.execute(
            """SELECT id, event_type, actor, note, occurred_at FROM incident_timeline
            WHERE incident_id = %s ORDER BY occurred_at, id""", (incident_id,)
        )).fetchall()
        profile = {key: incident.get(key) for key in ("address", "hazards", "access_points", "water_sources", "facilities")}
        result = serialize_row(incident)
        for key in profile:
            result.pop(key, None)
        result["dispatch"] = serialize_row(dispatch) if dispatch else None
        result["report"] = serialize_row(report) if report else None
        result["timeline"] = [serialize_row(row) for row in timeline]
        result["response_brief"] = build_response_brief(profile)
        return result

    async def get_incident_overview(self):
        async with await self._connect() as connection:
            signals = await (await connection.execute(
                """SELECT v.id, m.id AS monitoring_event_id, m.enterprise_id,
                    e.name AS enterprise_name, m.severity, m.occurred_at,
                    v.status AS verification_status
                FROM signal_verifications v
                JOIN monitoring_events m ON m.id = v.monitoring_event_id
                JOIN enterprises e ON e.id = m.enterprise_id
                ORDER BY m.occurred_at DESC, m.id DESC"""
            )).fetchall()
            stations = await (await connection.execute(
                """SELECT id, name, district, status, crew_count, vehicle_count
                FROM fire_stations ORDER BY district, id"""
            )).fetchall()
            incident_ids = [row["id"] for row in await (await connection.execute(
                "SELECT id FROM fire_incidents ORDER BY created_at DESC, id DESC"
            )).fetchall()]
            # ponytail: demo-sized detail loading; replace with aggregate SQL when incident volume grows.
            incidents = [await self._incident_detail(connection, incident_id) for incident_id in incident_ids]
        return {
            "signals": [serialize_row(row) for row in signals],
            "incidents": incidents,
            "stations": [serialize_row(row) for row in stations],
        }

    async def get_station_tasks(self, station_id):
        async with await self._connect() as connection:
            station = await (await connection.execute(
                """SELECT id, name, district, status, crew_count, vehicle_count
                FROM fire_stations WHERE id = %s""", (station_id,)
            )).fetchone()
            if not station:
                return None
            incident_ids = [row["incident_id"] for row in await (await connection.execute(
                """SELECT incident_id FROM incident_dispatches WHERE station_id = %s
                ORDER BY issued_at DESC, id DESC""", (station_id,)
            )).fetchall()]
            tasks = [await self._incident_detail(connection, incident_id) for incident_id in incident_ids]
        return {"station": serialize_row(station), "tasks": tasks}

    async def get_signal(self, event_id):
        async with await self._connect() as connection:
            row = await (await connection.execute(
                """SELECT m.id, m.enterprise_id, m.event_type, m.severity, m.source,
                    m.payload, m.occurred_at, m.created_at,
                    COALESCE(v.status, 'pending') AS verification_status
                FROM monitoring_events m
                LEFT JOIN signal_verifications v ON v.monitoring_event_id = m.id
                WHERE m.id = %s""", (event_id,)
            )).fetchone()
        if not row:
            return None
        result = serialize_row(row)
        result["raw_ref"] = f"monitoring_events/{row['id']}"
        return result

    async def get_site_profile(self, enterprise_id):
        async with await self._connect() as connection:
            row = await (await connection.execute(
                """SELECT address, hazards, access_points, water_sources, facilities
                FROM enterprise_response_profiles WHERE enterprise_id = %s""", (enterprise_id,)
            )).fetchone()
        return serialize_row(row) if row else None

    async def list_stations(self):
        async with await self._connect() as connection:
            rows = await (await connection.execute(
                """SELECT id, name, district, status, crew_count, vehicle_count
                FROM fire_stations ORDER BY district, id"""
            )).fetchall()
        return [serialize_row(row) for row in rows]

    async def get_incident(self, incident_id):
        async with await self._connect() as connection:
            return await self._incident_detail(connection, incident_id)

    async def get_incident_by_event(self, event_id):
        async with await self._connect() as connection:
            row = await (await connection.execute(
                "SELECT id FROM fire_incidents WHERE source_event_id = %s", (event_id,)
            )).fetchone()
            if not row:
                return None
            return await self._incident_detail(connection, row["id"])

    async def append_incident_activity(self, incident_id, event_type, note, actor):
        async with await self._connect() as connection:
            exists = await (await connection.execute(
                "SELECT id FROM fire_incidents WHERE id = %s", (incident_id,)
            )).fetchone()
            if not exists:
                return None
            row = await (await connection.execute(
                """INSERT INTO incident_timeline (incident_id, event_key, event_type, actor, note)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, incident_id, event_type, actor, note, occurred_at""",
                (incident_id, f"copilot-{uuid4().hex[:12]}", event_type, actor, note),
            )).fetchone()
        return serialize_row(row)

    async def create_copilot_run(self, payload, result):
        data = result.model_dump()
        async with await self._connect() as connection:
            row = await (await connection.execute(
                """INSERT INTO copilot_runs
                    (scenario_id, enterprise_id, event_id, incident_id, mode, model_name,
                     status, input_summary, trace_json)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                (
                    payload.scenario_id, payload.enterprise_id, payload.event_id,
                    payload.incident_id if payload.incident_id is not None else data["incident_id"],
                    payload.mode, data["model_name"], data["status"],
                    (payload.reporter_text or "")[:200], Jsonb(data),
                ),
            )).fetchone()
        return row["id"]

    async def get_copilot_run(self, run_id):
        async with await self._connect() as connection:
            row = await (await connection.execute(
                "SELECT * FROM copilot_runs WHERE id = %s", (run_id,)
            )).fetchone()
        return serialize_row(row) if row else None

    async def add_copilot_approval(self, run_id, action, note, actor="总队值班员（模拟）"):
        async with await self._connect() as connection:
            row = await (await connection.execute(
                """UPDATE copilot_runs SET approvals = array_append(approvals, %s)
                WHERE id = %s AND NOT (%s = ANY(approvals))
                RETURNING id, incident_id, approvals""",
                (action, run_id, action),
            )).fetchone()
            if not row:
                exists = await (await connection.execute(
                    "SELECT id, incident_id, approvals FROM copilot_runs WHERE id = %s", (run_id,)
                )).fetchone()
                if not exists:
                    return None
                return {"run_id": run_id, "approvals": list(exists["approvals"]), "timeline_recorded": False}
            timeline_recorded = False
            if row["incident_id"] is not None:
                await connection.execute(
                    """INSERT INTO incident_timeline (incident_id, event_key, event_type, actor, note)
                    VALUES (%s, %s, %s, %s, %s) ON CONFLICT (event_key) DO NOTHING""",
                    (row["incident_id"], f"copilot-run-{run_id}:{action}", f"approval_{action}", actor, note),
                )
                timeline_recorded = True
        return {"run_id": run_id, "approvals": list(row["approvals"]), "timeline_recorded": timeline_recorded}

    async def verify_signal(self, event_id, result, note=""):
        async with await self._connect() as connection:
            event = await (await connection.execute(
                """SELECT id, enterprise_id FROM monitoring_events
                WHERE id = %s AND event_type = 'fire_alarm'""", (event_id,)
            )).fetchone()
            if not event:
                raise ValueError("signal_not_found")
            verification = await (await connection.execute(
                """SELECT id, monitoring_event_id, status, resolved_at, note
                FROM signal_verifications WHERE monitoring_event_id = %s FOR UPDATE""", (event_id,)
            )).fetchone()
            if not verification:
                verification = await (await connection.execute(
                    """INSERT INTO signal_verifications (monitoring_event_id) VALUES (%s)
                    RETURNING id, monitoring_event_id, status, resolved_at, note""", (event_id,)
                )).fetchone()
            if verification["status"] != "pending":
                if verification["status"] != result:
                    raise ValueError("verification_conflict")
                incident_row = await (await connection.execute(
                    "SELECT id FROM fire_incidents WHERE source_event_id = %s", (event_id,)
                )).fetchone()
                incident = await self._incident_detail(connection, incident_row["id"]) if incident_row else None
                return {"changed": False, "verification": serialize_row(verification), "incident": incident}
            verification = await (await connection.execute(
                """UPDATE signal_verifications SET status = %s, resolved_at = NOW(), note = %s
                WHERE id = %s RETURNING id, monitoring_event_id, status, resolved_at, note""",
                (result, note, verification["id"]),
            )).fetchone()
            incident = None
            if result == "confirmed":
                incident_row = await (await connection.execute(
                    """INSERT INTO fire_incidents (source_event_id, enterprise_id)
                    VALUES (%s, %s) ON CONFLICT (source_event_id) DO UPDATE SET updated_at = fire_incidents.updated_at
                    RETURNING id""", (event_id, event["enterprise_id"])
                )).fetchone()
                await connection.execute(
                    """INSERT INTO incident_timeline (incident_id, event_key, event_type, actor, note)
                    VALUES (%s, %s, 'incident_created', '总队值班员（模拟）', %s)
                    ON CONFLICT (event_key) DO NOTHING""",
                    (incident_row["id"], f"incident:{incident_row['id']}:created", note),
                )
                incident = await self._incident_detail(connection, incident_row["id"])
        return {"changed": True, "verification": serialize_row(verification), "incident": incident}

    async def dispatch_incident(self, incident_id, station_id):
        async with await self._connect() as connection:
            incident = await (await connection.execute(
                """SELECT i.id, i.status, e.district FROM fire_incidents i
                JOIN enterprises e ON e.id = i.enterprise_id WHERE i.id = %s FOR UPDATE""", (incident_id,)
            )).fetchone()
            if not incident:
                raise ValueError("incident_not_found")
            existing = await (await connection.execute(
                "SELECT * FROM incident_dispatches WHERE incident_id = %s FOR UPDATE", (incident_id,)
            )).fetchone()
            if existing:
                if existing["station_id"] != station_id:
                    raise ValueError("dispatch_conflict")
                detail = await self._incident_detail(connection, incident_id)
                station = await (await connection.execute("SELECT * FROM fire_stations WHERE id = %s", (station_id,))).fetchone()
                return {"changed": False, "incident": detail, "dispatch": serialize_row(existing), "station": serialize_row(station)}
            if incident["status"] != "pending_dispatch":
                raise ValueError("incident_state_conflict")
            station = await (await connection.execute(
                "SELECT * FROM fire_stations WHERE id = %s FOR UPDATE", (station_id,)
            )).fetchone()
            if not station:
                raise ValueError("station_not_found")
            if station["district"] != incident["district"]:
                raise ValueError("station_outside_jurisdiction")
            if station["status"] != "available":
                raise ValueError("station_busy")
            dispatch = await (await connection.execute(
                """INSERT INTO incident_dispatches (incident_id, station_id, status)
                VALUES (%s, %s, 'issued') RETURNING *""", (incident_id, station_id)
            )).fetchone()
            await connection.execute("UPDATE fire_incidents SET status = 'dispatched', updated_at = NOW() WHERE id = %s", (incident_id,))
            await connection.execute("UPDATE fire_stations SET status = 'awaiting_ack' WHERE id = %s", (station_id,))
            await connection.execute(
                """INSERT INTO incident_timeline (incident_id, event_key, event_type, actor, note)
                VALUES (%s, %s, 'dispatch_issued', '总队值班员（模拟）', %s)""",
                (incident_id, f"incident:{incident_id}:dispatch-issued", station["name"]),
            )
        return {"changed": True, **await self._dispatch_result(incident_id, dispatch["id"], station_id)}

    async def _dispatch_result(self, incident_id, dispatch_id, station_id):
        async with await self._connect() as connection:
            return {
                "incident": await self._incident_detail(connection, incident_id),
                "dispatch": serialize_row(await (await connection.execute("SELECT * FROM incident_dispatches WHERE id = %s", (dispatch_id,))).fetchone()),
                "station": serialize_row(await (await connection.execute("SELECT * FROM fire_stations WHERE id = %s", (station_id,))).fetchone()),
            }

    async def transition_dispatch(self, dispatch_id, action, note=""):
        async with await self._connect() as connection:
            ids = await (await connection.execute(
                "SELECT incident_id, station_id FROM incident_dispatches WHERE id = %s", (dispatch_id,)
            )).fetchone()
            if not ids:
                raise ValueError("dispatch_not_found")
            await connection.execute("SELECT id FROM fire_incidents WHERE id = %s FOR UPDATE", (ids["incident_id"],))
            dispatch = await (await connection.execute("SELECT * FROM incident_dispatches WHERE id = %s FOR UPDATE", (dispatch_id,))).fetchone()
            station = await (await connection.execute("SELECT * FROM fire_stations WHERE id = %s FOR UPDATE", (ids["station_id"],))).fetchone()
            target = next_dispatch_status(dispatch["status"], action)
            if target == dispatch["status"]:
                detail = await self._incident_detail(connection, ids["incident_id"])
                return {"changed": False, "incident": detail, "dispatch": serialize_row(dispatch), "station": serialize_row(station)}
            timestamp_column = {"acknowledged": "acknowledged_at", "enroute": "departed_at", "arrived": "arrived_at"}[target]
            await connection.execute(
                f"UPDATE incident_dispatches SET status = %s, {timestamp_column} = NOW() WHERE id = %s",
                (target, dispatch_id),
            )
            await connection.execute("UPDATE fire_incidents SET status = %s, updated_at = NOW() WHERE id = %s", (target, ids["incident_id"]))
            await connection.execute("UPDATE fire_stations SET status = %s WHERE id = %s", (station_status_for_dispatch(target), ids["station_id"]))
            await connection.execute(
                """INSERT INTO incident_timeline (incident_id, event_key, event_type, actor, note)
                VALUES (%s, %s, %s, '消防救援站通信员（模拟）', %s)""",
                (ids["incident_id"], f"incident:{ids['incident_id']}:{target}", target, note),
            )
        return {"changed": True, **await self._dispatch_result(ids["incident_id"], dispatch_id, ids["station_id"])}

    async def add_dispatch_report(self, dispatch_id, situation, people_status):
        async with await self._connect() as connection:
            dispatch = await (await connection.execute(
                "SELECT * FROM incident_dispatches WHERE id = %s FOR UPDATE", (dispatch_id,)
            )).fetchone()
            if not dispatch:
                raise ValueError("dispatch_not_found")
            existing = await (await connection.execute(
                "SELECT * FROM dispatch_reports WHERE dispatch_id = %s FOR UPDATE", (dispatch_id,)
            )).fetchone()
            if existing:
                if existing["situation"] != situation or existing["people_status"] != people_status:
                    raise ValueError("report_conflict")
                return {"changed": False, "incident": await self._incident_detail(connection, dispatch["incident_id"]), "report": serialize_row(existing)}
            if dispatch["status"] != "arrived":
                raise ValueError("report_before_arrival")
            report = await (await connection.execute(
                """INSERT INTO dispatch_reports (dispatch_id, situation, people_status)
                VALUES (%s, %s, %s) RETURNING *""", (dispatch_id, situation, people_status)
            )).fetchone()
            await connection.execute(
                """INSERT INTO incident_timeline (incident_id, event_key, event_type, actor, note)
                VALUES (%s, %s, 'first_report', '消防救援站通信员（模拟）', %s)""",
                (dispatch["incident_id"], f"incident:{dispatch['incident_id']}:first-report", situation),
            )
            detail = await self._incident_detail(connection, dispatch["incident_id"])
        return {"changed": True, "incident": detail, "report": serialize_row(report)}
