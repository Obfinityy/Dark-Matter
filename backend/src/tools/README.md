# tools/ — Security Tool Integrations

Wrappers around external security tools (nuclei, subfinder, katana, httpx,
naabu, dalfox, …): execution, output parsing, finding normalization, and
policy validation.

## Key files

- `registry.js` — tool registry (what's available, capabilities, flags)
- `executor.js` — safe process execution with timeouts and sandboxing
- `managedBinaries.js` — download/verify/run managed tool binaries
- `parsers/` — per-tool output parsers → normalized findings
- `builtin/` — built-in tool implementations
- `findingNormalizer.js` — unified finding schema across all tools
- `policyValidator.js` — scope/policy checks before any tool runs

## Conventions

- Tools run through `policyValidator` first — no unscoped execution, ever.
- Parsers convert raw tool output into the normalized finding shape so
  `engines/` can score and filter uniformly.
