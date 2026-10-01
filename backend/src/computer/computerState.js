/**
 * ComputerState — lifecycle state of the computer-control ("hands") runtime.
 *
 * The agent must always know whether the computer layer is usable, and must
 * degrade into a *waiting* state instead of crashing the assessment when it is
 * not (requirement #34). Nothing here is faked: the states are only entered
 * from a real capability probe or a real action result.
 *
 * States (issue #1 — the full observe → decide → act → observe lifecycle):
 *   computer_unavailable          no runtime answered the capability probe
 *   computer_connected            bridge verified and idle (legacy name kept)
 *   computer_ready                runtime probed AND daemon announced readiness
 *   computer_busy                 bridge is processing an action
 *   computer_action_running       an approved action is in flight
 *   computer_observing            a fresh observation is being captured
 *   computer_observation_ready    a new observation (screenshot/result) is stored
 *   computer_observation_failed   the observation capture itself failed
 *   computer_action_failed        the action failed but the runtime is alive
 *   computer_disconnected         the bridge process exited or errored
 *   computer_permission_required  an action needs explicit user approval
 */

export const COMPUTER_STATES = Object.freeze({
  UNAVAILABLE: 'computer_unavailable',
  CONNECTED: 'computer_connected',
  READY: 'computer_ready',
  BUSY: 'computer_busy',
  ACTION_RUNNING: 'computer_action_running',
  OBSERVING: 'computer_observing',
  OBSERVATION_READY: 'computer_observation_ready',
  OBSERVATION_FAILED: 'computer_observation_failed',
  ACTION_FAILED: 'computer_action_failed',
  DISCONNECTED: 'computer_disconnected',
  PERMISSION_REQUIRED: 'computer_permission_required'
});

/**
 * Explicit transition map: every state change in the computer lifecycle must
 * be one of these edges. `transition()` still performs unknown edges (never
 * crash the agent loop) but records the violation in the emitted event so it
 * is visible in tests and logs.
 */
const ALLOWED_TRANSITIONS = Object.freeze({
  computer_unavailable: ['computer_connected', 'computer_ready', 'computer_disconnected'],
  computer_connected: [
    'computer_ready', 'computer_busy', 'computer_action_running',
    'computer_unavailable', 'computer_disconnected', 'computer_permission_required'
  ],
  computer_ready: [
    'computer_busy', 'computer_action_running', 'computer_observing',
    'computer_unavailable', 'computer_disconnected', 'computer_permission_required'
  ],
  computer_busy: [
    'computer_action_running', 'computer_observing', 'computer_ready',
    'computer_unavailable', 'computer_disconnected'
  ],
  computer_action_running: [
    'computer_observing', 'computer_observation_ready', 'computer_observation_failed',
    'computer_action_failed', 'computer_busy', 'computer_ready',
    'computer_unavailable', 'computer_disconnected'
  ],
  computer_observing: [
    'computer_action_running', 'computer_observation_ready', 'computer_observation_failed',
    'computer_ready', 'computer_unavailable', 'computer_disconnected'
  ],
  computer_observation_ready: [
    'computer_action_running', 'computer_observing', 'computer_busy', 'computer_ready',
    'computer_unavailable', 'computer_disconnected', 'computer_permission_required'
  ],
  computer_observation_failed: [
    'computer_observing', 'computer_ready', 'computer_connected', 'computer_action_running',
    'computer_unavailable', 'computer_disconnected'
  ],
  computer_action_failed: [
    'computer_observing', 'computer_action_running', 'computer_ready', 'computer_connected',
    'computer_unavailable', 'computer_disconnected', 'computer_permission_required'
  ],
  computer_disconnected: ['computer_connected', 'computer_ready', 'computer_unavailable'],
  computer_permission_required: [
    'computer_ready', 'computer_action_running',
    'computer_unavailable', 'computer_disconnected'
  ]
});

export class ComputerState {
  constructor({ capabilities = null } = {}) {
    this.state = COMPUTER_STATES.UNAVAILABLE;
    this.capabilities = capabilities;
    this.reason = 'not probed yet';
    this.platform = null;
    this.lastActionAt = null;
    this.lastAction = null;
    this.lastObservationAt = null;
    this.lastObservation = null;
    this.actionsPerformed = 0;
    this.consecutiveFailures = 0;
    this.listeners = new Set();
  }

  /** Subscribe to state transitions. Returns an unsubscribe function. */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        /* a broken listener must never break the agent loop */
      }
    }
  }

  /** Record a capability probe result. */
  setCapabilities(capabilities, { available, reason = null } = {}) {
    this.capabilities = capabilities || null;
    this.platform = capabilities?.platform || null;
    this.reason = available ? null : reason || capabilities?.pyautoguiError || 'computer control unavailable';
    this.transition(available ? COMPUTER_STATES.CONNECTED : COMPUTER_STATES.UNAVAILABLE, {
      reason: this.reason,
      capabilities
    });
    return this.snapshot();
  }

  /** The daemon announced readiness after a successful probe. */
  markReady(detail = {}) {
    this.consecutiveFailures = 0;
    this.reason = null;
    this.transition(COMPUTER_STATES.READY, detail);
  }

  /** Called right before an action is handed to the bridge. */
  markActionStarted(action) {
    this.transition(COMPUTER_STATES.ACTION_RUNNING, { action });
  }

  /** Called with the real result of an action. */
  markActionFinished(action, { ok, error = null, observation = null } = {}) {
    this.lastAction = { type: action?.type, ok, at: new Date().toISOString() };
    this.lastActionAt = this.lastAction.at;
    this.actionsPerformed += 1;

    if (ok) {
      this.consecutiveFailures = 0;
      if (observation) {
        this.lastObservation = observation;
        this.lastObservationAt = new Date().toISOString();
        this.transition(COMPUTER_STATES.OBSERVATION_READY, { observation });
      } else {
        this.transition(COMPUTER_STATES.BUSY, { action });
      }
    } else {
      this.consecutiveFailures += 1;
      // Repeated transport-level failures mean the runtime is gone; a rejected
      // *action* (policy/params) is not a runtime outage.
      if (this.consecutiveFailures >= 3) {
        this.reason = `computer control unavailable after ${this.consecutiveFailures} consecutive failures: ${error}`;
        this.transition(COMPUTER_STATES.UNAVAILABLE, { reason: this.reason });
      } else {
        // The runtime is alive — only this action failed. The brain gets a
        // distinct state so it can recover instead of replanning blind.
        this.transition(COMPUTER_STATES.ACTION_FAILED, { action, error });
      }
    }
    return this.snapshot();
  }

  /** A fresh observation capture is starting (the "observe" in observe→decide→act→observe). */
  markObserving(detail = {}) {
    this.transition(COMPUTER_STATES.OBSERVING, detail);
  }

  /** A fresh observation was captured. */
  markObservationReady(observation) {
    this.lastObservation = observation;
    this.lastObservationAt = new Date().toISOString();
    this.consecutiveFailures = 0;
    this.transition(COMPUTER_STATES.OBSERVATION_READY, { observation });
  }

  /** The observation capture itself failed — the screen state is unknown. */
  markObservationFailed(reason) {
    this.consecutiveFailures += 1;
    this.transition(COMPUTER_STATES.OBSERVATION_FAILED, { reason });
  }

  /** An action needs explicit user approval before it may run. */
  markPermissionRequired(action, reason = 'computer action requires explicit approval') {
    this.transition(COMPUTER_STATES.PERMISSION_REQUIRED, { action, reason });
  }

  markDisconnected(reason) {
    this.reason = reason || 'computer runtime disconnected';
    this.consecutiveFailures += 1;
    this.transition(COMPUTER_STATES.DISCONNECTED, { reason: this.reason });
  }

  transition(next, detail = {}) {
    const previous = this.state;
    const allowed = ALLOWED_TRANSITIONS[previous] || [];
    // Fault-handling edges are always explicit: any state may degrade to
    // disconnected/unavailable when the runtime actually fails.
    const explicit = allowed.includes(next)
      || next === COMPUTER_STATES.DISCONNECTED
      || next === COMPUTER_STATES.UNAVAILABLE;
    this.state = next;
    this.emit({
      type: 'computer-state',
      previous,
      state: next,
      explicit,
      detail: explicit ? detail : { ...detail, warning: `unexpected computer state transition ${previous} → ${next}` },
      at: new Date().toISOString()
    });
  }

  isAvailable() {
    return this.state !== COMPUTER_STATES.UNAVAILABLE
      && this.state !== COMPUTER_STATES.DISCONNECTED;
  }

  get unavailableReason() {
    return this.isAvailable() ? null : this.reason;
  }

  /** Compact snapshot persisted with job state so a reload reconstructs reality. */
  snapshot() {
    return {
      state: this.state,
      available: this.isAvailable(),
      reason: this.reason,
      platform: this.platform,
      actionsPerformed: this.actionsPerformed,
      consecutiveFailures: this.consecutiveFailures,
      lastAction: this.lastAction,
      lastActionAt: this.lastActionAt,
      lastObservation: this.lastObservation,
      lastObservationAt: this.lastObservationAt,
      screen: this.capabilities?.screen || null,
      actions: this.capabilities?.actions || [],
      // Partial-capability truth: the bridge may be up while input simulation is
      // missing. The brain needs this to choose a different route (#34).
      inputSimulation: this.capabilities?.pyautoguiAvailable ?? null,
      capabilities: this.capabilities
        ? {
            platform: this.capabilities.platform,
            pythonVersion: this.capabilities.pythonVersion,
            pyautoguiAvailable: this.capabilities.pyautoguiAvailable,
            pyautoguiError: this.capabilities.pyautoguiError,
            screenshotDir: this.capabilities.screenshotDir
          }
        : null,
      updatedAt: new Date().toISOString()
    };
  }
}
