import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const HUNTS_DIR = "./data/hunts";

// Find the most recent benchmark hunt that can be resumed
function findLatestBenchHunt() {
  try {
    const dirs = fs.readdirSync(HUNTS_DIR).filter(d => d.startsWith("h_bench_"));
    if (dirs.length === 0) return null;

    // Sort by creation time (newest first) by reading meta.json
    const withMeta = dirs.map(d => {
      try {
        const metaPath = path.join(HUNTS_DIR, d, "meta.json");
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        return { id: d, meta, createdAt: meta.createdAt || "" };
      } catch { return null; }
    }).filter(Boolean)
      // Skip hunts that were explicitly stopped/failed so a dead fresh hunt
      // left by an earlier watchdog cycle does not shadow a live checkpoint.
      .filter(h => h.meta.state !== "stopped" && h.meta.state !== "failed" && !h.meta.stopped);

    withMeta.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return withMeta[0] || null;
  } catch { return null; }
}

// Probe the AI brain: true if dm-hunter answers a trivial prompt quickly.
// FIX (19 Oct 2026, solver #6): Heartbeat-aware. The 20s probe fails when the
// brain is BUSY doing a real hunt inference (10-15 min), causing the watchdog
// to mint fresh hunts instead of resuming. Check the inference heartbeat first:
// if backend is actively inferring (deadline in future), the brain is healthy.
async function brainHealthy() {
  // Check inference heartbeat — if backend is mid-inference, brain is busy but healthy.
  try {
    const hbPath = process.env.AI_HEARTBEAT_PATH || '/opt/Dark-Matter/.ai-inference-active';
    const hb = JSON.parse(fs.readFileSync(hbPath, 'utf8'));
    if (hb.deadline && hb.deadline > Date.now()) {
      console.log(`Brain busy (heartbeat fresh, hunt ${hb.huntId || 'unknown'}) — treating as healthy`);
      return true;
    }
  } catch { /* no heartbeat or unreadable — fall through to probe */ }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "dm-hunter", messages: [{ role: "user", content: "ok?" }], stream: false }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return res.ok;
  } catch { return false; }
}

const latest = findLatestBenchHunt();

// Pause reason lives in events.jsonl — the circuit breaker writes
// {type:"status",state:"paused",reason:...} there but does not always set
// meta.pauseReason, so a meta-only check misses resumable hunts.
function lastPauseReason(huntId) {
  try {
    const raw = fs.readFileSync(path.join(HUNTS_DIR, huntId, "events.jsonl"), "utf8").trim();
    if (!raw) return null;
    const lines = raw.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const e = JSON.parse(lines[i]);
      if (e.type === "status" && e.state === "paused") return e.reason || null;
    }
  } catch { /* unreadable log */ }
  return null;
}

// WATCHDOG FIX (18 Oct, hardened 19 Oct): hunts auto-paused by the circuit
// breaker on ai_no_reply mean "resume when it's responsive" — flip them back
// to running while the brain is healthy, so progress is kept instead of
// starting fresh.
let target = latest;
const unpauseable = latest && latest.meta.state === "paused" &&
  (latest.meta.pauseReason === "ai_no_reply" || lastPauseReason(latest.id) === "ai_no_reply");
if (unpauseable) {
  if (await brainHealthy()) {
    const metaPath = path.join(HUNTS_DIR, latest.id, "meta.json");
    const meta = { ...latest.meta, state: "running", paused: false, pauseReason: null };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    fs.appendFileSync(path.join(HUNTS_DIR, latest.id, "events.jsonl"),
      JSON.stringify({ type: "status", state: "watchdog_unpause", at: new Date().toISOString() }) + "\n");
    console.log(`WATCHDOG UNPAUSE: ${latest.id} (brain healthy, resuming from iteration ${latest.meta.iteration || 0})`);
    target = { id: latest.id, meta, createdAt: latest.createdAt };
  } else {
    console.log(`Brain not healthy; leaving ${latest.id} paused for this cycle`);
    target = null;
  }
}

if (target && target.meta.state === "running") {
  console.log(`RESUMING hunt ${target.id} from iteration ${target.meta.iteration || 0}`);
  const { resumeInterruptedHunt } = await import("./src/huntAgent.js");
  const resumed = await resumeInterruptedHunt(target.id);
  if (resumed) {
    console.log(`BENCH_HUNT_ID=${target.id} (resumed)`);
  } else {
    console.log(`Resume failed for ${target.id}, creating fresh hunt`);
  }
}

// If no resumable hunt, create a fresh one (original bench_run.mjs logic)
if (!target || target.meta.state !== "running") {
  const huntId = "h_bench_" + randomUUID().slice(0, 8);
  const meta = {
    huntId,
    target: "http://172.17.0.1:3000",
    scope: "BENCHMARK LAB: OWASP Juice Shop v17.3.0. Owner-authorized capability benchmark.",
    parsedScope: { target: "http://172.17.0.1:3000", domain: "172.17.0.1", inScope: ["172.17.0.1"], outOfScope: [], rules: { noDoS: true, noHeavyScan: false, maxRequestsPerMin: 60 }, rawScope: "benchmark" },
    mode: "normal",
    userId: "d061b05a-d1e1-4bdb-b50d-3df2e0211460",
    createdAt: new Date().toISOString(),
    authorized: true,
    state: "running",
    paused: false,
    stopped: false,
    iteration: 0,
  };
  fs.mkdirSync("./data/hunts/" + huntId, { recursive: true });
  fs.writeFileSync("./data/hunts/" + huntId + "/meta.json", JSON.stringify(meta, null, 2));
  fs.writeFileSync("./data/hunts/" + huntId + "/events.jsonl", "");
  console.log("BENCH_HUNT_ID=" + huntId + " (fresh)");
  const { runAutonomousHunt } = await import("./src/huntAgent.js");
  await runAutonomousHunt(huntId, meta.target, "normal", meta.userId);
  console.log("hunt loop exited");
}
