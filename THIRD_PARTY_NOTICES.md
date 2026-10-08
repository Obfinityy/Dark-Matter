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
