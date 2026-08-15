import { Audio } from "@remotion/media";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

const C = { ink: "#18171d", muted: "#6f6b78", violet: "#7654f6", soft: "#f4f1ff", red: "#e43137", line: "#e6e2ea" };

const scenes = [
  { start: 0, end: 510, kicker: "问题不在收到报警", title: "报警响了\n工作才刚开始", body: "主机、点位表、群消息和纸质手册来回对照。\n信号收到了，责任却容易断在交接里。", shots: [] },
  { start: 510, end: 1020, kicker: "01 / 同一个事件", title: "先把位置和证据\n放到人面前", body: "控制器、回路、点位、相邻探测器、设备状态和视频复核，\n不再分散在不同页面。", shots: ["monitoring-light.png"] },
  { start: 1020, end: 1500, kicker: "02 / 评委引导演示", title: "一键开始\n只在三处等人", body: "AI 自动跑研判、工具调用和班组模拟。\n火情核实、派单批准、最终归档必须由人确认。", shots: ["judge-entry.png", "judge-approval.png", "judge-complete.png"] },
  { start: 1500, end: 1980, kicker: "03 / AI 的真实作用", title: "不是聊天入口\n是证据整理器", body: "连接点位台账、手册、维保记录和历史事件。\n交付引用、工具轨迹和岗位简报；证据不足就停下来。", shots: ["copilot-evidence.png", "safe-abstention.png"] },
  { start: 1980, end: 2340, kicker: "04 / 三条闭环", title: "火警、维修、巡查\n都落到责任人", body: "故障进入维修链；巡查先形成草稿，\n整改完成后仍要复查，才算真正关闭。", shots: ["fault-done.png", "inspection-draft.png", "inspection-closed.png"] },
  { start: 2340, end: 2700, kicker: "最终产出", title: "留下证据链\n不只是一段回答", body: "事件、工单、隐患、责任人和时间戳可以回溯。\n让 AI 进入消防现场，但不越过现场的人。", shots: ["dossier.png"] },
];

const Frame: React.FC<{ src: string; index: number; local: number; count: number }> = ({ src, index, local, count }) => {
  const progress = interpolate(local, [18 + index * 12, 42 + index * 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const width = count === 1 ? 960 : count === 2 ? 650 : 360;
  return <div style={{ width, height: count === 1 ? 640 : 500, overflow: "hidden", border: `1px solid ${C.line}`, borderRadius: 18, background: "white", boxShadow: "0 30px 80px rgba(37,27,73,.13)", opacity: progress, translate: `0 ${(1 - progress) * 34}px`, rotate: `${(index - (count - 1) / 2) * 1.4}deg` }}>
    <Img src={staticFile(`shots/${src}`)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
  </div>;
};

export const FireOpsDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const scene = scenes.find((item) => frame >= item.start && frame < item.end) ?? scenes[scenes.length - 1];
  const local = frame - scene.start;
  const enter = interpolate(local, [0, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const leave = interpolate(frame, [scene.end - 18, scene.end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const p = Math.min(enter, leave);
  return <AbsoluteFill style={{ overflow: "hidden", color: C.ink, fontFamily: 'Inter, "PingFang SC", "SF Pro Display", sans-serif', background: "#fbfafc" }}>
    <Audio src={staticFile("audio/narration-full.wav")} volume={0.92} playbackRate={1.0551213} />
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 78% 35%,#eee9ff 0,transparent 38%)" }} />
    <header style={{ position: "absolute", top: 52, left: 72, right: 72, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.line}`, paddingBottom: 24 }}>
      <strong style={{ fontSize: 25 }}>FireOps AI</strong><span style={{ color: C.muted, fontSize: 17 }}>工业消防运维 Agent</span>
    </header>
    <main style={{ position: "absolute", inset: "130px 72px 70px", opacity: p }}>
      <div style={{ position: "absolute", left: 0, top: 80, width: scene.shots.length ? 680 : 1180, translate: `0 ${(1 - enter) * 22}px` }}>
        <div style={{ color: scene.start === 0 ? C.red : C.violet, fontSize: 20, fontWeight: 750 }}>{scene.kicker}</div>
        <h1 style={{ margin: "28px 0 30px", whiteSpace: "pre-line", fontSize: scene.shots.length ? 80 : 108, lineHeight: 1.06, letterSpacing: -5, fontWeight: 720 }}>{scene.title}</h1>
        <p style={{ margin: 0, whiteSpace: "pre-line", color: C.muted, fontSize: 25, lineHeight: 1.75 }}>{scene.body}</p>
      </div>
      {scene.shots.length > 0 && <div style={{ position: "absolute", right: -40, top: 55, width: 1050, height: 720, display: "flex", gap: 24, alignItems: "center", justifyContent: "center" }}>
        {scene.shots.map((src, index) => <Frame key={src} src={src} index={index} local={local} count={scene.shots.length} />)}
      </div>}
      {scene.start === 0 && <div style={{ position: "absolute", right: 40, bottom: 90, display: "grid", gridTemplateColumns: "repeat(4, 180px)", gap: 1, background: C.line }}>
        {["主机信号", "点位表", "群消息", "纸质手册"].map((label, i) => <div key={label} style={{ padding: "34px 24px", background: i === 3 ? C.soft : "white", fontSize: 22, textAlign: "center" }}>{label}</div>)}
      </div>}
    </main>
    <footer style={{ position: "absolute", left: 72, right: 72, bottom: 34, display: "flex", alignItems: "center", gap: 18, color: C.muted, fontSize: 15 }}><span>{String(Math.floor(frame / 30)).padStart(2, "0")}s</span><div style={{ flex: 1, height: 3, background: C.line }}><div style={{ width: `${frame / 2700 * 100}%`, height: "100%", background: C.violet }} /></div><span>90s</span></footer>
  </AbsoluteFill>;
};
