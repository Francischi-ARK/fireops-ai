const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = ["index.html", "app.js"].map((file) =>
  fs.readFileSync(path.join(root, file), "utf8")).join("\n");

const actions = new Set([...source.matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]));
const handled = new Set([
  ...[...source.matchAll(/action === "([^"]+)"/g)].map((match) => match[1]),
  ...[...source.matchAll(/button\.dataset\.action === "([^"]+)"/g)].map((match) => match[1]),
]);
const missing = [...actions].filter((action) => !handled.has(action));

assert.deepEqual(missing, [], "unhandled data-action values: " + missing.join(", "));
assert.equal(source.includes("该功能将在下一阶段接入真实数据"), false, "generic action fallback remains");
assert.equal(
  source.includes('["approved", "in_progress"].includes(selected.status)'),
  false,
  "approved workorder still exposes completion before start",
);
assert.equal(
  source.includes("交回消控室核验归档"),
  true,
  "submitted field report has no handoff to duty desk",
);
assert.match(
  source,
  /async function runCopilotScenario\(\) \{[\s\S]*?setDemoActor\("duty-demo"\)/,
  "a new Copilot run must restore the duty actor before approval steps",
);
assert.match(
  source,
  /function resetCopilot\(\) \{[\s\S]*?setDemoActor\("duty-demo"\)/,
  "resetting Copilot must restore the duty actor",
);
assert.match(source, /data-copilot-action="judge-run"/, "judge demo entry is missing");
assert.match(source, /action === "judge-run"[\s\S]*?startJudgeDemo\(\)/, "judge demo entry is not handled");
assert.match(source, /B-confirmed-fire-battery-workorder/, "judge demo must use the confirmed-fire scenario");
assert.match(
  source,
  /async function runJudgeCrewSimulation\(\)[\s\S]*?"acknowledge"[\s\S]*?"depart"[\s\S]*?"arrive"[\s\S]*?\/report/,
  "judge demo must show crew acknowledgement, departure, arrival and field report",
);
assert.match(source, /copilotState\.offline = true/, "backend failure must enable offline judge mode");
assert.match(source, /function buildOfflineCopilotRun\(/, "offline judge mode needs a local auditable run");
assert.match(source, /data-copilot-action="offline-archive"/, "offline judge flow needs its third human gate");
assert.match(source, /action === "offline-archive"[\s\S]*?archiveOfflineJudgeDemo\(\)/, "offline archive gate is not handled");

const buttons = [...source.matchAll(/<button\b([^>]*)>/g)].map((match) => match[1]);
const unexplained = buttons.filter((attrs) =>
  !/(data-|\bid=|\bvalue=|\bdisabled\b|type="submit")/.test(attrs));
assert.deepEqual(unexplained, [], "buttons without handler or disabled reason: " + unexplained.join(" | "));

console.log("action contract: ok");
