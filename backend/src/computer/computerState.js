/**
 * ComputerState — lifecycle state of the computer-control ("hands") runtime.
 *
 * The agent must always know whether the computer layer is usable, and must
 * degrade into a *waiting* state instead of crashing the assessment when it is
 * not (requirement #34). Nothing here is faked: the states are only entered
 * from a real capability probe or a real action result.
 *
 * States:
 *   computer_unavailable          no runtime answered the capability probe
 *   computer_connected           bridge verified and idle
 *   computer_busy                bridge is processing an action
 *   computer_action_running      an approved action is in flight
 *   computer_observation_ready   a new observation (screenshot/result) is stored
 */

export const COMPUTER_STATES = Object.freeze({
  UNAVAILABLE: 'computer_unavailable',
  CONNECTED: 'computer_connected',
  BUSY: 'computer_busy',
  ACTION_RUNNING: 'computer_action_running',
  OBSERVATION_READY: 'computer_observation_ready'
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
        this.transition(COMPUTER_STATES.CONNECTED, { error });
      }
    }
    return this.snapshot();
  }

  markDisconnected(reason) {
    this.reason = reason || 'computer runtime disconnected';
    this.consecutiveFailures += 1;
    this.transition(COMPUTER_STATES.UNAVAILABLE, { reason: this.reason });
  }

  transition(next, detail = {}) {
    const previous = this.state;
    this.state = next;
    this.emit({
      type: 'computer-state',
      previous,
      state: next,
      detail,
      at: new Date().toISOString()
    });
  }

  isAvailable() {
    return this.state !== COMPUTER_STATES.UNAVAILABLE;
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
