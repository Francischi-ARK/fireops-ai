from copy import deepcopy


DISPATCH_TRANSITIONS = {
    "acknowledge": ("issued", "acknowledged"),
    "depart": ("acknowledged", "enroute"),
    "arrive": ("enroute", "arrived"),
}

STATION_STATUS_BY_DISPATCH = {
    "issued": "awaiting_ack",
    "acknowledged": "assigned",
    "enroute": "enroute",
    "arrived": "on_scene",
}


def next_dispatch_status(current_status, action):
    expected, target = DISPATCH_TRANSITIONS.get(action, (None, None))
    if current_status == target:
        return target
    if current_status != expected:
        raise ValueError("invalid_transition")
    return target


def station_status_for_dispatch(dispatch_status):
    try:
        return STATION_STATUS_BY_DISPATCH[dispatch_status]
    except KeyError as error:
        raise ValueError("invalid_dispatch_status") from error


def build_response_brief(profile):
    profile = profile or {}
    labels = {
        "hazards": "重点危险源",
        "access_points": "优先入口",
        "water_sources": "可用水源",
        "facilities": "消防设施",
    }
    items = []
    for field, label in labels.items():
        values = profile.get(field) or []
        text = "、".join(str(value) for value in values) if values else "未知"
        items.append({"text": f"{label}：{text}", "sources": [f"enterprise_response_profiles.{field}"]})
    return {
        "address": profile.get("address") or "未知",
        "items": items,
        "disclaimer": "仅供辅助，不替代现场指挥",
    }


def summarize_enterprises(enterprises):
    rows = list(enterprises)
    count = len(rows)
    return {
        "enterprise_count": count,
        "high_risk_count": sum(row["risk_level"] == "high" for row in rows),
        "online_rate": round(sum(float(row["online_rate"]) for row in rows) / count, 1) if count else 0.0,
        "pending_signal_count": sum(int(row["pending_signal_count"]) for row in rows),
        "maintenance_overdue": sum(int(row["maintenance_overdue"]) for row in rows),
    }


def apply_monitoring_event(enterprise, event):
    updated = deepcopy(enterprise)
    event_type = event["event_type"]
    if event_type == "fire_alarm":
        updated["pending_signal_count"] = int(updated.get("pending_signal_count", 0)) + 1
        updated["health_score"] = max(0, int(updated.get("health_score", 100)) - 5)
        updated["risk_level"] = "high"
    elif event_type == "fault":
        updated["fault_count_30d"] = int(updated.get("fault_count_30d", 0)) + 1
        updated["health_score"] = max(0, int(updated.get("health_score", 100)) - 2)
    elif event_type == "maintenance_overdue":
        updated["maintenance_overdue"] = int(updated.get("maintenance_overdue", 0)) + 1
        updated["health_score"] = max(0, int(updated.get("health_score", 100)) - 3)
    return updated
