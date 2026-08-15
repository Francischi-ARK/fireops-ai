import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, enter, Stage } from "../Style";

export const HumanGateScene: React.FC = () => {
  const frame = useCurrentFrame();
  const click = interpolate(frame, [65, 72, 86], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const confirmed = frame >= 74;
  return (
    <Stage label="FIREOPS / HUMAN GATE">
      <div style={{ position: "absolute", left: 96, top: 185, width: 665 }}>
        <div style={{ ...enter(frame, 4), color: C.amber, fontSize: 21, fontWeight: 700, letterSpacing: 2 }}>DECISION CONTROL</div>
        <h1 style={{ ...enter(frame, 9), margin: "26px 0 0", fontSize: 86, lineHeight: 1.08, letterSpacing: -4, fontWeight: 650 }}>Copilot 查资料<br />值班员做决定</h1>
        <p style={{ ...enter(frame, 20), margin: "38px 0 0", color: C.muted, fontSize: 27, lineHeight: 1.6 }}>设备资料和处置预案交给 Copilot 查。<br />是否确认火警，交给值班员。</p>
        <div style={{ ...enter(frame, 34), marginTop: 55, display: "flex", alignItems: "center", gap: 16, fontSize: 18 }}>
          <span style={{ padding: "12px 16px", border: `1px solid ${C.line}` }}>AI SUGGESTION</span>
          <span style={{ color: C.muted }}>→</span>
          <span style={{ padding: "12px 16px", background: C.amber, color: C.bg, fontWeight: 800 }}>HUMAN GATE</span>
          <span style={{ color: C.muted }}>→</span>
          <span style={{ padding: "12px 16px", border: `1px solid ${confirmed ? C.green : C.line}`, color: confirmed ? C.green : C.muted }}>{confirmed ? "已确认" : "待核实"}</span>
        </div>
      </div>

      <div style={{ ...enter(frame, 18, 38), position: "absolute", right: 96, top: 168, width: 920, height: 730, overflow: "hidden", border: `1px solid ${C.line}`, background: C.panel, boxShadow: "0 30px 90px rgba(0,0,0,.4)" }}>
        <Img src={staticFile("shots/fire-verify.png")} style={{ width: 3000, maxWidth: "none", transform: "translate(0,-170px)", filter: "saturate(.8) contrast(1.08)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent 42%,rgba(7,16,24,.94) 67%)" }} />
        <div style={{ position: "absolute", left: 203, top: 248, width: 210, height: 84, border: `3px solid ${C.red}`, boxShadow: `0 0 ${14 + click * 24}px rgba(239,67,72,.72)` }} />
        <div style={{ position: "absolute", left: 365, top: 289, width: 16, height: 16, borderRadius: 16, background: "white", transform: `scale(${1 + click * 0.7})`, boxShadow: `0 0 0 ${click * 20}px rgba(239,67,72,.3)` }} />
        <div style={{ position: "absolute", right: 34, bottom: 34, width: 360, padding: "26px 28px", background: "rgba(7,16,24,.96)", borderLeft: `4px solid ${confirmed ? C.green : C.amber}` }}>
          <div style={{ fontSize: 16, color: C.muted, letterSpacing: 2 }}>INCIDENT STATUS</div>
          <div style={{ marginTop: 13, fontSize: 34, fontWeight: 700, color: confirmed ? C.green : C.amber }}>{confirmed ? "已确认 · 进入调度" : "待人工核实"}</div>
        </div>
      </div>
      <div style={{ ...enter(frame, 105), position: "absolute", left: 96, bottom: 72, color: C.muted, fontSize: 20, letterSpacing: 2 }}>Copilot 不能直接提交事故状态</div>
    </Stage>
  );
};
