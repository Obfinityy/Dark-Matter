/**
 * motionInterface — phase-2 scaffold for the lifelike Infinity AI avatar.
 *
 * LONG-TERM PLAN (phase 2): the current CSS/SVG avatar is replaced by a
 * LivePortrait-class lifelike talking head driven by a Python sidecar on the
 * owner's GPU machine:
 *
 *   LivePortrait  (image-driven portrait animation, MIT) — head pose +
 *                   expression templates per emotion
 *   MuseTalk      (real-time lip-sync from audio, MIT) — mouth from speech
 *
 * See README.md in this directory for the full pipeline design and
 * THIRD_PARTY_NOTICES.md for license attributions.
 *
 * THIS FILE defines the JavaScript contract the backend will use to talk to
 * that sidecar. Phase 2 is interface + docs only — no GPU work happens here,
 * and no sidecar is bundled. `NoopMotionDriver` is the default implementation:
 * it satisfies the interface with zero side effects so the rest of the
 * avatar pipeline (emotions, speech, overlay) can be built and tested today.
 */

/**
 * Emotion template identifiers understood by the future sidecar.
 * Each maps to a short LivePortrait expression clip (.pkl) rendered from a
 * driving video of a real face — happy, angry, surprised, thinking, neutral.
 */
export const EMOTION_TEMPLATES = ['happy', 'angry', 'surprised', 'thinking', 'neutral'];

/**
 * @typedef {object} AvatarImage
 * @property {string} dataUrl - base64 data URL of the reference portrait
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {object} AudioChunk
 * @property {Uint8Array|Buffer} pcm - 16 kHz mono PCM audio bytes
 * @property {number} sampleRate - must be 16000 for MuseTalk realtime_inference
 */

/**
 * @typedef {object} RenderedFrame
 * @property {string} frameId - monotonic frame identifier
 * @property {string} emotion - the emotion template applied
 * @property {number} timestampMs
 */

/**
 * LifelikeAvatarSession — the contract a phase-2 motion driver implements.
 *
 * Lifecycle: startSession(avatarImage) → renderFrame(emotion, audioChunk)*
 * → stopSession(). A session is single-use; create a new one per
 * conversation.
 */
export class LifelikeAvatarSession {
  /**
   * Bind the session to a reference portrait and warm up the sidecar.
   * @param {AvatarImage} avatarImage
   * @returns {Promise<{ sessionId: string, fps: number }>}
   */
  // eslint-disable-next-line no-unused-vars
  async startSession(avatarImage) {
    throw new Error(
      'LifelikeAvatarSession.startSession is not implemented — phase 2 sidecar required.'
    );
  }

  /**
   * Render one animation frame for the current emotion + audio chunk.
   * In phase 2 this forwards to LivePortrait (pose/expression) and
   * MuseTalk (lip-sync), then returns the frame to stream to the client.
   *
   * @param {string} emotion - one of EMOTION_TEMPLATES
   * @param {AudioChunk|null} audioChunk - null when the avatar is silent
   * @returns {Promise<RenderedFrame>}
   */
  // eslint-disable-next-line no-unused-vars
  async renderFrame(emotion, audioChunk) {
    throw new Error(
      'LifelikeAvatarSession.renderFrame is not implemented — phase 2 sidecar required.'
    );
  }

  /**
   * Tear down the session and release GPU resources on the sidecar.
   * @returns {Promise<void>}
   */
  async stopSession() {
    throw new Error(
      'LifelikeAvatarSession.stopSession is not implemented — phase 2 sidecar required.'
    );
  }
}

/**
 * NoopMotionDriver — a safe stand-in that implements the session contract
 * without any GPU, model, or network dependency. Used in development and
 * tests, and as the fallback when no sidecar is configured.
 */
export class NoopMotionDriver extends LifelikeAvatarSession {
  constructor() {
    super();
    this.sessionId = null;
    this.frameCount = 0;
  }

  async startSession(avatarImage) {
    if (!avatarImage || !avatarImage.dataUrl) {
      throw new Error('NoopMotionDriver.startSession requires an avatar image with a dataUrl.');
    }
    this.sessionId = `noop-${Date.now().toString(36)}`;
    this.frameCount = 0;
    return { sessionId: this.sessionId, fps: 0 };
  }

  async renderFrame(emotion, audioChunk) {
    if (!this.sessionId) {
      throw new Error('NoopMotionDriver.renderFrame called before startSession.');
    }
    if (emotion && !EMOTION_TEMPLATES.includes(emotion)) {
      throw new Error(`Unknown emotion template: ${emotion}`);
    }
    this.frameCount += 1;
    return {
      frameId: `${this.sessionId}-f${this.frameCount}`,
      emotion: emotion || 'neutral',
      timestampMs: Date.now(),
      // No actual frame bytes: the frontend keeps rendering the CSS/SVG
      // avatar until a real sidecar is attached.
      frameBytes: null,
      audioBytesConsumed: audioChunk ? audioChunk.pcm.length : 0,
    };
  }

  async stopSession() {
    this.sessionId = null;
    this.frameCount = 0;
  }
}

/**
 * Factory for motion drivers.
 *
 * @param {'noop'|'sidecar'} [kind='noop'] - 'sidecar' is reserved for the
 *   future Python implementation and currently throws a descriptive error.
 * @param {object} [options] - driver options (sidecar: { baseUrl })
 * @returns {LifelikeAvatarSession}
 */
export function createMotionDriver(kind = 'noop', options = {}) {
  if (kind === 'noop') return new NoopMotionDriver();
  if (kind === 'sidecar') {
    const baseUrl = options.baseUrl || process.env.AVATAR_SIDECAR_URL || '';
    throw new Error(
      `The LivePortrait+MuseTalk sidecar is not implemented in this build (phase 2). ` +
        `Configure AVATAR_SIDECAR_URL=${baseUrl || '<sidecar-url>'} once the sidecar exists. ` +
        `See backend/src/avatar/README.md for the plan.`
    );
  }
  throw new Error(`Unknown motion driver kind: ${kind}`);
}
