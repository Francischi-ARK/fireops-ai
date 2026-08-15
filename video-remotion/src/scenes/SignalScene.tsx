import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, enter, Stage } from "../Style";

export const SignalScene: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 0.65 + 0.35 * Math.sin(frame / 5);
  const packet = "01 03 00 64 00 02 C5 D4";
  const shown = packet.slice(0, Math.floor(interpolate(frame, [32, 92], [0, packet.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));

  return (
    <Stage label="FIREOPS / SIGNAL INTAKE">
      <div style={{ position: "absolute", left: 96, top: 206, width: 760 }}>
        <div style={{ ...enter(frame, 5), color: C.red, fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>MODBUS / EVENT 0x03</div>
        <h1 style={{ ...enter(frame, 10), margin: "28px 0 0", fontSize: 92, lineHeight: 1.06, letterSpacing: -4, fontWeight: 650 }}>
          电池车间
          <br />
          <span style={{ color: "#a9bac4" }}>火警信号 #1</span>
        </h1>
        <div style={{ ...enter(frame, 28), marginTop: 58, width: 650, padding: "26px 30px", border: `1px solid ${C.line}`, background: "rgba(7,16,24,.8)", fontFamily: '"SFMono-Regular", Menlo, monospace', fontSize: 28, letterSpacing: 4 }}>
          {shown}<span style={{ color: C.red, opacity: pulse }}>▌</span>
        </div>
        <div style={{ ...enter(frame, 55), marginTop: 20, display: "flex", gap: 26, fontSize: 19, color: C.muted }}>
          <span><b style={{ color: C.green }}>CRC PASS</b> / 18 ms</span>
          <span>控制器 01 · 回路 03</span>
        </div>
      </div>

      <div style={{ ...enter(frame, 24, 36), position: "absolute", right: 96, top: 188, width: 820, height: 710, overflow: "hidden", border: `1px solid ${C.line}`, borderRadius: 4, boxShadow: "0 28px 80px rgba(0,0,0,.38)" }}>
        <Img src={staticFile("shots/monitoring.png")} style={{ width: 1260, maxWidth: "none", transform: "translate(-250px,-20px)", filter: "saturate(.75) contrast(1.05)" }} />
        <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 90px rgba(7,16,24,.65)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 138, background: "linear-gradient(transparent 0%,#071018 42%)" }} />
        <div style={{ position: "absolute", left: 420, top: 330, width: 24, height: 24, borderRadius: 24, border: `4px solid ${C.red}`, transform: `scale(${pulse})`, boxShadow: `0 0 0 18px rgba(239,67,72,.12),0 0 32px ${C.red}` }} />
        <div style={{ position: "absolute", left: 450, top: 314, padding: "12px 18px", background: C.red, fontSize: 20, fontWeight: 700 }}>PACK / 充电区</div>
      </div>
    </Stage>
  );
};
