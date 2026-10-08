# Third-Party Notices

This file lists open-source projects that Dark Matter references or integrates.
Original project names never appear in the product UI (they are rebranded there),
but their licenses are respected here in full.

---

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
