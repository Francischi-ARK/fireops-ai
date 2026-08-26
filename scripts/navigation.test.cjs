const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const engine = require("../engine.cjs");

const topNav = [...html.matchAll(/data-top-nav="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
  .map((match) => ({ id: match[1], label: match[2].trim() }));
assert.deepEqual(topNav, [
  { id: "home", label: "首页" },
  { id: "emergency", label: "应急处置" },
  { id: "prevention", label: "日常防控" },
  { id: "operations", label: "设施运维" },
  { id: "analysis", label: "分析复盘" },
  { id: "assets", label: "资产与空间" },
]);

const roleOptions = [...html.matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)]
  .filter(([, id]) => engine.roleDefinitions().some((role) => role.id === id));
assert.deepEqual(roleOptions.map(([, id]) => id), engine.roleDefinitions().map((role) => role.id));
assert.equal(roleOptions.length, 8);
assert.doesNotMatch(html, />流程监管<\/a>|>网格待办<\/a>|>单元档案<\/a>/);

console.log("navigation contract: ok");
