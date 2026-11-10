// Split out of brainMode.js by the P3 professionalization lane (split-only, no behaviour change).
// Dispatch branches of executeBrainAction, moved verbatim except that
// dispatcher locals are read through the h context object.

import {
  buildActionIndex,
  recallByHash,
  recallById,
  parseRecallId,
  formatFullRecord,
  contentHash,
  titleFor,
} from '../../actionIndex.js';
import { publicEntry } from './common.js';

export async function executeRecallAction(huntId, action, h) {
  let rec = null;
  const idRaw = action.id;
  if (idRaw !== undefined && idRaw !== null && String(idRaw).trim() !== '') {
    const n = parseRecallId(idRaw);
    if (n == null) { h.failProcess('unknown_action', 'recall needs an id like 7 or "#7", or a hash.'); return { ok: false, error: 'unknown_action', message: 'recall needs an id like 7 or "#7", or a hash.' }; }
    rec = recallById(h.readEvents(huntId) || [], h.readReasoning(huntId) || [], n);
  } else if (action.hash) {
    rec = recallByHash(h.readEvents(huntId) || [], h.readReasoning(huntId) || [], action.hash);
  } else {
    h.failProcess('unknown_action', 'recall needs {id: N} or {hash: "..."}.');
    return { ok: false, error: 'unknown_action', message: 'recall needs {id: N} or {hash: "..."}.' };
  }
  if (!rec || rec.error) {
    h.failProcess('unknown_hash', String(rec && rec.error ? rec.error : 'nothing recalled'));
    return { ok: false, error: 'unknown_hash', output: String(rec && rec.error ? rec.error : 'nothing recalled') };
  }
  h.observation = formatFullRecord(rec);
  h.recordExecuted();
  // The recall's own tool_call must not shadow the recalled
  // entry: return the RECALLED record as the entry, with the
  // recall's hash carried alongside.
  const recalledEntry = publicEntry(rec.entry, 'done');
  const own = h.finish();
  return { ...own, output: h.observation, entry: recalledEntry, recalledHash: rec.entry.hash };
}
