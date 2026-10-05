# Third-Party Notices — Infinity AI Avatar (phase-2 candidates)

These projects are **not bundled, vendored, or downloaded** in this
repository. They are listed here because the phase-2 lifelike-avatar plan
(`README.md`) is designed around them, and their licenses must be honored
when the sidecar is implemented.

## Included by reference (MIT — commercial use allowed)

### LivePortrait
- Repository: https://github.com/KwaiVGI/LivePortrait
- License: MIT License
- Copyright: KwaiVGI
- Purpose in phase 2: image-driven portrait animation (head pose +
  expression) for the lifelike avatar.
- Attribution requirement: the MIT license text and copyright notice must be
  preserved in any redistribution of its code.

### MuseTalk
- Repository: https://github.com/TMElyralab/MuseTalk
- License: MIT License
- Copyright: TMElyralab
- Purpose in phase 2: real-time lip-sync from speech audio
  (`realtime_inference` path).
- Attribution requirement: the MIT license text and copyright notice must be
  preserved in any redistribution of its code.

### MediaPipe (face-mesh swap)
- Repository: https://github.com/google-ai-edge/mediapipe
- License: Apache License 2.0
- Copyright: Google LLC
- Purpose in phase 2: replaces InsightFace for face landmark extraction
  (see below). Apache 2.0 permits commercial use with attribution and a
  copy of the license.

## Explicitly EXCLUDED — do not vendor or ship

### InsightFace `buffalo_l` model pack
- Repository: https://github.com/deepinsight/insightface
- License: **non-commercial** (the InsightFace model license prohibits
  commercial use of the pre-trained model packs, including `buffalo_l`).
- Decision: **InsightFace `buffalo_l` is excluded from this project.**
  LivePortrait's reference code uses it for face detection/landmarks; our
  phase-2 integration **must** use MediaPipe Face Mesh instead (Apache 2.0,
  commercial-friendly). No InsightFace weights may be committed, downloaded
  into the repo, or shipped with the product.

## Product naming rule

Upstream project names appear only in engineering docs and license files.
Every user-visible label in the product says **Infinity AI**.
