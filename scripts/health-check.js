#!/usr/bin/env node
/* eslint-disable */
/**
 * Hit the /health endpoint of every service and print a summary table.
 * Exits non-zero if any service is unhealthy.
 *
 * Usage:
 *   node scripts/health-check.js
 */
const targets = [
  { name: "Backend (NestJS)", url: (process.env.API_URL || "http://localhost:3001") + "/api/health" },
  { name: "Reference analyzer", url: (process.env.REFERENCE_ANALYZER_URL || "http://localhost:8001") + "/health" },
  { name: "Clip analyzer",     url: (process.env.CLIP_ANALYZER_URL || "http://localhost:8002") + "/health" },
  { name: "Timeline builder",  url: (process.env.TIMELINE_BUILDER_URL || "http://localhost:8003") + "/health" },
  { name: "Renderer",          url: (process.env.RENDERER_URL || "http://localhost:8004") + "/health" },
  { name: "Style engine",      url: (process.env.STYLE_ENGINE_URL || "http://localhost:8005") + "/health" },
  { name: "Feedback engine",   url: (process.env.FEEDBACK_ENGINE_URL || "http://localhost:8006") + "/health" },
];

const TIMEOUT_MS = 5000;

async function checkOne(t) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const r = await fetch(t.url, { signal: ctl.signal });
    const ms = Date.now() - start;
    const body = await r.json().catch(() => ({}));
    const status = r.ok && (body.status === "ok" || body.status === undefined) ? "OK" : "DEGRADED";
    return { name: t.name, url: t.url, status, ms, body };
  } catch (e) {
    return { name: t.name, url: t.url, status: "DOWN", ms: Date.now() - start, body: e.message };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log("\nVisionCut AI — health check\n");
  console.log("Service".padEnd(28) + "Status".padEnd(12) + "Latency   Detail");
  console.log("─".repeat(80));
  const results = await Promise.all(targets.map(checkOne));
  let allOk = true;
  for (const r of results) {
    console.log(
      r.name.padEnd(28) +
        r.status.padEnd(12) +
        `${r.ms}ms`.padEnd(10) +
        JSON.stringify(r.body).slice(0, 50)
    );
    if (r.status !== "OK") allOk = false;
  }
  console.log();
  process.exit(allOk ? 0 : 1);
}

main();
