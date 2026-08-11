"""防火巡查多模态草稿：演示级图像规则 + 语音文本补全。

不调用真实视觉/ASR 模型；按证据图片资产与语音关键词做确定性识别，
供本地 Demo / 评审复现。高风险派发仍须人工确认。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


# 演示资产指纹：文件名/路径片段 → 隐患模板
IMAGE_CATALOG: List[Dict[str, Any]] = [
    {
        "match": ["extinguisher", "灭火器"],
        "title": "灭火器被遮挡",
        "category": "现场隐患",
        "severity": "high",
        "location": "PACK 产线 · 通道东侧",
        "description": "现场照片显示灭火器被物料箱遮挡，紧急情况下无法快速取用。",
        "department": "生产部",
        "owner": "李强",
        "tag": "现场隐患",
        "pin": {"left": 78, "top": 46},
        "confidence": 0.86,
    },
    {
        "match": ["exit-sign", "exit_sign", "疏散", "指示"],
        "title": "疏散指示标志故障",
        "category": "设备故障",
        "severity": "high",
        "location": "化成区 · 西侧通道",
        "description": "疏散指示灯不亮或标识残损，夜间无法辨识疏散方向。",
        "department": "工程部",
        "owner": "王磊",
        "tag": "设备故障",
        "pin": {"left": 14, "top": 66},
        "confidence": 0.84,
    },
    {
        "match": ["control-room", "control_room", "值班", "消控"],
        "title": "消控室值班记录问题",
        "category": "管理隐患",
        "severity": "medium",
        "location": "消防控制室（电池车间）",
        "description": "值班记录填写不完整，未完整记录火警处置与交接事项。",
        "department": "安保部",
        "owner": "张伟",
        "tag": "重复隐患",
        "pin": {"left": 43, "top": 47},
        "confidence": 0.81,
    },
]

VOICE_HINTS = [
    (("灭火器", "遮挡", "挡着"), "extinguisher"),
    (("疏散", "指示灯", "出口灯"), "exit-sign"),
    (("值班", "记录", "消控"), "control-room"),
]

# 厂区单元默认网格责任人（演示）
AREA_OWNERS = {
    "ent-001": {"owner": "李强", "department": "生产部", "role": "网格责任人"},
    "ent-005": {"owner": "赵敏", "department": "涂装生产部", "role": "网格责任人"},
    "ent-002": {"owner": "陈刚", "department": "总装生产部", "role": "网格责任人"},
    "ent-003": {"owner": "周倩", "department": "仓储部", "role": "网格责任人"},
    "ent-004": {"owner": "孙磊", "department": "冲压生产部", "role": "网格责任人"},
}

DEMO_ASSETS = [
    "assets/evidence-extinguisher-blocked.png",
    "assets/evidence-exit-sign-fault.png",
    "assets/evidence-control-room-log.png",
]


def _pick_template(image_asset: str, voice_text: str) -> Optional[Dict[str, Any]]:
    blob = f"{image_asset or ''} {voice_text or ''}".lower()
    for item in IMAGE_CATALOG:
        if any(token.lower() in blob for token in item["match"]):
            return item
    # 语音单独提示时，映射到同名模板
    text = voice_text or ""
    for keywords, key in VOICE_HINTS:
        if any(word in text for word in keywords):
            for item in IMAGE_CATALOG:
                if key in item["match"]:
                    return item
    return None


def analyze_inspection(
    enterprise_id: str,
    image_asset: str = "",
    voice_text: str = "",
) -> Dict[str, Any]:
    """根据图片资产与语音文本生成隐患草稿（不落库）。"""
    template = _pick_template(image_asset, voice_text)
    owner_info = AREA_OWNERS.get(enterprise_id, {"owner": "未知", "department": "未知", "role": "网格责任人"})
    voice = (voice_text or "").strip()

    if template is None:
        return {
            "recognized": False,
            "abstained": True,
            "confidence": 0.0,
            "title": "未识别到明确隐患",
            "category": "unknown",
            "severity": "low",
            "location": "未知",
            "description": "图片与语音证据不足，Agent 不编造隐患结论，请补充清晰现场照片或口述要点后重试。",
            "department": owner_info["department"],
            "owner": owner_info["owner"],
            "tag": "待补充",
            "pin": {"left": 50, "top": 50},
            "voice_summary": voice or "（无语音备注）",
            "image_asset": image_asset or "",
            "missing_fields": ["hazard_type", "location", "severity"],
            "evidence_refs": [],
            "disclaimer": "识别结果仅供辅助，不替代现场检查与专业判断；派发须人工确认。",
        }

    description = template["description"]
    if voice:
        description = f"{description} 巡查员口述补充：{voice}"

    return {
        "recognized": True,
        "abstained": False,
        "confidence": template["confidence"],
        "title": template["title"],
        "category": template["category"],
        "severity": template["severity"],
        "location": template["location"],
        "description": description,
        "department": template["department"] or owner_info["department"],
        "owner": template["owner"] or owner_info["owner"],
        "tag": template["tag"],
        "pin": template["pin"],
        "voice_summary": voice or "（无语音备注）",
        "image_asset": image_asset or DEMO_ASSETS[0],
        "missing_fields": [],
        "evidence_refs": [
            f"image:{image_asset or 'demo'}",
            f"voice:note" if voice else "voice:none",
            f"owner:{template['owner']}",
        ],
        "disclaimer": "识别结果仅供辅助，不替代现场检查与专业判断；派发须人工确认。",
    }


def scan_overdue_maintenance(rows: List[Dict[str, Any]], enterprise_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """从维保 CSV 行筛选逾期项，生成维修工单草稿建议。"""
    drafts = []
    for row in rows:
        if enterprise_id and row.get("enterprise_id") != enterprise_id:
            continue
        if (row.get("status") or "").lower() != "overdue":
            continue
        drafts.append({
            "maintenance_id": row.get("maintenance_id"),
            "enterprise_id": row.get("enterprise_id"),
            "facility_type": row.get("facility_type"),
            "maintenance_type": row.get("maintenance_type"),
            "planned_at": row.get("planned_at"),
            "summary": (
                f"预防性维保逾期：{row.get('facility_type')} · {row.get('maintenance_type')}。"
                f"建议派发维保组现场处理并回填完成记录。"
            ),
            "recommended_crew_id": "crew-wb-01",
            "requires_approval": "workorder_dispatch",
            "evidence_refs": [row.get("maintenance_id"), row.get("raw_ref")],
        })
    return drafts
