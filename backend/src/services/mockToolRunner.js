/**
 * MockToolRunner — simulated stand-in for tool-registry execution.
 *
 * Control mode's `tool` steps (currently the `python` tool) are validated
 * against the real ToolRegistry schema, but through /infinite/control they
 * NEVER execute for real: the mock logs the call and returns a simulated
 * result envelope. Real Python execution stays behind the hunt's authorized
 * tool pipeline (policy validation + scope engine + user authorization).
 *
 * This is what makes the NL → plan → validate → execute chain provable in
 * tests, CI, and headless environments without running untrusted code.
 */
export class MockToolRunner {
  constructor({ logger = console } = {}) {
    this.logger = logger;
    this.isMock = true;
    /** Every tool step handed to run(), in order — the proof log. */
    this.calls = [];
  }

  async run(step) {
    const started = Date.now();
    const code = String(step?.code || '');
    this.calls.push({
      at: new Date().toISOString(),
      tool: step?.tool || null,
      codeChars: code.length,
      reason: step?.reason || null
    });

    return {
      ok: true,
      tool: step?.tool || null,
      output: {
        stdout: `[simulated] ${step?.tool} accepted ${code.length} chars of code — validated against the tool schema, logged, and NOT executed.`,
        stderr: '',
        exitCode: 0
      },
      observation: `Tool "${step?.tool}" step validated and logged (simulated) — code is never executed through this endpoint`,
      error: null,
      durationMs: Date.now() - started,
      rejected: false,
      simulated: true
    };
  }

  reset() {
    this.calls = [];
  }
}
