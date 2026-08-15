import { interpolate, useCurrentFrame } from "remotion";
import { C, enter, Stage } from "../Style";

const evidence = [
  ["CRC", "校验通过", "RAW-7F2A"],
  ["CTRL", "控制器 01", "ASSET-001"],
  ["LOOP", "回路 03", "TOPO-03"],
  ["POINT", "PACK / 充电", "POINT-064"],
];

const tools = [
  ["resolve_signal", "RAW-7F2A", "完成"],
  ["load_point", "POINT-064", "完成"],
  ["search_manual", "DOC-FIRE-12", "引用"],
];

export const EvidenceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const path = interpolate(frame, [25, 115], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Stage label="FIREOPS / EVIDENCE GRAPH">
      <div style={{ position: "absolute", left: 96, top: 172, right: 96 }}>
        <h1 style={{ ...enter(frame, 4), margin: 0, fontSize: 78, letterSpacing: -3, fontWeight: 650 }}>这条报警从哪来</h1>
        <p style={{ ...enter(frame, 12), margin: "20px 0 0", color: C.muted, fontSize: 26 }}>原始报文、控制器、回路和点位，一项项对上。</p>
      </div>

      <div style={{ position: "absolute", left: 96, top: 390, width: 1030, height: 420 }}>
        <div style={{ position: "absolute", left: 68, right: 90, top: 88, height: 2, background: C.line }} />
        <div style={{ position: "absolute", left: 68, top: 88, width: `${path * 8.6}px`, maxWidth: 862, height: 2, background: C.red, boxShadow: `0 0 14px ${C.red}` }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 22 }}>
          {evidence.map(([kind, title, ref], i) => {
            const active = frame >= 24 + i * 22;
            return (
              <div key={kind} style={{ ...enter(frame, 18 + i * 20), position: "relative", paddingTop: 50 }}>
                <div style={{ position: "absolute", top: 75, left: 52, width: 28, height: 28, borderRadius: 28, background: active ? C.red : C.panel, border: `5px solid ${active ? C.red : C.line}`, boxShadow: active ? `0 0 24px ${C.red}` : "none" }} />
                <div style={{ marginTop: 92, padding: "24px 24px 22px", border: `1px solid ${active ? "#3d5664" : C.line}`, background: "rgba(13,25,34,.86)" }}>
                  <div style={{ fontSize: 16, letterSpacing: 2, color: C.muted }}>{kind}</div>
                  <div style={{ marginTop: 14, fontSize: 25, fontWeight: 650 }}>{title}</div>
                  <div style={{ marginTop: 28, fontFamily: '"SFMono-Regular", monospace', fontSize: 15, color: active ? C.green : C.muted }}>{ref}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ ...enter(frame, 58, 34), position: "absolute", right: 96, top: 330, width: 590, padding: 34, background: "rgba(9,20,28,.94)", border: `1px solid ${C.line}`, boxShadow: "0 28px 80px rgba(0,0,0,.34)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 25, borderBottom: `1px solid ${C.line}` }}>
          <div><span style={{ color: C.red }}>●</span> &nbsp;AGENT TRACE</div>
          <div style={{ color: C.muted, fontSize: 16 }}>RUN 00321</div>
        </div>
        {tools.map(([name, ref, status], i) => (
          <div key={name} style={{ ...enter(frame, 70 + i * 18, 16), display: "grid", gridTemplateColumns: "1.4fr 1fr auto", gap: 14, padding: "22px 0", borderBottom: `1px solid ${C.line}`, alignItems: "center" }}>
            <div style={{ fontFamily: '"SFMono-Regular", monospace', fontSize: 19 }}>{name}()</div>
            <div style={{ color: C.muted, fontSize: 16 }}>{ref}</div>
            <div style={{ color: C.green, fontSize: 16 }}>{status}</div>
          </div>
        ))}
        <div style={{ marginTop: 26, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {["工具只读", "引用已记录"].map((x) => <span key={x} style={{ padding: "9px 14px", border: `1px solid ${C.line}`, color: C.muted, fontSize: 16 }}>{x}</span>)}
        </div>
      </div>
    </Stage>
  );
};
