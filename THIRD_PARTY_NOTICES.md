# Third-Party Notices

This file lists open-source projects that Dark Matter references or integrates.
Original project names never appear in the product UI (they are rebranded there),
but their licenses are respected here in full.

---

## nuclei — the "Infinity Scanner" vulnerability engine

- Project: nuclei — https://github.com/projectdiscovery/nuclei
- License: MIT — https://github.com/projectdiscovery/nuclei/blob/main/LICENSE.md
- What we use: at runtime, the local backend downloads the official nuclei
  release binary for the user's OS from
  https://github.com/projectdiscovery/nuclei/releases and its template library
  via `nuclei -update-templates` (https://github.com/projectdiscovery/nuclei-templates,
  also MIT) — we do not modify or redistribute either ourselves.
- In the product UI this capability is presented exclusively as "Infinity Scanner".
- Copyright: ProjectDiscovery contributors.

## subfinder — the "Infinity Recon" subdomain engine

- Project: subfinder — https://github.com/projectdiscovery/subfinder
- License: MIT — https://github.com/projectdiscovery/subfinder/blob/main/LICENSE.md
- What we use: at runtime, the local backend downloads the official subfinder
  release binary for the user's OS from
  https://github.com/projectdiscovery/subfinder/releases.
- In the product UI this capability is presented exclusively as "Infinity Recon".
- Copyright: ProjectDiscovery contributors.

## katana — the "Infinity Crawler" endpoint-discovery engine

- Project: katana — https://github.com/projectdiscovery/katana
- License: MIT — https://github.com/projectdiscovery/katana/blob/main/LICENSE.md
- What we use: at runtime, the local backend downloads the official katana
  release binary for the user's OS from
  https://github.com/projectdiscovery/katana/releases.
- In the product UI this capability is presented exclusively as "Infinity Crawler".
- Copyright: ProjectDiscovery contributors.

## httpx — the "Infinity Probe" HTTP-probing engine

- Project: httpx — https://github.com/projectdiscovery/httpx
- License: MIT — https://github.com/projectdiscovery/httpx/blob/main/LICENSE.md
- What we use: at runtime, the local backend downloads the official httpx
  release binary for the user's OS from
  https://github.com/projectdiscovery/httpx/releases.
- In the product UI this capability is presented exclusively as "Infinity Probe".
- Copyright: ProjectDiscovery contributors.

## naabu — the "Infinity Portscan" port-scanning engine

- Project: naabu — https://github.com/projectdiscovery/naabu
- License: MIT — https://github.com/projectdiscovery/naabu/blob/main/LICENSE.md
- What we use: at runtime, the local backend downloads the official naabu
  release binary for the user's OS from
  https://github.com/projectdiscovery/naabu/releases.
- In the product UI this capability is presented exclusively as "Infinity Portscan".
- Copyright: ProjectDiscovery contributors.

## dalfox — the "Infinity XSS-Prover" XSS engine

- Project: dalfox — https://github.com/hahwul/dalfox
- License: MIT — https://github.com/hahwul/dalfox/blob/main/LICENSE
- What we use: at runtime, the local backend downloads the official dalfox
  release binary for the user's OS from
  https://github.com/hahwul/dalfox/releases.
- In the product UI this capability is presented exclusively as "Infinity XSS-Prover".
- Copyright: hahwul and dalfox contributors.

## koboldcpp — the "Infinity AI Runner" engine

- Project: koboldcpp — https://github.com/LostRuins/koboldcpp
- License: GNU Affero General Public License v3.0 (AGPL-3.0)
- License text: https://github.com/LostRuins/koboldcpp/blob/main/LICENSE.md
- What we use: at runtime, the local backend downloads the official koboldcpp
  release binary for the user's OS (single self-contained executable, no
  installation) from https://github.com/LostRuins/koboldcpp/releases — we do
  not modify, fork, or redistribute the binary ourselves.
- In the product UI this engine is presented exclusively as "Infinity AI Runner".
- Copyright: koboldcpp contributors (see the project's GitHub repository).

---

## llama.cpp

- Project: llama.cpp — https://github.com/ggml-org/llama.cpp
- License: MIT — https://github.com/ggml-org/llama.cpp/blob/master/LICENSE
- Note: koboldcpp (above) is built on llama.cpp. Earlier versions of Dark Matter
  downloaded llama.cpp `llama-server` binaries directly; the engine role is now
  served by the Infinity AI Runner (koboldcpp-based).

---

## invisible_dots — the "Infinity Sandbox" VM control plane

- Project: invisible_dots — https://github.com/feder-cr/invisible_dots
- License: MIT (full text reproduced below, as the license requires).
- What we use: concepts adapted (VM lifecycle patterns, guest-agent channel
  design, permission-gate pattern, local memory pattern); no original code
  copied verbatim. The OpenRouter-backed "brain" of the original project is
  NOT used — the sandbox is driven exclusively by the Infinity AI
  triple-brain (hacking, vision, grounding models on the user's own machine).
- In the product UI this capability is presented exclusively as "Infinity
  Sandbox". Original project names never appear in user-visible strings.

```
MIT License

Copyright (c) 2026 feder-cr

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## PayloadsAllTheThings — the "Payload Library" payload dataset

- Project: PayloadsAllTheThings — https://github.com/swisskyrepo/PayloadsAllTheThings
- License: MIT (full text reproduced below, as the license requires).
- What we use: curated payload strings extracted from the project's category
  READMEs (XSS, SQLi, Command Injection, SSRF, SSTI, XXE, LDAP/NoSQL/XPATH
  injection, Open Redirect, CRLF/CSV injection, GraphQL, Prototype Pollution,
  HPP, CORS, Clickjacking, file upload, request smuggling, web cache
  deception, SSI) into structured JSON datasets shipped under
  backend/data/payload-library/. A copy of the license is kept at
  third_party/payloads-all-the-things/LICENSE.
- Scope: data only. Dark Matter never auto-attacks or exploit-fires payloads
  from this dataset; payloads are suggested for the user's own authorized
  targets only, and every hunt keeps the authorized-targets-only guardrails.
- In the product UI this capability is presented exclusively as "Payload
  Library". Original project names never appear in user-visible strings.

```
MIT License

Copyright (c) 2019 Swissky

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
