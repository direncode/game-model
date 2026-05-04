#!/usr/bin/env node
// npx wrapper: auto-installs `ocean-mcp` PyPI package on first run, then
// executes it. Forwards stdin/stdout transparently so MCP framing isn't
// disturbed.

"use strict";

const { spawn, spawnSync } = require("child_process");
const path = require("path");

function findPython() {
  const candidates = ["python3", "python"];
  for (const cmd of candidates) {
    const r = spawnSync(cmd, ["--version"], { stdio: "ignore" });
    if (r.status === 0) return cmd;
  }
  console.error("[ocean-mcp] could not find python3 or python on PATH; install Python 3.11+");
  process.exit(127);
}

function pipShow(python, pkg) {
  const r = spawnSync(python, ["-m", "pip", "show", pkg], { stdio: "ignore" });
  return r.status === 0;
}

function pipInstall(python) {
  console.error("[ocean-mcp] installing the Python package on first run…");
  const r = spawnSync(python, ["-m", "pip", "install", "--user", "ocean-mcp"], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error("[ocean-mcp] pip install failed; you may need to run: python3 -m pip install ocean-mcp");
    process.exit(r.status || 1);
  }
}

const python = findPython();
if (!pipShow(python, "ocean-mcp")) pipInstall(python);

const child = spawn(python, ["-m", "ocean_mcp.cli"], {
  stdio: "inherit",
  env:   process.env,
});
child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (e) => {
  console.error("[ocean-mcp] failed to spawn:", e.message);
  process.exit(1);
});
