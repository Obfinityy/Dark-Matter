# Part 07 — Infinity AI product features

0001. **Depth-selectable code explanation** — lets the user pick explanation depth (one-line, summary, or line-by-line) before the agent explains any selected code block, so juniors and seniors both get useful answers.
0002. **Diff explainer with intent inference** — pastes or auto-loads a git diff and explains not just what changed but the likely intent behind each hunk, flagging changes that look accidental.
0003. **Context-aware follow-up chips** — after every answer, generates 3-4 clickable follow-up questions derived from the actual code context (not generic), keeping the conversation moving without retyping.
0004. **Symbol jump-to-definition from chat** — every function, class, or variable name in a chat answer is clickable and jumps to its real definition in the attached workspace.
0005. **Ambiguity clarifier before answering** — when a request has two or more plausible interpretations, the agent asks one targeted clarifying question with concrete options instead of guessing wrong.
0006. **Multi-lens answer regeneration** — re-answers the same question through a different lens on demand (security, performance, beginner-friendly, terse expert) without losing the original.
0007. **Inline code citations** — every factual claim about the codebase links to the exact file and line range it came from, so answers are verifiable in one click.
0008. **Sticky context files** — pins specific files to the conversation so every subsequent message automatically includes them as context until unpinned.
0009. **Stack trace analyzer** — pastes a stack trace and the agent maps each frame to real code, highlights the probable root cause frame, and suggests the fix.
0010. **Error screenshot understanding** — attaches a screenshot of an error dialog or terminal and the agent reads the text via vision, identifies the error, and proposes fixes.
0011. **Log tail diagnosis** — attaches or streams the last N lines of a log file and the agent correlates timestamps, extracts the failure signature, and explains the cascade.
0012. **Git blame conversation** — asks "who changed this and why" about any line and the agent walks blame history, linked commits, and PR discussions to summarize the rationale.
0013. **Test coverage Q&A** — answers questions like "which parts of auth/ lack tests" by reading real coverage reports and pointing at uncovered branches.
0014. **Architecture overview generator** — answers "how does this system work" with a generated component diagram description plus a guided tour of the key files in reading order.
0015. **Onboarding Q&A path** — new-to-repo mode that answers beginner questions with extra context links and a suggested reading sequence through the codebase.
0016. **Refactoring suggestions in chat** — highlights code smells in the discussed code and proposes concrete refactors with before/after snippets, ranked by payoff.
0017. **Security Q&A lens** — answers "is this safe" questions by tracing data flow from input to sink and naming the exact vulnerability class if one exists.
0018. **Performance Q&A lens** — answers "why is this slow" by identifying algorithmic hotspots, N+1 patterns, and missing indexes in the discussed code.
0019. **Accessibility audit chat** — reviews pasted JSX/HTML and lists WCAG violations with severity, the failing rule, and corrected markup.
0020. **i18n readiness checker** — scans discussed UI code for hardcoded strings, date/number formatting issues, and RTL problems, suggesting extraction to locale files.
0021. **Regex builder and tester** — conversationally builds a regular expression from plain-English description, shows a live test table of matches/non-matches, and explains each token.
0022. **Cron expression helper** — converts "every weekday at 9am" into a validated cron string, shows the next 5 run times, and warns about timezone pitfalls.
0023. **SQL query explainer** — explains any SQL query's execution plan in plain language, flags full table scans, and suggests index changes.
0024. **Data model Q&A** — answers questions about entity relationships by reading schema files and drawing the relationship map in text or diagram form.
0025. **Config file Q&A** — explains what each key in a pasted config does, flags deprecated or dangerous values, and suggests hardened alternatives.
0026. **Environment variable inventory** — scans the workspace for env var usage and produces a documented list of required vs optional vars with where each is read.
0027. **License compatibility Q&A** — answers "can I use this library" by checking its license against the project's license and explaining the obligations.
0028. **Dependency Q&A** — answers "what does package X do for us" by finding its import sites and summarizing its actual role in the codebase.
0029. **CI failure explainer** — pastes a failing CI log and the agent pinpoints the failing step, explains the cause, and gives the exact fix or config change.
0030. **Docker Q&A** — explains Dockerfile instructions layer by layer, flags cache-busting ordering mistakes, and suggests multi-stage optimizations.
0031. **Kubernetes manifest Q&A** — explains what a manifest deploys, validates it against best practices, and warns about missing probes or resource limits.
0032. **Cloud cost Q&A** — answers "what drives our AWS bill" by mapping infra-as-code to costed resources and ranking the expensive ones.
0033. **Monitoring Q&A** — explains what each alert rule watches, what "normal" looks like, and what to check first when it fires.
0034. **Incident timeline builder** — from pasted logs and chat notes, reconstructs an incident timeline with probable cause chain for postmortems.
0035. **Code review chat** — discusses a PR conversationally: asks for review, gets line-level findings, and can drill into any finding with "why is this bad".
0036. **PR description generator** — drafts a professional PR description from the branch diff, including summary, breaking changes, and test evidence.
0037. **Commit message composer** — proposes conventional-commit messages from staged changes, with scope detection from the files touched.
0038. **Changelog drafter** — turns merged PR titles and labels since the last tag into a categorized changelog draft.
0039. **Versioning advisor** — recommends major/minor/patch for a release by analyzing breaking vs additive API changes in the diff.
0040. **Release notes helper** — generates user-facing release notes from technical changelogs, translating jargon into benefit statements.
0041. **Feature flag Q&A** — answers "what happens if I turn this flag off" by tracing both code paths the flag controls.
0042. **Analytics instrumentation Q&A** — checks whether key user actions emit events, and suggests the missing tracking calls with payload schemas.
0043. **Chat folder organization** — groups conversations into user-created folders (per project, per sprint) with drag-and-drop and folder-level search.
0044. **Pinned chats** — pins important conversations to the top of the sidebar so recurring reference threads stay one click away.
0045. **Chat search across history** — full-text search over all past conversations with filters by date, mode, and attached files.
0046. **Context budget meter** — a live visual meter showing how much of the context window the current conversation consumes and what is eating it.
0047. **Token usage per chat** — shows estimated tokens and cost per conversation, with a breakdown by user messages vs agent responses vs attached files.
0048. **Export chat to markdown** — one click exports the full conversation, including code blocks and citations, to a clean markdown file.
0049. **Shareable chat link** — generates a read-only link to a conversation for teammates, with optional expiry and revocation.
0050. **Quick-action toolbar** — hovering any code block in chat reveals one-click actions: explain, test, refactor, document, or convert language.
0051. **Snippet export to file** — saves any code block from chat directly into a chosen workspace file at a chosen location.
0052. **Chat-to-task conversion** — converts an agent's suggested next step into a tracked task with one click, carrying the relevant context along.
0053. **Suggested file attachments** — before answering, the agent suggests which workspace files it should read, and the user approves with one click.
0054. **@-mention file picker** — typing @ in chat opens a fuzzy file/symbol search to attach precise context inline in the message.
0055. **@-mention symbol picker** — @ also resolves to functions, classes, and tests by name, attaching just that symbol's definition.
0056. **Image annotation in chat** — attaches a UI screenshot and draws attention to regions the agent should focus on via vision.
0057. **Voice note follow-ups** — records a voice message as a follow-up; the agent transcribes it, keeps the audio attached, and answers.
0058. **Conversation summaries** — long chats get an auto-generated summary with key decisions and open questions, pinned at the top.
0059. **Decision log extraction** — scans the conversation and lists every decision made with its rationale, exportable to docs.
0060. **Open-question tracker** — tracks questions the agent asked that the user never answered, surfacing them as a checklist.
0061. **Codebase-wide Q&A grounding** — answers "where is X implemented" by searching the full indexed workspace, not just attached files, with ranked file hits.
0062. **Cross-repo Q&A** — indexes multiple attached repositories and answers questions that span them, citing which repo each fact came from.
0063. **Documentation Q&A** — answers from the project's own docs folder first, falling back to code, and flags where docs contradict code.
0064. **API docs lookup** — fetches official docs for a library function mentioned in chat and summarizes the relevant parameters inline.
0065. **Standard library Q&A** — answers language-stdlib questions with version-aware notes when the project's runtime version differs from latest.
0066. **Framework version awareness** — tailors answers to the exact framework version in package.json, warning when suggesting APIs from newer versions.
0067. **Breaking-change radar** — when discussing an upgrade, lists the breaking changes between the current and target versions affecting this codebase.
0068. **Migration guide chat** — walks through a library migration step by step, checking off each codemod-like change against the real code.
0069. **Deprecation scanner Q&A** — answers "what deprecated APIs do we use" with file/line hits and the recommended replacements.
0070. **Dead code finder chat** — identifies unreachable or unused functions in the discussed module and proposes safe removal with impact notes.
0071. **Duplicate code detector** — finds near-duplicate blocks across the workspace and proposes a shared abstraction with the merged implementation.
0072. **Naming advisor** — suggests clearer names for variables, functions, and files based on their actual usage, with rename previews.
0073. **Comment quality review** — reviews comments in discussed code, flags misleading or stale ones, and rewrites them accurately.
0074. **Docstring generator** — generates accurate docstrings for selected functions by analyzing parameters, returns, and side effects.
0075. **README section drafter** — drafts missing README sections (setup, usage, API) from the actual code rather than generic templates.
0076. **Type inference explainer** — explains why TypeScript inferred a particular type, tracing the inference chain for confusing cases.
0077. **Generic constraint helper** — helps write complex generic signatures by example, verifying each constraint against usage.
0078. **Async/await debugger chat** — explains race conditions and deadlocks in discussed async code with an event-loop timeline.
0079. **Memory leak Q&A** — analyzes suspect code for leak patterns (listeners, closures, caches) and suggests fixes with weak-reference alternatives.
0080. **Bundle bloat Q&A** — answers "why is our bundle big" by mapping imports to bundle cost and suggesting tree-shaking or lazy-loading wins.
0081. **Database query Q&A** — reviews ORM queries in chat for N+1 issues and shows the optimized query with eager loading.
0082. **API design critique** — reviews a pasted endpoint design for REST consistency, naming, status codes, and versioning, with corrections.
0083. **Webhook design helper** — designs webhook payloads, retry semantics, and signature verification for a described integration.
0084. **Auth flow explainer** — traces the project's actual login/session/token flow across files and explains it step by step.
0085. **OAuth integration Q&A** — answers provider-specific OAuth questions with the exact scopes and redirect setup this project needs.
0086. **Rate limiting advisor** — suggests rate-limit strategies for the project's endpoints based on their cost and abuse potential.
0087. **Caching strategy Q&A** — recommends what to cache, where, and with what invalidation based on the data access patterns in code.
0088. **Pagination helper** — compares cursor vs offset pagination for the discussed endpoint and generates the implementation.
0089. **Search implementation Q&A** — advises on full-text vs trigram vs external search based on data size and query patterns in the project.
0090. **File upload design Q&A** — covers validation, virus scanning hooks, storage tiers, and signed URLs for the project's upload flow.
0091. **Background job Q&A** — helps choose queue vs cron vs event-driven for a described workload, with idempotency guidance.
0092. **WebSocket design helper** — designs channel structure, reconnection, and auth for real-time features in the project's stack.
0093. **Email template Q&A** — reviews transactional email code for deliverability issues and generates tested HTML/text templates.
0094. **PDF generation Q&A** — compares server-side PDF approaches for the stack and generates the implementation for a described report.
0095. **Charting advice chat** — recommends chart types and libraries for a described dataset, with sample component code.
0096. **Form validation Q&A** — designs client+server validation for a described form, keeping rules in sync between both.
0097. **State management Q&A** — advises on local vs global state placement for discussed components in the project's state library.
0098. **Routing Q&A** — explains the project's route structure and helps add nested routes, guards, and lazy loading correctly.
0099. **Testing strategy Q&A** — recommends what to unit vs integration vs e2e test for a feature, based on the project's existing setup.
0100. **Mocking helper** — generates mocks for the exact dependencies a selected function uses, matching the project's test framework.
