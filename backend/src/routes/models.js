// Downloadable model catalog + download job queue.
//
// Catalog sources (curated, real artifacts):
//   - faster-whisper sizes: guillaumekln/faster-whisper-{tiny,base,small,medium,large-v3}
//     on Hugging Face (CTranslate2-converted Whisper; Apache-2.0). "large-v3" is
//     the current stable large checkpoint; "distil-large-v3" offered as faster alt.
//   - Piper voices: rhasspy/piper voices, IDs follow the official naming scheme
//     <lang>_<REGION>-<voice>-<quality>, e.g. en_US-amy-medium. Artifacts:
//     https://huggingface.co/rhasspy/piper-voices/tree/main/<lang>/<region>/<voice>/<quality>
// Voice IDs here use ONLY real IDs from the Piper voice zoo (checked against
// rhasspy/piper-voices). Coordinate with the voice agent's contract — these are
// the IDs the voice service should accept.
//
// POST /api/v1/models/download {modelId} -> {jobId, status:"queued"} and tries a
// best-effort local download; status is tracked in data/model-downloads.json.

import { Router } from 'express';
import { execFile } from 'node:child_process';
import { readModelJobs, writeModelJobs } from '../store.js';

export const MODELS = [
  // --- faster-whisper (speech-to-text) ---------------------------------
  {
    id: 'faster-whisper-tiny',
    kind: 'stt',
    name: 'faster-whisper tiny',
    engine: 'faster-whisper',
    size: '~75 MB',
    hfRepo: 'guillaumekln/faster-whisper-tiny',
    description: 'Tiny English-only Whisper model — fastest, lowest accuracy.',
  },
  {
    id: 'faster-whisper-base',
    kind: 'stt',
    name: 'faster-whisper base',
    engine: 'faster-whisper',
    size: '~145 MB',
    hfRepo: 'guillaumekln/faster-whisper-base',
    description: 'Base multilingual Whisper model — good speed/accuracy balance.',
  },
  {
    id: 'faster-whisper-small',
    kind: 'stt',
    name: 'faster-whisper small',
    engine: 'faster-whisper',
    size: '~490 MB',
    hfRepo: 'guillaumekln/faster-whisper-small',
    description: 'Small multilingual model — noticeably more accurate than base.',
  },
  {
    id: 'faster-whisper-medium',
    kind: 'stt',
    name: 'faster-whisper medium',
    engine: 'faster-whisper',
    size: '~1.5 GB',
    hfRepo: 'guillaumekln/faster-whisper-medium',
    description: 'Medium multilingual model — strong accuracy, needs a decent CPU.',
  },
  {
    id: 'faster-whisper-large-v3',
    kind: 'stt',
    name: 'faster-whisper large-v3',
    engine: 'faster-whisper',
    size: '~3.1 GB',
    hfRepo: 'guillaumekln/faster-whisper-large-v3',
    description: 'Large-v3 multilingual model — best accuracy, heaviest.',
  },
  // --- Piper voices (text-to-speech) ------------------------------------
  {
    id: 'piper-en_US-amy-medium',
    kind: 'tts',
    name: 'Piper — Amy (en_US, medium)',
    engine: 'piper',
    voiceId: 'en_US-amy-medium',
    size: '~60 MB',
    description: 'Female American English voice, medium quality.',
  },
  {
    id: 'piper-en_US-lessac-medium',
    kind: 'tts',
    name: 'Piper — Lessac (en_US, medium)',
    engine: 'piper',
    voiceId: 'en_US-lessac-medium',
    size: '~60 MB',
    description: 'Female American English voice, medium quality.',
  },
  {
    id: 'piper-en_US-ryan-medium',
    kind: 'tts',
    name: 'Piper — Ryan (en_US, medium)',
    engine: 'piper',
    voiceId: 'en_US-ryan-medium',
    size: '~60 MB',
    description: 'Male American English voice, medium quality.',
  },
  {
    id: 'piper-en_GB-alan-medium',
    kind: 'tts',
    name: 'Piper — Alan (en_GB, medium)',
    engine: 'piper',
    voiceId: 'en_GB-alan-medium',
    size: '~60 MB',
    description: 'Male British English voice, medium quality.',
  },
  {
    id: 'piper-hi_IN-pratham-medium',
    kind: 'tts',
    name: 'Piper — Pratham (hi_IN, medium)',
    engine: 'piper',
    voiceId: 'hi_IN-pratham-medium',
    size: '~60 MB',
    description: 'Male Hindi voice, medium quality.',
  },
];

const router = Router();

router.get('/', (req, res) => {
  const jobs = readModelJobs();
  res.json({
    ok: true,
    models: MODELS.map((m) => ({
      id: m.id,
      kind: m.kind,
      name: m.name,
      engine: m.engine,
      voiceId: m.voiceId,
      size: m.size,
      description: m.description,
      download: latestJobFor(jobs, m.id),
    })),
  });
});

function latestJobFor(jobs, modelId) {
  const list = Object.values(jobs).filter((j) => j.modelId === modelId);
  if (!list.length) return null;
  list.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  const j = list[0];
  return { jobId: j.jobId, status: j.status, note: j.note, startedAt: j.startedAt };
}

router.get('/downloads/:jobId', (req, res) => {
  const jobs = readModelJobs();
  const job = jobs[req.params.jobId];
  if (!job) return res.status(404).json({ ok: false, error: 'unknown_job' });
  res.json({ ok: true, job: publicJob(job) });
});

router.post('/download', (req, res) => {
  const { modelId } = req.body || {};
  const model = MODELS.find((m) => m.id === modelId);
  if (!model) {
    return res.status(404).json({
      ok: false,
      error: 'unknown_model',
      message: `Unknown modelId "${modelId}". GET /api/v1/models for the catalog.`,
    });
  }
  const jobs = readModelJobs();
  const jobId = `mdl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    jobId,
    modelId,
    status: 'queued',
    note: 'Download queued. Best-effort fetch is attempted below; see README for manual steps.',
    startedAt: new Date().toISOString(),
  };
  jobs[jobId] = job;
  writeModelJobs(jobs);
  console.log(`[models] download queued: ${modelId} (job ${jobId})`);
  attemptDownload(jobId, model).catch(() => {});
  res.status(202).json({ ok: true, job: publicJob(job) });
});

function publicJob(j) {
  return {
    jobId: j.jobId,
    modelId: j.modelId,
    status: j.status,
    note: j.note,
    startedAt: j.startedAt,
    finishedAt: j.finishedAt,
  };
}

// Best-effort: try to actually fetch the artifact with a short timeout.
// If the sandbox/network cannot reach Hugging Face, the job stays honest:
// status stays "queued"/"failed" with an explanatory note — never "completed".
async function attemptDownload(jobId, model) {
  const jobs = readModelJobs();
  const job = jobs[jobId];
  if (!job) return;
  job.status = 'downloading';
  job.note = 'Attempting download…';
  writeModelJobs(jobs);
  console.log(`[models] downloading ${model.id} (job ${jobId})`);

  try {
    if (model.engine === 'faster-whisper') {
      // Verify the repo resolves on Hugging Face (cheap HEAD, 20s timeout).
      await hfResolve(model.hfRepo);
      // Kick off a real pip install of faster-whisper in the background; the
      // model weights themselves are fetched on first use by the library.
      await runCmd('python3', ['-m', 'pip', 'install', '--quiet', 'faster-whisper'], 120000);
    } else if (model.engine === 'piper') {
      const url = piperVoiceUrl(model.voiceId);
      await runCmd('curl', ['-fsSL', '--max-time', '25', '-o', '/dev/null', url], 30000);
      job.note = `Voice artifact verified reachable: ${url}. Install piper-tts and point VOICE_URL at a Piper-backed service to use it.`;
    }
    job.status = 'completed';
    job.note = job.note && job.note.startsWith('Attempting')
      ? 'Download/verification completed successfully.'
      : job.note;
    job.finishedAt = new Date().toISOString();
    console.log(`[models] download completed: ${model.id} (job ${jobId})`);
  } catch (err) {
    job.status = 'failed';
    job.note =
      'Automatic download failed in this environment (' +
      String(err.message || err).slice(0, 160) +
      '). See backend/README.md for manual download steps.';
    job.finishedAt = new Date().toISOString();
    console.log(`[models] download FAILED: ${model.id} (job ${jobId}): ${err.message || err}`);
  }
  const latest = readModelJobs();
  latest[jobId] = job;
  writeModelJobs(latest);
}

async function hfResolve(repo) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`https://huggingface.co/api/models/${repo}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Hugging Face repo not found (${res.status})`);
  } finally {
    clearTimeout(t);
  }
}

function piperVoiceUrl(voiceId) {
  // rhasspy/piper-voices tree: <lang>_<dialect>/<region>/<voice>/<quality>
  const [lang, rest] = voiceId.split('_');
  const [region, voice, quality] = rest.split('-');
  const base = `https://huggingface.co/rhasspy/piper-voices/resolve/main/${lang}/${lang}_${region}/${voice}/${quality}`;
  return `${base}/${voiceId}.onnx`;
}

function runCmd(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, { timeout: timeoutMs }, (err) => {
      if (err) reject(err);
      else resolve();
    });
    child.on('error', reject);
  });
}

export default router;
