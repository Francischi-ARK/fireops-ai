import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

export const C = {
  bg: "#071018",
  panel: "#0d1922",
  line: "#243845",
  text: "#edf3f6",
  muted: "#81939f",
  red: "#ef4348",
  amber: "#f2a93b",
  green: "#2dd4a8",
};

export const enter = (frame: number, delay = 0, distance = 24): CSSProperties => {
  const p = interpolate(frame, [delay, delay + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return { opacity: p, transform: `translateY(${(1 - p) * distance}px)` };
};

export const Stage: React.FC<{ label: string; children: ReactNode }> = ({ label, children }) => {
  const frame = useCurrentFrame();
  const scan = interpolate(frame % 150, [0, 149], [-120, 2040]);
  return (
    <AbsoluteFill
      style={{
        color: C.text,
        fontFamily: 'Inter, "PingFang SC", "SF Pro Display", sans-serif',
        backgroundColor: C.bg,
        backgroundImage:
          "linear-gradient(rgba(53,78,92,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(53,78,92,.16) 1px,transparent 1px)",
        backgroundSize: "64px 64px",
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 70% 45%,rgba(33,73,91,.22),transparent 48%)" }} />
      <div style={{ position: "absolute", left: scan, top: 0, width: 1, height: "100%", background: "linear-gradient(transparent,rgba(93,151,178,.35),transparent)" }} />
      <div style={{ position: "absolute", top: 64, left: 88, right: 88, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 18, letterSpacing: 3, color: C.muted }}>
        <div>{label}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: 8, background: C.green, boxShadow: `0 0 18px ${C.green}` }} />
          LIVE EVIDENCE
        </div>
      </div>
      <div style={{ position: "absolute", left: 88, right: 88, top: 112, height: 1, background: C.line }} />
      {children}
    </AbsoluteFill>
  );
};
