# Piper voices — curated list

These are the voice IDs shipped in `voices.json` and served by
`GET /tts/voices`. **Every ID below was verified on 13 Oct 2026 against the
live `rhasspy/piper-voices` voice repository** (the official distribution
source behind https://github.com/rhasspy/piper/releases) via the
Hugging Face repo tree API:

- `https://huggingface.co/api/models/rhasspy/piper-voices/tree/main/<lang>/<locale>/<voice>` → lists released quality levels
- `.../tree/main/<lang>/<locale>/<voice>/<quality>` → lists the actual
  `<voice-id>.onnx` + `<voice-id>.onnx.json` files

A voice ID is listed here only if the `<quality>` directory exists AND
contains both files.

## Verified voices

| ID | Name | Lang | Gender | Notes |
|----|------|------|--------|-------|
| `en_US-amy-medium` | Amy | en-US | female | Warm, pleasant — the default voice |
| `en_US-lessac-medium` | Lessac | en-US | female | Soft, natural |
| `en_US-kristin-medium` | Kristin | en-US | female | Clear, friendly |
| `en_US-ryan-medium` | Ryan | en-US | male | Deep, resonant |
| `en_GB-alan-medium` | Alan | en-GB | male | Classic British |
| `hi_IN-pratham-medium` | Pratham | hi-IN | male | Hindi |
| `hi_IN-priyamvada-medium` | Priyamvada | hi-IN | female | Hindi |
| `hi_IN-rohan-medium` | Rohan | hi-IN | male | Hindi |

**Hindi: YES.** Piper ships three Hindi (`hi_IN`) voices — `pratham`,
`priyamvada`, `rohan` — each verified to have a `medium` quality release
(`pratham-medium` is ~63 MB). There are no other `hi_IN` speakers in the
repo, and no `low`/`high` Hindi qualities as of the verification date.

## Verification details (13 Oct 2026)

- `en/en_US` speaker directories: amy, arctic, bryce, danny, hfc_female,
  hfc_male, joe, john, kathleen, kristin, kusal, l2arctic, lessac,
  libritts, libritts_r, ljspeech, mike, norman, reza_ibrahim, ryan, sam
- Quality directories confirmed: amy → low+medium; ryan → low+medium+high;
  lessac → low+medium+high; kristin → medium;
  en_GB/alan → low+medium;
  hi_IN/pratham, hi_IN/priyamvada, hi_IN/rohan → medium only.

## Download URLs

Voices download from Hugging Face (stable, resumable; GitHub release
assets point to the same files):

```
https://huggingface.co/rhasspy/piper-voices/resolve/main/<lang>/<locale>/<speaker>/<quality>/<voice-id>.onnx
https://huggingface.co/rhasspy/piper-voices/resolve/main/<lang>/<locale>/<speaker>/<quality>/<voice-id>.onnx.json
```

Example (Amy):

```bash
cd ~/.local/share/piper/voices
curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx
curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json
```

Or use the helper (downloads any voice, or all curated ones):

```bash
cd voice/tts
python download_voice.py --all        # all 8 curated voices
python download_voice.py hi_IN-pratham-medium   # single voice
```

> If a URL returns a ~15-byte file, that voice/quality does not exist —
> the helper script detects this and fails loudly instead of caching a
> broken stub.

## Adding more voices

Browse https://huggingface.co/rhasspy/piper-voices/tree/main, pick a
`<voice-id>` whose quality directory contains the `.onnx` + `.onnx.json`
pair, add it to `voices.json`, download with `download_voice.py <id>`.
