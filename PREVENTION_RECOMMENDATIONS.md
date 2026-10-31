# PREVENTION RECOMMENDATIONS — Infrastructure Reliability

**Date:** 1 Nov 2026  
**Issue:** 514 zombie processes, 97% memory, 100% swap on EC2

---

## 1. Child-Process Cleanup and Reaping

### Root Cause
Hunt containers use `sleep infinity` as PID 1. `sleep` never calls `wait()`, so exited children (XFCE desktop, chromium) become zombies.

### Fix (IMPLEMENTED, not deployed)
**File:** `backend/src/huntRunner.js`
**Change:** Add `--init` flag to `docker run` args.
**Effect:** Docker injects `tini` as PID 1, which reaps zombie children.
**Test:** `backend/src/huntRunner-init.test.js` (3 tests pass)

### Alternative (if --init unavailable)
Use `dumb-init` or `tini` binary directly in the image Dockerfile:
```dockerfile
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sleep", "infinity"]
```

---

## 2. Container Lifecycle Management

### Current State
- Paused containers are never removed (7 running, 3 paused)
- No `DELETE /hunts/:id` was available (now implemented, not deployed)
- No automatic cleanup

### Recommendations
1. **Deploy** the DELETE endpoint (already implemented in `routes/hunts.js`)
2. **Cron job:** Remove containers for hunts paused >7 days (with data preservation)
3. **On hunt completion:** Auto-remove container after 24h (data preserved)

### Code (already implemented)
```javascript
// DELETE /api/v1/hunts/:id
// - Calls teardownHuntContainer(huntId)
// - Preserves /opt/Dark-Matter/backend/data/hunts/<id>/
// - Returns {containerRemoved, dataPreserved}
```

---

## 3. Resource Limits and Backpressure

### Current State
- Memory: 78% by llama-server (by design, 8B model)
- No per-hunt disk quota
- No backpressure when resources are low

### Recommendations
1. **Disk quota:** Add `--storage-opt size=10G` to container run args
2. **Memory backpressure:** If avail <500MB, pause new hunt creation (return 503)
3. **Log rotation:** Implement for container logs (currently unbounded)

### Code Sketch
```javascript
// In huntRunner.js, before creating container:
const memAvail = await getAvailableMemory();
if (memAvail < 500 * 1024 * 1024) {
  throw new Error('insufficient_memory: cannot start hunt');
}
```

---

## 4. Hunt Checkpoint Durability

### Current State
- Checkpoints saved to meta.json (proven to work)
- Backend restart auto-resumes (proven)
- No checksums or corruption detection

### Recommendations
1. **Atomic writes:** Write to temp file, then rename (prevents partial writes)
2. **Checksums:** Add SHA256 of checkpoint data
3. **Backup:** Keep last 3 checkpoints

### Code Sketch
```javascript
function saveCheckpoint(huntId, data) {
  const tmp = `${path}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, path); // Atomic
}
```

---

## 5. Watchdog Behavior

### Current State
- `ollama-watchdog.sh` v8: kills wedged llama-server, honors heartbeat
- Does NOT monitor zombies or memory pressure
- Does NOT restart containers

### Recommendations
1. **Zombie monitor:** If zombies >100, log warning (do not kill — needs container restart)
2. **Memory monitor:** If avail <200MB for 5 min, log critical alert
3. **Container health:** If container is Up but hunt is stuck (no events for 30 min), alert

### Code Sketch (bash)
```bash
ZOMBIES=$(ps -eo stat | grep -c Z)
if [ "$ZOMBIES" -gt 100 ]; then
  logger -t darkmatter "WARNING: $ZOMBIES zombie processes"
fi
```

---

## 6. Zombie-Process and Memory-Pressure Monitoring

### Metrics to Collect
- Zombie count (per container and total)
- Memory available (MB)
- Swap used (%)
- Container restart count
- Hunt iteration rate (iters/hour)

### Alert Thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| Zombies | >100 | >500 |
| Mem avail | <500MB | <200MB |
| Swap used | >80% | >95% |
| Disk used | >85% | >95% |

### Implementation
Add to the 5-min aim-wakeup worker (read-only):
```bash
# Already collects: hunt state, backend health
# Add: zombie count, mem avail, disk used
```

---

## 7. Graceful Shutdown and Resume

### Current State
- Backend restart: auto-resumes hunts (proven)
- Container restart: hunt resumes from checkpoint (proven)
- EC2 reboot: auto-resumes (assumed, not tested)

### Recommendations
1. **Test EC2 reboot:** Schedule maintenance window, verify auto-resume
2. **Graceful container stop:** Use `docker stop` (SIGTERM) not `docker kill` (SIGKILL)
3. **Pre-shutdown checkpoint:** Force checkpoint save before backend stop

### Code
```javascript
// In server.js shutdown handler:
process.on('SIGTERM', async () => {
  await checkpointAllHunts(); // Force save
  process.exit(0);
});
```

---

## Summary of Code Changes (This Mission)

| File | Change | Tests | Deployed |
|------|--------|-------|----------|
| `backend/src/huntRunner.js` | Add `--init` flag | 3 pass | No |
| `backend/src/huntRunner-init.test.js` | New test file | 3 pass | N/A |
| `backend/src/routes/hunts.js` | DELETE endpoint (prev mission) | Manual | No |

**All changes are local, unpushed, non-disruptive.**
