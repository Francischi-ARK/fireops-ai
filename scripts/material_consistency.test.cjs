const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const files = [
  "index.html",
  "README.md",
  "docs/demo-script.md",
  "docs/submission/architecture.md",
  "docs/submission/data-compliance.md",
  "docs/submission/eval-report.md",
  "docs/submission/project-intro-500.md",
  "docs/submission/run-guide.md",
];
const text = files.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
assert.equal(/FireGuard/.test(text), false, "competition-facing material contains FireGuard");
assert.equal(/政府监管|总队端|救援站端/.test(text), false, "competition-facing material contains government narrative");

const logo = path.join(root, "assets/fireops-logo.svg");
assert.equal(fs.existsSync(logo), true, "FireOps SVG logo missing");
const svg = fs.readFileSync(logo, "utf8");
assert.match(svg, /viewBox=/);
assert.equal(/<image|(?:href|src)=["']https?:\/\//.test(svg), false, "logo has an external dependency");
console.log("material consistency: ok");
