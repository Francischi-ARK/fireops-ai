"""Incident Copilot orchestration: one agent plus a deterministic tool layer.

Scenario mode replays the curated fixtures offline. Live mode makes one
disclosed OpenAI-compatible call for the non-deterministic parts (intent,
extraction, follow-up questions, summaries); every tool call still goes
through ToolGuard, and any model failure falls back to the deterministic
template so a demo can never be bricked by the provider.
"""

import asyncio
import json
import os
import urllib.request
from pathlib import Path
from typing import Optional, Tuple

from pydantic import ValidationError

from .copilot_schema import AgentPlan, CopilotRunCreate, CopilotRunResult, ToolCall, ToolTraceEntry
from .copilot_tools import RunContext, ToolGuard, validate_evidence

SCENARIOS_PATH = Path(__file__).resolve().parents[2] / "demo-data" / "copilot_scenarios.json"

TEMPLATE_MODEL_NAME = "deterministic-template"

SYSTEM_PROMPT = (
    "你是 FireGuard 消防协同 Copilot，处理合成演示数据。只输出 JSON，字段："
    "intent(signal_verification|incident_dispatch_support|unknown), missing_fields[], plan[], "
    "tool_calls[{name,arguments}], evidence[{ref,kind}], draft_outputs{}, risks[], "
    "approval_required[], abstained(bool)。"
    "可用工具：get_signal_context(event_id), get_site_packet(enterprise_id), "
    "get_maintenance_context(enterprise_id), find_missing_fields(reporter_text,known_fields), "
    "create_verification_draft(event_id,note), recommend_station(enterprise_id), "
    "create_dispatch_draft(incident_id,station_id), build_role_brief(incident_id,role)。"
    "规则：不编造证据编号，证据只能引用工具返回过的 ref；核实、调派等高风险动作只生成草稿；"
    "信息不足时 abstained=true 并在 missing_fields 列出缺口。"
)


class OpenAICompatibleClient:
    """One disclosed provider call, stdlib only. Default endpoint is the
    ModelScope free inference API; override with COPILOT_MODEL_* env vars."""

    def __init__(self, base_url=None, api_key=None, model=None, timeout=20.0):
        self.base_url = (base_url or os.getenv("COPILOT_MODEL_BASE_URL", "https://api-inference.modelscope.cn/v1")).rstrip("/")
        self.api_key = api_key if api_key is not None else os.getenv("COPILOT_MODEL_API_KEY", "")
        self.model = model or os.getenv("COPILOT_MODEL_NAME", "Qwen/Qwen3-235B-A22B-Instruct-2507")
        self.timeout = timeout

    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        body = json.dumps({
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }).encode("utf-8")

        def _post():
            request = urllib.request.Request(
                f"{self.base_url}/chat/completions", data=body,
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"},
            )
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
            return payload["choices"][0]["message"]["content"]

        return await asyncio.to_thread(_post)


class CopilotEngine:
    def __init__(self, provider, model_client=None, scenarios_path=SCENARIOS_PATH, model_timeout=25.0):
        self.guard = ToolGuard(provider)
        self.provider = provider
        self.model_client = model_client
        self.model_timeout = model_timeout
        self.document = json.loads(Path(scenarios_path).read_text(encoding="utf-8"))
        self.scenarios = {s["scenario_id"]: s for s in self.document["scenarios"]}

    def scenarios_document(self):
        return {"data_cutoff": self.document.get("data_cutoff"),
                "scenarios": list(self.scenarios.values())}

    async def run(self, create: CopilotRunCreate, approvals=None) -> CopilotRunResult:
        ctx = RunContext(
            enterprise_id=create.enterprise_id,
            event_id=create.event_id,
            incident_id=create.incident_id,
            approvals=set(approvals or ()),
        )
        await self._hydrate(ctx)
        scenario = self.scenarios.get(create.scenario_id or "")
        plan, model_name, fallback_reason = await self._plan(create, scenario, ctx)

        trace = []
        for call in plan.tool_calls:
            result = await self.guard.execute(call, ctx)
            trace.append(ToolTraceEntry(
                name=call.name, arguments=call.arguments, ok=result.ok,
                error=result.error, data=result.data if result.ok else {},
                evidence_refs=[ref.ref for ref in result.evidence],
            ))

        if model_name == TEMPLATE_MODEL_NAME:
            plan.evidence = list(ctx.collected_evidence)
            rejected = []
        else:
            rejected = validate_evidence(plan, ctx.collected_evidence)

        return CopilotRunResult(
            scenario_id=create.scenario_id, incident_id=ctx.incident_id,
            mode=create.mode, model_name=model_name,
            status="abstained" if plan.abstained else "completed",
            plan=plan, trace=trace, rejected_evidence=rejected,
            fallback_reason=fallback_reason,
        )

    async def _hydrate(self, ctx: RunContext):
        if ctx.event_id is None:
            return
        signal = await self.provider.get_signal(ctx.event_id)
        if not signal:
            return
        ctx.verification_status = signal.get("verification_status", "pending")
        if ctx.verification_status == "confirmed" and ctx.incident_id is None:
            incident = await self.provider.get_incident_by_event(ctx.event_id)
            if incident:
                ctx.incident_id = incident["id"]

    async def _plan(self, create, scenario, ctx) -> Tuple[AgentPlan, str, Optional[str]]:
        if create.mode == "scenario":
            if scenario is None:
                raise ValueError("unknown_scenario")
            return self._template_plan(scenario, create, ctx), TEMPLATE_MODEL_NAME, None

        if self.model_client is not None:
            try:
                raw = await asyncio.wait_for(
                    self.model_client.complete(SYSTEM_PROMPT, self._user_prompt(create, ctx)),
                    timeout=self.model_timeout,
                )
                plan = AgentPlan.model_validate(json.loads(raw))
                return plan, self.model_client.model, None
            except asyncio.TimeoutError:
                fallback = "model_timeout"
            except (json.JSONDecodeError, ValidationError, KeyError):
                fallback = "model_invalid_output"
            except Exception:
                fallback = "model_unavailable"
        else:
            fallback = "model_unavailable"
        return self._template_plan(scenario, create, ctx), TEMPLATE_MODEL_NAME, fallback

    def _user_prompt(self, create, ctx) -> str:
        return json.dumps({
            "enterprise_id": create.enterprise_id,
            "event_id": create.event_id,
            "verification_status": ctx.verification_status,
            "reporter_text": create.reporter_text,
            "images": create.image_assets,
        }, ensure_ascii=False)

    def _template_plan(self, scenario, create, ctx) -> AgentPlan:
        if scenario is None:
            calls = []
            if create.event_id is not None:
                calls.append(ToolCall(name="get_signal_context", arguments={"event_id": create.event_id}))
            calls.append(ToolCall(name="find_missing_fields", arguments={
                "reporter_text": create.reporter_text, "known_fields": {}}))
            return AgentPlan(intent="unknown", plan=["信息不足，转人工处理"], tool_calls=calls,
                             missing_fields=["任务场景"], abstained=True,
                             risks=["未匹配到已知场景，按安全拒答处理"])

        sid = scenario["scenario_id"]
        text = create.reporter_text or scenario["input"]["reporter_text"]
        approved = scenario["human_approval_points"]

        if sid == "C-insufficient-data-safe-abstention":
            return AgentPlan(
                intent="signal_verification",
                missing_fields=list(scenario["expected_missing_fields"]),
                plan=["读取信号上下文", "读取企业档案", "列出信息缺口并转人工"],
                tool_calls=[
                    ToolCall(name="get_signal_context", arguments={"event_id": create.event_id}),
                    ToolCall(name="get_site_packet", arguments={"enterprise_id": create.enterprise_id}),
                    ToolCall(name="find_missing_fields", arguments={"reporter_text": text, "known_fields": {}}),
                ],
                risks=["企业数据长期断报，上报信息模糊", "不满足任何处置建议的证据门槛"],
                abstained=True,
            )

        if sid == "A-false-alarm-maintenance-adjacent":
            return AgentPlan(
                intent="signal_verification",
                missing_fields=list(scenario["expected_missing_fields"]),
                plan=["读取信号上下文", "比对维保记录", "生成待核实草稿"],
                tool_calls=[
                    ToolCall(name="get_signal_context", arguments={"event_id": create.event_id}),
                    ToolCall(name="get_maintenance_context", arguments={"enterprise_id": create.enterprise_id}),
                    ToolCall(name="find_missing_fields", arguments={"reporter_text": text, "known_fields": {}}),
                    ToolCall(name="create_verification_draft", arguments={
                        "event_id": create.event_id, "note": "报警与当月维保测试时间相邻，疑似测试引起，需现场核实"}),
                ],
                risks=["信号与维保测试时间相邻，存在误报可能"],
                approval_required=list(approved),
            )

        # B: confirmed fire. Phase one stops at verification; after a human
        # confirms, the same run continues to dispatch draft and role briefs.
        calls = [
            ToolCall(name="get_signal_context", arguments={"event_id": create.event_id}),
            ToolCall(name="get_site_packet", arguments={"enterprise_id": create.enterprise_id}),
            ToolCall(name="get_maintenance_context", arguments={"enterprise_id": create.enterprise_id}),
            ToolCall(name="find_missing_fields", arguments={"reporter_text": text, "known_fields": {}}),
            ToolCall(name="create_verification_draft", arguments={
                "event_id": create.event_id, "note": "多点证据一致，建议立即核实并准备调派"}),
            ToolCall(name="recommend_station", arguments={"enterprise_id": create.enterprise_id}),
        ]
        steps = ["读取信号与场地证据", "生成事件简报", "推荐辖区首战站点"]
        if ctx.verification_status == "confirmed" and ctx.incident_id is not None:
            station_id = scenario["expected_outputs"]["recommended_station_ids"][0]
            calls.append(ToolCall(name="create_dispatch_draft", arguments={
                "incident_id": ctx.incident_id, "station_id": station_id}))
            for role in ("commander", "station", "enterprise"):
                calls.append(ToolCall(name="build_role_brief", arguments={
                    "incident_id": ctx.incident_id, "role": role}))
            steps += ["生成调派草稿（待人工下达）", "生成指挥台/站端/企业端三份交付"]
        return AgentPlan(
            intent="incident_dispatch_support",
            missing_fields=list(scenario["expected_missing_fields"]),
            plan=steps,
            tool_calls=calls,
            risks=["有人员失联报告", "涉锂电池危险源"],
            approval_required=list(approved),
        )
