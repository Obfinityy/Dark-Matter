# Hunt UX polish (50005–51004)
50005. **Findings-list skeleton rows** — Shimmering placeholder rows mirror real finding-card heights so the layout never jumps when data arrives.
50006. **Phase-stepper skeleton** — Placeholder chips for Recon, Testing, Chaining, and Reporting render on hunt start before real steps stream in.
50007. **Chat bubble skeletons** — Gray bubble placeholders appear in the mid-hunt chat panel while the agent's reply streams.
50008. **Progressive report-preview skeleton** — The title bar loads first, then the table of contents, then sections fade in one by one.
50009. **Determinate model-download bar** — Each brain slot shows percentage plus ETA during model downloads on the Models page.
50010. **Barber-pole analyzing loader** — An indeterminate striped loader shows during target analysis before the first recon step resolves.
50011. **Terminal waveform skeleton** — A pulsing waveform placeholder stands in for the live terminal while agent output streams.
50012. **Start-button morphing spinner** — The Start Hunt button's spinner morphs into the current phase label once the hunt begins.
50013. **Reduced-motion skeletons** — Skeletons render as static gray blocks instead of shimmering when prefers-reduced-motion is set.
50014. **Content-aware finding-card skeleton** — The placeholder mirrors real card proportions: severity badge, title line, and two meta lines.
50015. **Staggered skeleton fade-in** — Multiple placeholders fade in with slight delays so they never shimmer in distracting sync.
50016. **Engine warm-up checklist** — A "warming up engines" state lists recon, vuln detector, and PoC generator lighting up green as each readies.
50017. **Favicon progress ring** — The browser tab favicon shows a tiny progress ring with the hunt completion percentage.
50018. **Target-preview iframe loader** — A blurred domain placeholder with the hostname shows while the target preview iframe loads.
50019. **Severity-donut skeleton** — A gray ring placeholder stands in for the severity donut chart on the hunt summary.
50020. **Optimistic queued-hunt card** — A "queued" card appears in hunt history the instant a link is pasted, before the job exists.
50021. **Timeline-scrubber skeleton** — Placeholder ticks render for the hunt timeline scrubber before phases resolve.
50022. **Thinking agent avatar pulse** — The agent avatar pulses with a "thinking" caption while it reasons between steps.
50023. **Export overlay with cancel** — Export buttons show a "generating PDF" overlay with a working cancel option.
50024. **Finding-drawer skeleton** — The detail drawer shows placeholders for title, severity pill, and evidence code block.
50025. **Rotating loading copy** — Loading text rotates through real phase-tied messages like "Fingerprinting server…" and "Mapping routes…".
50026. **Delayed skeleton threshold** — Skeletons only appear if loading exceeds 300ms, preventing flicker on fast loads.
50027. **Suggestion-chip skeleton** — A placeholder row stands in for mid-hunt chat suggestion chips while they generate.
50028. **URL-input analyzing state** — The target input shows a shimmer with a cancel X while the URL is being analyzed.
50029. **Per-phase loading bars** — Each phase in the timeline shows its own determinate progress bar inside the tracker.
50030. **Dashboard stat-card skeletons** — Stat cards show placeholders, then counts animate up from zero when data arrives.
50031. **Resume-from-snapshot loader** — A "resuming hunt" state shows snapshot-restore progress from memory file to phase states.
50032. **PoC-replay skeleton** — Request and response placeholder blocks render while the PoC replay panel loads.
50033. **Filter-chip spinner** — A filter chip shows a tiny spinner when applying it triggers a re-query.
50034. **Chain-graph skeleton** — Nodes appear as gray circles and edges as dashed lines before the real graph loads.
50035. **Inline agent-status dots** — The status line shows animated dots, e.g. "Testing login form …", during live steps.
50036. **Notification-list skeleton** — Placeholder rows stand in for the notification center list items.
50037. **Saved-search dropdown loader** — A spinner shows inside the saved-search dropdown while searches fetch.
50038. **Settings-section skeletons** — Each settings page section renders a labeled placeholder while loading.
50039. **ZIP-export progress bar** — Memory ZIP export shows a determinate bar with the file count being packed.
50040. **Model-library card skeletons** — Placeholder cards render for each model entry on the Models page.
50041. **Reconnecting socket state** — A "reconnecting…" banner with a retry countdown shows when the live hunt socket drops.
50042. **Risk-gauge skeleton** — A placeholder gauge performs an animated needle sweep once the real score loads.
50043. **Evidence-thumbnail blur-up** — Evidence screenshots load as blurred thumbnails that sharpen into focus progressively.
50044. **Compare-hunts skeleton** — Placeholder panes render for the diff view before both hunts finish loading.
50045. **Pause-button transition spinner** — The pause/resume button shows an inline spinner during the state transition.
50046. **Audit-log row skeletons** — Placeholder rows mirror the audit log table's column widths while loading.
50047. **Ask-agent typing indicator** — A typing indicator shows in the "ask agent" follow-up while the answer generates.
50048. **Asset-tree skeleton** — Indented placeholder branches render for the scope and asset tree in the target panel.
50049. **Bulk-action progress bar (hunt-ux)** — Bulk operations show determinate progress, e.g. "marking 24 findings as reviewed".
50050. **Insights-feed skeleton** — Placeholder cards render for the learning and insights feed.
50051. **Theme-preview loader** — Theme switcher thumbnails show shimmer placeholders while rendering previews.
50052. **Shortcut-cheatsheet skeleton** — The keyboard-shortcuts modal shows placeholder rows while loading bindings.
50053. **Catch-up loading state** — Reopening a hunt with 500+ missed events shows "catching up" with a "jump to latest" button.
50054. **PDF-thumbnail skeleton** — Placeholder pages render for the report preview's page thumbnails.
50055. **Severity-count spinner** — Severity filter counts show inline spinners while aggregations compute.
50056. **Collaborator-avatar skeleton** — Gray circles stand in for collaborator avatars in shared hunts.
50057. **Integration-test spinner** — The webhook test button shows "sending test payload…" during the check.
50058. **Phase-grouped timeline skeleton** — Placeholder event rows render grouped under each phase header.
50059. **Skeleton timeout fallback** — After 15 seconds of loading, a "still loading — check connection" hint replaces endless spinners.
50060. **Horizontal phase pipeline** — Recon → Testing → Chaining → Reporting renders as a stepper with live checkmarks and a pulsing current phase.
50061. **Per-phase elapsed labels** — Each phase shows its elapsed time, e.g. "Recon · 4m 12s", updating live.
50062. **Vertical step log** — Timestamped steps collapse per phase with auto-scroll that pauses when the user hovers.
50063. **Events-per-minute sparkline** — A tiny sparkline under the progress bar shows agent activity rate over time.
50064. **Avatar progress ring** — A circular ring around the agent avatar fills as overall hunt completion advances.
50065. **Effort-weighted phase bars** — Phase progress bars are weighted by estimated effort, not raw step counts.
50066. **Timeline milestone markers** — Flags mark first finding, first critical, and PoC generated on the timeline.
50067. **Timeline mini-map** — A compressed overview of the full hunt timeline with a draggable viewport window for long hunts.
50068. **Color-coded step rows** — Steps render green for success, amber for retry, red for failed, and gray for skipped.
50069. **Currently-testing card** — A live card shows the exact URL, payload family, and attempt count being tested now.
50070. **Per-host progress bars** — Progress segments by attack surface with mini bars per host or path.
50071. **Velocity-based ETA** — A countdown like "~12 min remaining" derives from the current phase velocity.
50072. **Finding-rate ticker** — A live ticker reads "3 findings in last 10 min" beside the progress header.
50073. **Expandable step rows** — Clicking a step reveals the exact tool command used and its exit status.
50074. **Phase-transition banner** — A toast plus timeline banner announces transitions, e.g. "Recon complete — 142 URLs mapped".
50075. **Crawl-depth gauge** — A stepped gauge shows current crawl depth versus the configured maximum depth.
50076. **Coverage treemap (hunt-ux)** — A treemap visualizes tested versus untested routes across the target.
50077. **Radar sweep animation** — The target domain card shows an animated radar sweep during recon.
50078. **Reload-persistent progress** — Reopening the page restores the exact last progress state instantly from a snapshot.
50079. **Sub-step payload counter** — Long operations show granular progress like "testing 1,240 payloads: 312/1240".
50080. **Retry-attempt indicator** — Steps display "attempt 2/3" with a visible backoff countdown between retries.
50081. **Parallel worker swimlanes** — Horizontal lanes show each isolated worker with its current step.
50082. **Quiet-period banner** — After 2 minutes without events, a banner reassures "agent still working" with idle elapsed time.
50083. **Findings funnel chart** — A funnel shows candidates → validated → deduplicated → reported with live counts.
50084. **Phase-gate checklist** — Each phase lists its completion criteria with live tick marks as they are met.
50085. **Scope-growth chip** — A chip announces "scope grew +18 URLs" when the crawler discovers new hosts.
50086. **Timeline scrubber (hunt-ux)** — A draggable scrubber jumps the log view to any timestamp in the hunt.
50087. **Activity heat calendar** — A heatmap of activity intensity spans the hunt's full duration.
50088. **Agent-focus spotlight** — One plain-language line highlights exactly what the agent is doing right now.
50089. **Hunt-speed comparison** — A note compares progress to the user's average, e.g. "40% faster than your usual".
50090. **Stalled-phase warning** — An amber banner appears if a phase exceeds twice its historical median duration.
50091. **Nested progress levels** — Three drill-down levels show phase bar → step bar → payload bar.
50092. **Queue-depth readout** — A live counter shows "37 tests queued behind current step".
50093. **Phase-complete check burst** — A checkmark draws with a subtle scale pulse when a phase completes.
50094. **Report-export overlay** — Generating the final report shows "compiling 23 findings…" with a progress bar.
50095. **Per-severity discovery chart** — A stacked area chart plots findings discovered over time by severity.
50096. **Resume catch-up summary** — Returning users see "12 new steps, 3 new findings since you left".
50097. **Gantt-style step bars** — Per-step duration bars render per phase for post-hunt review.
50098. **Context-usage meter** — A live meter shows token and context-window pressure during long hunts.
50099. **Phase-rewind button** — A control on the timeline visually restarts a phase from its checkpoint.
50100. **Critical-finding pulse** — New critical findings trigger a subtle pulse on the timeline, never confetti.
50101. **Validation-confidence ring** — Each finding card shows a ring that fills as validation confidence rises.
50102. **Hunt-health indicator** — A green/amber/red badge reflects error rate and stall detection.
50103. **Decision breadcrumb trail** — A line explains agent choices, e.g. "chose SQLi next because login form found".
50104. **Requests-per-second gauge** — A live gauge shows request throughput during active testing.
50105. **Phase hover preview** — Hovering a phase shows a tooltip with its purpose and typical duration.
50106. **Snapshot checkpoint flags** — Flag icons mark where state snapshots were saved on the timeline.
50107. **Crawler path trace** — An animated trace on the site map shows pages as the crawler visits them.
50108. **Live time-in-phase counter** — Each phase label carries a ticking "time in phase" counter.
50109. **ETA projection cone** — An optimistic/pessimistic ETA band renders on the timeline.
50110. **Step-grouping toggle** — Steps group by phase, by tool, or by target host with one toggle.
50111. **Last-action ticker** — The header shows "2s ago: tested XSS on /search?q=" updating live.
50112. **Findings-badge progress ring** — The findings tab badge shows the count inside a filling progress ring.
50113. **Morphing phase icons** — Phase icons transition magnifier → flask → link → document with smooth morphs.
50114. **Deep-dive indicator** — Spending over 5 minutes on one endpoint shows a "deep dive" badge with the reason.
50115. **Boring-steps filter** — A toggle hides routine 200-OK checks from the step log.
50116. **Actions-per-minute meter** — A WPM-style meter shows the agent's current action rate.
50117. **Timeline infographic export** — One button renders the hunt timeline as a shareable PNG infographic.
50118. **Pause overlay marker** — The timeline shows exactly where the hunt froze when paused.
50119. **Journey-recap replay** — A post-hunt button replays all phases as a 10-second animation.
50120. **Severity color system** — Critical renders red, high orange, medium amber, low blue, info gray, each with a left-border accent.
50121. **Card header layout** — The header combines a severity pill, the finding title, and a CVE-style ID chip in one row.
50122. **Expand-collapse chevron** — A chevron toggles the card open to reveal evidence, PoC steps, and remediation.
50123. **Confidence meter bar** — Each card shows the agent's 0–100% certainty as a slim meter under the title.
50124. **New-finding ribbon** — Findings discovered in the last 10 minutes carry a "NEW" ribbon on the card corner.
50125. **Duplicate fan-out stacking** — Similar findings stack as "3 similar" and fan out into individual cards on click.
50126. **Card footer quick actions** — The footer holds copy-PoC, mark-reviewed, and export-single-finding buttons.
50127. **Inline severity editor** — Clicking the severity pill opens a dropdown to re-grade the finding in place.
50128. **Evidence thumbnails in cards** — Collapsed cards show small previews of screenshots and request snippets.
50129. **Risk-score dial** — A mini dial widget in the card corner visualizes the 0–10 risk score.
50130. **Status tag chips** — Chips like "authenticated", "chained", and "needs-review" classify each finding at a glance.
50131. **Affected-asset line** — The host and path render truncated with the full value revealed on hover.
50132. **Card density toggle** — A comfortable/compact switch changes list density without losing information.
50133. **Chain-link glyph** — Chained findings show a connected-node glyph with a clickable parent reference.
50134. **Distinct keyboard-focus ring** — Focused cards show a focus ring visually distinct from the hover state.
50135. **Hover-reveal actions** — Card actions appear on hover to reduce noise, with a focus-visible fallback for keyboard users.
50136. **Triage status ribbon** — A ribbon tracks New → Triaged → Confirmed → Fixed → Verified on every card.
50137. **Comment count affordance** — A speech-bubble icon with a count opens the card's comment thread.
50138. **Plain-language impact line** — A one-liner under the title explains why the finding matters in simple words.
50139. **Exploitability badge** — Badges distinguish "exploitable in 3 steps" from "theoretical" findings.
50140. **Bulk-select checkboxes** — Selection checkboxes on cards summon a floating bulk-action bar.
50141. **Drag-to-reorder cards** — Cards can be dragged to reorder when custom sort mode is enabled.
50142. **Print-friendly card variant** — A print mode hides action buttons and compacts cards for paper.
50143. **Similar-findings row** — A "similar to" row links related findings for cross-checking.
50144. **Discovery meta line** — Each card notes "found during Testing · 14:32" beneath the tags.
50145. **CVSS vector chip** — The CVSS vector shows as a compact chip that expands into the full breakdown.
50146. **Severity background tint** — Cards carry a 4% severity-color tint for fast visual scanning.
50147. **False-positive dismiss flow** — "Mark as false positive" asks for a reason, then collapses the card to a slim dismissed row.
50148. **Highlighted evidence blocks** — Evidence code blocks include syntax highlighting and line numbers.
50149. **Copy-PoC markdown button** — One button copies a ready-to-paste markdown block of the PoC.
50150. **Screenshot lightbox** — Clicking an evidence thumbnail opens a full-screen viewer with zoom controls.
50151. **Hover peek preview** — Hovering a collapsed card shows a floating preview of its top evidence.
50152. **Severity distribution mini-bar** — A slim stacked bar atop the findings list shows the severity mix.
50153. **Reviewer checkmark** — A checkmark with the reviewer's avatar shows who triaged the finding.
50154. **Remediation checklist** — Remediation steps render as persistent checkboxes inside the expanded card.
50155. **New-card entrance animation** — New cards slide in from the top with a soft severity-tinted highlight flash.
50156. **Request-retest button** — Fixed findings offer "request retest", triggering a verification mini-hunt.
50157. **Affected-parameter chip** — The vulnerable parameter (e.g. `q=`) shows as a chip with its own copy button.
50158. **OWASP category badge** — Badges like A01 or A03 map to OWASP categories with a link to the explainer.
50159. **PoC replay status dot** — A green dot marks replayable PoCs; gray marks manual-only ones in the footer.
50160. **Agent-reasoning section** — A collapsible section explains why the agent flagged this finding.
50161. **Add-to-report toggle** — A per-card toggle controls whether the finding is included in the report.
50162. **Grid versus list view** — Findings can switch between a 2–3 column grid and the classic list.
50163. **Sticky expanded-card header** — The card header sticks to the top while scrolling a long expanded card.
50164. **Share-finding deep link** — A menu action copies a URL that opens the specific card already expanded.
50165. **Retest diff view** — Retest results show an inline before/after response diff on the card.
50166. **Card activity feed** — A mini feed logs who viewed, commented on, or changed the finding's status.
50167. **Escalate button** — An escalate action raises severity with an audit-logged mandatory reason.
50168. **Empty-evidence placeholder** — Cards without screenshots note "no screenshot — request/response only".
50169. **Hover elevation** — Cards lift with a deeper shadow on hover; the active card gets a colored left spine.
50170. **Translate-summary toggle** — A toggle renders the finding summary in the user's own language.
50171. **Reading-time estimate** — Long remediation sections show an estimate like "3 min read".
50172. **Report-inclusion corner fold** — Findings included in the exported report show a folded-corner marker.
50173. **Suppress-similar action** — A card action creates a dedup rule from the finding to suppress lookalikes.
50174. **Embedded PoC-replay player** — Expanded cards embed a replay player for recorded PoC sessions.
50175. **Finding-age indicator** — Cards show "open 6 days" with a color shift as findings age.
50176. **Priority score number** — A sortable score combines severity, confidence, and exploitability into one number.
50177. **Minimize-to-title mode** — Cards can minimize to just their title bar for scanning very long lists.
50178. **Previous-hunt comparison badge** — Cards show NEW, REGRESSED, or FIXED versus the previous hunt on the target.
50179. **Accessible card markup** — Cards use article roles, proper heading hierarchy, and aria-expanded on chevrons.
50180. **Severity multi-select chips** — Severity chips support multi-select with live counts that update as other filters apply.
50181. **Unreviewed quick toggle** — An "only unreviewed" toggle sits beside the severity chips for fast triage.
50182. **Sort dropdown** — Sorting offers severity, confidence, newest, oldest, title A–Z, and priority score.
50183. **Saved filter presets** — Named presets like "Criticals to fix" and "Needs review" apply with one click.
50184. **Removable filter pills** — The filter bar shows each active filter as a removable pill token.
50185. **Conditional clear-all button** — "Clear all" appears only when filters are active and shows the active count.
50186. **Status segmented control** — New, Triaged, Confirmed, Fixed, and Verified filter as a segmented control.
50187. **Confidence slider** — A 0–100% minimum-confidence slider filters out low-confidence noise.
50188. **Scoped text search** — Text search covers titles and evidence combined with the active chip filters.
50189. **Asset filter dropdown** — A dropdown lists affected hosts and paths with per-asset finding counts.
50190. **Evidence-presence toggles** — "Has PoC" and "has screenshot" toggles filter by captured evidence.
50191. **Tag multi-select** — Tags filter through an autocomplete multi-select input.
50192. **Discovery date-range filter** — Presets like last hour, today, and this hunt filter by discovery time.
50193. **OWASP category checklist** — OWASP categories filter through a checklist with finding counts.
50194. **Chained-only toggle** — A toggle isolates multi-step chained findings from singletons.
50195. **Result-count line** — A line reads "Showing 7 of 42 findings" reflecting the current filter set.
50196. **Filter empty-result state** — Zero filter results show guidance naming the active filters plus a clear button.
50197. **Sticky filter bar** — The filter bar sticks to the top when scrolling long findings lists.
50198. **Shareable filter URLs (hunt-ux)** — Copying the URL preserves the exact active filter state for sharing.
50199. **AND/OR filter logic toggle** — Tag filters can combine with AND or OR logic via a toggle.
50200. **Invert severity selection** — Severity chips offer an "invert selection" option for exclusion filtering.
50201. **Slash focuses search** — Pressing / focuses the findings filter search box instantly.
50202. **Recently-used filters** — A row of recently used filters offers one-click reapplication.
50203. **Assignee filter** — Findings filter by reviewer or assignee avatar.
50204. **Exclude-FP default toggle** — "Exclude false positives" defaults on with a visible count of hidden items.
50205. **Persistent sort direction** — Sort direction toggles and persists per user across sessions.
50206. **Group-by control** — The list groups by severity, host, OWASP category, or discovery phase.
50207. **Changed-since-visit filter** — A seen-watermark powers an "only changed since last visit" filter.
50208. **Select-all-filtered (hunt-ux)** — Bulk selection offers "select all 7 shown" for the filtered set.
50209. **Cross-device filter presets** — Saved presets sync across devices through account settings.
50210. **Needs-retest filter** — Fixed findings awaiting verification filter into their own queue view.
50211. **Risk-score range slider** — A min/max slider filters findings by numeric risk score.
50212. **Show-dismissed toggle** — Dismissed false-positive rows reveal in a muted style behind a toggle.
50213. **Severity histogram chips** — Filter chips embed a tiny histogram of the severity distribution.
50214. **My-findings filter** — A filter shows only findings the user personally interacted with.
50215. **Export respects filters** — Export buttons operate on the currently filtered set, stated in the dialog.
50216. **Replayability filter** — Findings filter by PoC replayability: replayable versus manual-only.
50217. **Untriaged-criticals preset** — A one-click emergency preset surfaces untriaged critical findings.
50218. **Collapsible advanced filters** — Advanced filters collapse into a panel, keeping the default bar clean.
50219. **Filter state persistence** — Filter state survives hunt switching and back-navigation.
50220. **Similar-to-this filter** — An open finding seeds a "similar to this" filter for hunting duplicates.
50221. **Regex search toggle** — The text filter offers a regex mode with an inline syntax hint.
50222. **Evidence-type filter** — Findings filter by evidence type: screenshot, request/response, video, or log.
50223. **First-seen sorting** — Sorting distinguishes "first seen" from "last updated" timestamps.
50224. **Starred-findings filter** — Bookmarked findings filter into their own view.
50225. **Filter fix suggestions** — Zero results suggest fixes like "try removing the Low severity filter".
50226. **Drag-to-reorder pills** — Active filter pills drag to reorder, setting precedence in OR mode.
50227. **Mobile bottom-sheet filters** — On mobile the filter bar becomes a bottom sheet with apply and reset.
50228. **Compare-mode filter** — A filter shows only NEW findings versus the previous hunt.
50229. **Confidence-band presets** — Presets like "high only (>80%)" and "review queue (<60%)" filter by band.
50230. **Origin filter** — Findings filter by agent-discovered versus human-confirmed origin.
50231. **Aging filter** — Findings open longer than 7 or 30 days filter for SLA tracking.
50232. **User default filter** — Users can save a default filter, e.g. always hiding Info findings.
50233. **Popular-preset badges** — The most-used filter presets carry a small "popular" badge.
50234. **Undo filter changes** — Ctrl+Z restores the previous filter set after accidental changes.
50235. **Global command palette** — Cmd+K jumps to findings, hunts, reports, and settings from anywhere.
50236. **Fuzzy title matching** — Search tolerates typos, so "xss" matches near-miss spellings in finding titles.
50237. **Debounced search-as-you-type** — Queries debounce at 150ms with matched terms highlighted in results.
50238. **Scoped search tabs** — Results split into This hunt, All hunts, Reports, and Docs tabs.
50239. **Recent searches dropdown** — Recent queries offer one-click rerun plus a clear-all option.
50240. **Named saved searches** — Saved searches carry custom names and pin to the sidebar.
50241. **Search operators (hunt-ux)** — Operators like `sev:critical`, `host:example.com`, and `has:poc` narrow results precisely.
50242. **Operator autocomplete** — Typing `sev:` suggests the valid severity values inline.
50243. **Grouped search results** — Results group by type with icons and per-group counts.
50244. **Keyboard result navigation** — Arrow keys move through results with Enter to open and a visible focus ring.
50245. **No-results operator hints** — Empty results suggest corrections like "did you mean sev:high?".
50246. **Scoped in-card search** — Ctrl+F inside an expanded card searches only its evidence text.
50247. **Persistent search history** — Search history persists per user across sessions.
50248. **Wildcard search** — Queries support wildcards like `admin*` with a hint chip explaining syntax.
50249. **Contextual result snippets** — Each result shows the matched line with surrounding context.
50250. **Search in report preview** — Searching jumps to the finding's page inside the PDF preview.
50251. **Synonym expansion** — "login" also matches "auth", "signin", and "session" automatically.
50252. **Case-sensitivity toggle** — A toggle enables case-sensitive matching for precise evidence searches.
50253. **Persistent tab filters** — Search filters persist when switching between result tabs.
50254. **Quick-filter chips** — Severity, time, and hunt chips sit under the search box for one-tap narrowing.
50255. **Ranked suggestions** — Suggestions rank by recency and frequency of the user's past queries.
50256. **Open-all-results action** — Small result sets offer a bulk "open all results" action.
50257. **Evidence-only scope** — An `in:evidence` scope restricts search to code evidence blocks.
50258. **Highlight-all toggle** — A toggle paints every match across the findings list.
50259. **Search performance note** — Results note "searched 1,204 findings in 0.08s" for transparency.
50260. **Mobile voice search** — A mic button on mobile enables voice input for search queries.
50261. **Terminal log search** — The live terminal log is searchable with jump-to-line on matches.
50262. **Unreviewed search modifier** — An `is:unreviewed` modifier filters to the triage queue.
50263. **Notes and comments search** — Search covers hunt notes and finding comments, not just findings.
50264. **Pinned searches as widgets** — Saved searches can pin to the dashboard as live widgets.
50265. **Encoded search URLs** — Search state encodes into the URL so shared links reproduce the exact query.
50266. **Boolean operators** — AND, OR, NOT with parenthetical grouping build complex queries.
50267. **Relevance explanations** — Hovering a result explains the match, e.g. "matched title + tag".
50268. **Did-you-mean correction** — Misspelled finding titles get a "did you mean" suggestion.
50269. **Natural-language dates** — Date queries accept phrases like "last Tuesday".
50270. **Saved-search digests** — Saved searches can email a digest when new matches appear.
50271. **Shortcut in placeholder** — The search placeholder shows its keyboard shortcut ("/").
50272. **Timeline text search** — An inline search in the scrubber jumps to the first matching event.
50273. **Archived-hunt search** — An "include archived" toggle extends search to archived hunts.
50274. **Hover result preview** — Hovering a result shows the finding summary without opening it.
50275. **Similar-finding search** — "Find similar to #DM-1042" searches for duplicate candidates.
50276. **Copy search link** — A button copies a shareable link reproducing the exact query for the team.
50277. **Typing-throttle indicator** — Very fast typing on huge datasets shows a subtle throttling indicator.
50278. **Search-this-host action** — Any asset chip offers "search this host" as a context action.
50279. **Multilingual search (hunt-ux)** — Search matches finding titles translated into the user's language.
50280. **Personal top queries** — Settings show the user's most-run queries for quick reruns.
50281. **Escape clears search** — Esc clears the search and restores the previous filter state.
50282. **Chain-graph node search** — The chain-graph view supports searching by node label.
50283. **Random-finding button** — A "surprise me" button surfaces a random finding for review gamification.
50284. **Result badges** — Every result row carries a severity dot plus the hunt name.
50285. **Models-page search** — Incremental search also covers the models and plugins page.
50286. **Bang search prefixes** — Prefixes like `!hunt`, `!report`, and `!setting` scope the search instantly.
50287. **Retained search text** — The search input keeps its value when navigating back from a finding.
50288. **Narrow-to-phase chip** — Each result offers a one-click chip to narrow the search to its phase.
50289. **Empty-box suggestions** — Focusing an empty search box shows popular starter queries.
50290. **First-run hero state** — New accounts see an illustration, a "paste your first link" CTA, and a 30-second explainer.
50291. **No-findings-yet reassurance** — During active hunts the empty findings view notes "still testing — 214 checks done".
50292. **Clean-target celebration** — Completed hunts with zero findings show a "clean target" state with the scope summary.
50293. **Filtered-to-zero guidance** — Empty filter results name the active filters and offer a one-click clear button.
50294. **Empty hunt history** — New accounts get a sample demo hunt to explore instead of a blank list.
50295. **Empty chat prompts** — The mid-hunt chat shows tappable suggested questions when empty.
50296. **Empty report list** — A "generate from latest hunt" shortcut fills the empty reports view.
50297. **Empty saved searches** — A hint explains how to save the first search from any query.
50298. **All-caught-up notifications** — Empty notifications show "you're all caught up" with a subtle animation.
50299. **Empty integrations list** — Setup guides per provider fill the empty API-keys and integrations view.
50300. **Empty shared hunts** — An invite CTA with a copyable invite link fills the empty team view.
50301. **Empty insights feed** — The learning feed notes "insights appear after 3 hunts" with a progress hint.
50302. **Empty evidence explainer** — Findings without screenshots explain "agent captured request/response only".
50303. **Empty chain view** — The chain view notes "no chained findings yet — chains appear when findings link up".
50304. **Empty compare view** — A dual hunt selector fills the empty compare view.
50305. **Empty audit log** — The audit log shows a retention-policy note when no events exist.
50306. **Empty scheduled hunts** — A "schedule a recurring hunt" CTA fills the empty schedules list.
50307. **Empty tags hint** — The tags view explains "tags help you organize — add one from any finding".
50308. **Empty comments prompt** — Finding comment threads invite users to "start the discussion".
50309. **Empty watchlist** — The watchlist explains "watch targets to get notified of new findings".
50310. **Empty export history** — Past exports are explained with format options when the history is empty.
50311. **Empty shortcut customization** — Custom bindings show a "using defaults" note with an edit CTA.
50312. **Empty dashboard** — Removing all widgets reveals a widget-gallery CTA instead of blank space.
50313. **Empty search history** — The history view notes "your recent searches will appear here".
50314. **Empty trash** — Recently-deleted items show a restore affordance with the retention timer.
50315. **Inbox-zero review queue** — An empty "needs review" queue celebrates with an "inbox zero" state.
50316. **Empty retest queue** — The retest view explains "fixed findings will queue here".
50317. **Empty model library** — A "download your first brain" CTA per slot fills the empty library.
50318. **Empty scope state** — Hunts still in recon show "mapping in progress" instead of an empty asset tree.
50319. **Queued-hunt empty timeline** — Queued hunts show "hunt starts in ~2 min" with the queue position.
50320. **Empty invoices** — Free-tier users see an empty billing view with a tasteful upgrade nudge.
50321. **Empty ideas list** — Submitted feature ideas show a "suggest a feature" CTA when empty.
50322. **Empty playbook library** — Starter templates to clone fill the empty playbook view.
50323. **Empty webhook deliveries** — A "send a test event" button fills the empty deliveries log.
50324. **Empty profile activity** — User profiles note "your hunt stats will appear here" before the first hunt.
50325. **Empty shared-with-me** — The shared view explains how hunt sharing works when nothing is shared.
50326. **Empty report templates** — A "use the default template" fallback card fills the empty templates view.
50327. **Empty payload lists** — Custom payload lists offer an import-from-file CTA when empty.
50328. **Empty paused hunts** — Paused hunts show resume affordances instead of a bare list.
50329. **Empty mention results** — No dark-web mentions show "no mentions found — we'll keep watching".
50330. **Empty compliance checklist** — The checklist invites users to "run a compliance scan to populate".
50331. **Positive no-breach state** — Empty SLA breaches show a positive "no breaches" state with the policy summary.
50332. **Empty agent memory** — The memory view explains "memory builds as hunts run" with a sample entry.
50333. **Empty attachments hint** — Infinity AI shows a drag-drop hint when no files are attached.
50334. **Empty voice history** — Voice history notes "your voice commands will appear here".
50335. **Empty avatar customization** — A default preview with a "make it yours" CTA fills the empty avatar view.
50336. **Empty scheduled reports** — Cadence presets (weekly, monthly) fill the empty scheduled-reports view.
50337. **Empty target notes** — Target notes prompt "jot context the agent should know" when blank.
50338. **Empty macro list** — Keyboard macros offer a "record your first macro" CTA when none exist.
50339. **Friendly hunt 404** — Bad hunt IDs show "this hunt doesn't exist (or was deleted)" with a home CTA.
50340. **Target-unreachable card** — DNS and connection diagnosis appear with "retry" and "edit target" buttons.
50341. **Hunt-failed banner** — The banner names the exact failing step, shows an error excerpt, and offers "resume from checkpoint".
50342. **Partial-failure notice** — "3 of 40 checks failed — findings still valid" appears with a details toggle.
50343. **Target rate-limit state** — A "target is throttling us — backing off 60s" state shows a live countdown.
50344. **WAF-blocked indicator** — Affected steps show a WAF-blocked badge with an "enable stealth and retry" action.
50345. **Model-download failure** — The failed brain slot, bytes received, and a resume button appear on download errors.
50346. **Invalid Kaggle link error** — A diagnostic with fix steps and a "test connection" button appears for bad links.
50347. **Session-expired overlay** — Re-login happens in an overlay without losing the current hunt state.
50348. **Socket-disconnect banner** — "Live updates paused — reconnecting…" shows with a manual retry button.
50349. **Quota-exceeded state** — The exhausted quota is named with its reset time and an upgrade path.
50350. **Inline URL validation** — Invalid target URLs get an inline message with an example of a good URL.
50351. **Scope-violation block** — "Target out of authorized scope" shows the matched rule that blocked it.
50352. **Report-generation failure** — "PDF failed at page 12" offers retry or "download markdown instead".
50353. **ZIP-export failure** — Per-file errors list with a "retry failed files" button on export failure.
50354. **Permission-denied sharing** — A "request access" button notifies the hunt owner when access is denied.
50355. **Upload-too-large error** — The size limit shows with a compress suggestion on oversized uploads.
50356. **Unsupported-target notice** — Unsupported types explain the limitation and suggest alternatives.
50357. **Agent-stall error** — After 10 minutes without progress, options to restart the phase or download diagnostics appear.
50358. **Payment-failed state** — Tier-upgrade payment failures show retry plus an invoice link.
50359. **SSO error mapping** — Provider errors map to plain-language fixes for login failures.
50360. **Storage-full warning** — A warning with a cleanup CTA appears when local snapshots cannot save.
50361. **Version-mismatch banner** — "Frontend v2.4 needs backend ≥2.4" prompts an update when versions drift.
50362. **Maintenance-mode page** — A branded page shows the status link and estimated return time.
50363. **Friendly 500 fallback** — Server errors show a friendly message, an auto-attached error ID, and "copy diagnostics".
50364. **Offline queue banner** — Queued actions show "3 actions will sync when you're back" while offline.
50365. **Card error boundary** — A failed finding card renders an isolated error so one bad card never kills the list.
50366. **Timeline-gap marker** — Connection drops render as inline "events missing 14:02–14:07" markers.
50367. **PoC-replay failure diff** — Failed replays show expected-versus-actual diffs with a "report as flaky" action.
50368. **Screenshot-capture placeholder** — Failed captures show a placeholder with a "retry capture" button.
50369. **Mic-blocked error** — Voice input failures link to browser mic settings with setup help.
50370. **Avatar fallback portrait** — Avatar render failures fall back to a static portrait with a retry button.
50371. **Stale-index notice** — "Results may be up to 5 min old" appears with a reindex button.
50372. **Impossible filter combination** — Contradictory filters explain "no findings can match X + Y" with a fix suggestion.
50373. **Scheduled-hunt failure** — Failed scheduled runs notify with the reason and a "run now" button.
50374. **Webhook failure log** — Per-delivery statuses render with a redelivery button for failures.
50375. **Bulk-action partial failure** — "21 of 24 updated — 3 failed" lists per-item reasons.
50376. **Comment draft preservation** — Failed comment posts keep the draft in the box with a retry button.
50377. **Theme-asset fallback** — Broken theme assets fall back to the default theme with a notice.
50378. **Print fallback** — Unavailable print previews suggest "download PDF instead".
50379. **Clipboard-denied fallback** — Blocked clipboard access opens the text in a selectable modal instead.
50380. **Shortcut-conflict warning** — Assigning a duplicate binding warns before overwriting it.
50381. **CSV-import errors** — Row-by-row validation errors list with a "download error report" button.
50382. **Timezone warning** — Unexpected timezones show a warning with a one-click zone switcher.
50383. **Aria-label dev overlay** — Staging builds flag missing accessible names in a dev-only overlay.
50384. **Deleted-finding deep link** — Links to removed findings explain the removal and link back to the hunt.
50385. **Concurrent-edit merge UI** — Conflicting finding-note edits show a side-by-side merge interface.
50386. **Snapshot-restore failure** — Corrupted snapshots offer "start fresh" plus an export of salvageable data.
50387. **Desktop-bridge disconnect** — A reconnect wizard appears when the desktop runtime disconnects.
50388. **Inference-timeout option** — Slow brains offer a "simplified retry" when inference times out.
50389. **Disk-quota warning** — Evidence storage warnings include cleanup suggestions with size breakdowns.
50390. **CORS-blocked preview** — Blocked target iframes offer an "open in new tab" fallback.
50391. **Expired share link** — Expired links show a page with a "request a new link" action.
50392. **Duplicate-hunt detection (hunt-ux)** — Re-hunting a known URL offers "view existing" or "start fresh".
50393. **Invalid-regex notice** — Bad regex in search shows the exact syntax error position.
50394. **WebGL-degraded banner** — Missing WebGL degrades the 3D chain view to 2D with an explanatory banner.
50395. **Severity pill tooltips** — Hovering a severity pill explains the level with a concrete example.
50396. **Confidence-score popover** — An info icon explains how the 0–100% confidence score is computed.
50397. **Target-input format help** — Inline help under the URL input shows accepted formats with examples.
50398. **Phase tooltips** — Hovering each pipeline phase describes what it does and its typical duration.
50399. **Risk-score breakdown popover** — A "what's this?" popover breaks the risk score into its factors.
50400. **First-hover coach marks** — Advanced filter operators show a one-time coach mark with a "don't show again" option.
50401. **Pause-button tooltip** — The tooltip clarifies "pauses after the current step — nothing is lost".
50402. **Empty-PoC hint** — Empty PoC sections note "PoC steps appear once validation finishes".
50403. **Shortcut hints in tooltips** — Button tooltips include shortcuts, e.g. "Mark reviewed (R)".
50404. **Chain-icon tooltip** — The chain icon's tooltip explains how finding relationships are formed.
50405. **Per-page help panel** — A slide-over help panel offers contextual docs links for every page.
50406. **ETA tooltip** — The ETA tooltip cites its basis: "based on your last 12 hunts' phase speeds".
50407. **False-positive tag explainer** — The "false-positive suspect" tag expands to show the triggering signals.
50408. **Interactive CVSS breakdown** — A help icon by the CVSS vector opens an interactive score breakdown.
50409. **Tier-badge tooltip** — The Infinity badge tooltip clarifies what unlimited usage actually covers.
50410. **Scope-input guidance** — Inline guidance contrasts CIDR, domain, and URL scope formats with examples.
50411. **Worker-lane tooltip** — Hovering a lane explains "each lane is an isolated test worker".
50412. **Notification why-link** — Every notification carries a "why am I seeing this?" link to its trigger rule.
50413. **Snapshot tooltip** — The snapshot icon's tooltip shows "hunt state saved 2 min ago".
50414. **Cron-expression helper** — Schedule inputs show a plain-English preview of the cron expression.
50415. **Dedup tooltip** — Merged findings explain "merged with 2 similar findings — view rule".
50416. **Scrubber help popover** — The timeline scrubber's help covers drag, arrow keys, and jump-to-event.
50417. **Model-slot tooltips** — Vision, Grounding, and Hacking slots each describe their brain's job on hover.
50418. **Tracking-param hint** — Pasting a URL with tracking params notes "we'll strip utm_* automatically".
50419. **Ask-agent examples** — The ask-agent input tooltip shows three example questions to try.
50420. **Fix-oriented validation** — Field errors explain the fix, not just the failure, e.g. "add https://".
50421. **Export-format tooltip** — The export dropdown compares PDF, Markdown, and JSON trade-offs.
50422. **Compliance-badge links** — Compliance badges link inline to the requirement text they satisfy.
50423. **Collaborator tooltips** — Avatars show name, role, and last action on hover.
50424. **Confidence-slider help** — Help text notes "below 60% usually needs human review".
50425. **Findings-badge tooltip** — The badge tooltip reads "12 new since you last opened this hunt".
50426. **Regenerate-button hint** — An onboarding tooltip explains the report regenerate button's cost and time.
50427. **Archived-hunt tooltip** — Archived hunts note "read-only — duplicate to re-run".
50428. **What-happens-next stepper** — After pasting a URL, a hint stepper previews the upcoming phases.
50429. **Terminal-copy tooltip** — The terminal copy button clarifies it copies with or without timestamps.
50430. **Jargon glossary tooltips** — Hovering terms like SSRF or IDOR shows a one-line definition.
50431. **Theme hover previews** — The theme switcher previews each theme live on hover.
50432. **Bulk-action hint** — Bulk action bars note "applies to the 7 selected findings".
50433. **SLA-badge tooltip** — The SLA badge tooltip explains the countdown policy behind it.
50434. **Widget help affordance** — The empty dashboard explains "what is a widget?" with examples.
50435. **Huntability meter** — The target input shows a URL "huntability" score like a password-strength meter.
50436. **Bell tooltip** — The notification bell tooltip groups counts by category.
50437. **Helpful-vote thumbs** — Help popovers ask "did this help?" to feed documentation improvements.
50438. **Diff-legend tooltip** — The diff view legend explains green as added, red as removed, gray as moved.
50439. **Drop-zone hints** — Drag-and-drop zones list accepted file types and size limits inline.
50440. **Avatar mood tooltip** — The avatar's mood dot tooltip reads "focused", "waiting", or "stuck".
50441. **Rotating tips bar** — A dismissible bar shows one power-user tip per page visit.
50442. **Verified-checkmark tooltip** — The verified checkmark names who verified and when.
50443. **Share-link explainer** — Inline help covers share-link expiry, permissions, and revoke controls.
50444. **Simulate-toggle clarification** — Where a simulate toggle exists, a tooltip clarifies mock versus real behavior.
50445. **Shortcut cheat sheet (hunt-ux)** — Shift+? opens a searchable, printable cheat sheet of all shortcuts.
50446. **J/K list navigation** — J and K move through the findings list with the active card highlighted.
50447. **Enter/Esc card toggle** — Enter expands or collapses the focused card; Esc collapses it.
50448. **Single-key triage** — R marks reviewed, F flags false positive, and S stars the focused finding.
50449. **Slash-focus search** — Pressing / focuses findings search; Esc returns focus to the list.
50450. **G-prefix page jumps** — G then H jumps to Hunt, G then I to Infinity AI, G then M to Models.
50451. **Space pause/resume** — Space toggles pause and resume on the active hunt from anywhere.
50452. **Number-key severity filters** — Keys 1–4 jump to critical through low severity filters.
50453. **N/P phase navigation** — N and P move between phases in the timeline view.
50454. **Bracket timeline scrub** — [ and ] scrub the timeline backward and forward by event.
50455. **C copies PoC** — C copies the focused finding's PoC as formatted markdown.
50456. **E exports view** — E exports the current filtered view with a format picker.
50457. **T focuses chat** — T focuses the mid-hunt chat input; Ctrl+Enter sends the message.
50458. **A opens ask-agent** — A opens the ask-agent panel scoped to the current hunt.
50459. **D toggles density** — D switches card density between comfortable and compact.
50460. **V toggles view** — V switches findings between list and grid view.
50461. **O opens full page** — O opens the focused finding in a dedicated full-page view.
50462. **B toggles sidebar** — B collapses or expands the hunt-history sidebar.
50463. **M mutes sounds** — M mutes and unmutes notification sounds globally.
50464. **Question-mark help** — ? opens contextual help for the current page.
50465. **Arrow-key timeline walk** — Arrow keys move through timeline events with a visible focus ring.
50466. **Logical tab order** — Tab order follows the visual order: header, filters, list, detail.
50467. **Skip links** — "Skip to findings", "skip to timeline", and "skip to chat" links top every page.
50468. **Modal focus trap** — Modals trap focus and return it to the trigger element on close.
50469. **Command palette (Ctrl+K variant)** — Ctrl+K opens a palette for hunts, actions, settings, and docs.
50470. **Ctrl+Shift+F global search** — The shortcut focuses global search pre-scoped to the current hunt.
50471. **Alt+number widget focus** — Alt+1..9 moves dashboard widget focus; Enter opens the widget detail.
50472. **X bulk selection** — X selects the focused card; Shift+X selects a contiguous range.
50473. **U undo status change** — U undoes the last finding-status change with a toast confirmation.
50474. **Ctrl+D duplicate hunt** — The shortcut duplicates the current hunt configuration as a new draft.
50475. **Period quick menu** — Pressing . opens the quick-action menu for the focused finding.
50476. **Shift+R request retest** — The shortcut requests retest on the focused fixed finding.
50477. **L toggles terminal** — L toggles the live terminal panel; Shift+L pops it into a window.
50478. **W watch toggle** — W toggles "watch" on the focused target or finding.
50479. **Z zen mode** — Z toggles a zen mode hiding all chrome except the hunt itself.
50480. **Expand/collapse all** — Shift+E expands all findings; Shift+C collapses them all.
50481. **Home/End list jumps** — Home and End jump to the first and last finding in the list.
50482. **PageUp/PageDown scroll** — The keys scroll the findings list by viewport height.
50483. **Ctrl+, settings** — Ctrl+, opens settings; Ctrl+. cycles the theme menu.
50484. **Printable shortcut card** — Settings offer a printable shortcut reference with "reset to defaults".
50485. **Remappable shortcuts** — A remapping UI supports custom bindings with conflict detection.
50486. **Adaptive shortcut hints** — Tooltips start showing shortcuts after three mouse uses of the action.
50487. **Typing-mode guard** — Single-key shortcuts disable while typing, with a visible indicator.
50488. **F6 region cycling** — F6 cycles focus through nav, main, sidebar, and chat regions.
50489. **Ctrl+Shift+E finding PDF** — The shortcut exports the focused finding as a single-finding PDF.
50490. **Alt+arrows hunt history** — Alt+Left/Right walks hunt history like browser back/forward.
50491. **New-shortcut highlights** — Shift+? highlights shortcuts added since the last update.
50492. **Numbered chat suggestions** — Suggestion chips show number badges; pressing 1–5 picks one.
50493. **Ctrl+Enter starts hunt** — Pressing Ctrl+Enter in the target input starts the hunt immediately.
50494. **Esc hierarchy** — Esc closes menus first, then collapses cards, then clears search, then blurs input.
50495. **Phase-pipeline arrows** — Arrow keys navigate the phase pipeline; Enter opens phase detail.
50496. **Keyboard-operable tour** — Every onboarding-tour step works fully by keyboard.
50497. **Shift+N newest finding** — The shortcut jumps focus to the newest finding in the list.
50498. **Ctrl+Shift+C deep link** — The shortcut copies a deep link to the focused finding.
50499. **Keyboard-first onboarding** — An optional mode interactively teaches five core shortcuts.
50500. **Screen-reader hunt narration** — Phase changes announce through an aria-live region during the hunt.
50501. **Never color-alone severity** — Severity always pairs color with text and an icon.
50502. **High-contrast focus outlines** — Every interactive element shows a 3px high-contrast focus-visible outline.
50503. **Reduced-motion mode (hunt-ux)** — Shimmer, confetti, and auto-scroll animations disable under prefers-reduced-motion.
50504. **Contrast minimums** — Body text meets 4.5:1 contrast; large text and UI icons meet 3:1.
50505. **Listbox findings** — The findings list behaves as a semantic listbox with aria-activedescendant support.
50506. **New-finding announcements** — A live region announces "Critical finding added: SQL injection on /login".
50507. **Ordered timeline list** — Timeline steps expose as an ordered list with per-step status text.
50508. **Skip-navigation links** — Skip links top every page for keyboard and screen-reader users.
50509. **Named icon buttons** — All icon-only buttons carry accessible names via aria-label.
50510. **Visible input labels** — Form inputs pair with visible labels instead of placeholder-only text.
50511. **Assertive error announcements** — Errors announce assertively and link to the offending field.
50512. **Modal focus management** — Dialogs trap focus and return it to the trigger on close.
50513. **Toast live region** — Toasts mirror to a polite live region with their action buttons reachable.
50514. **Color-blind-safe palette** — The severity palette is tested against deuteranopia and protanopia.
50515. **Chart data tables** — Every visualization offers a data-table toggle as a text alternative.
50516. **Keyboard chain graph** — Graph nodes are focusable and arrow keys traverse the edges.
50517. **200% text resizing** — Layouts survive 200% text scaling without breakage or clipped cards.
50518. **44px touch targets** — All buttons, chips, and card actions meet the 44×44px minimum.
50519. **Visual-order focus** — Focus order matches the visual order across the hunt layout grid.
50520. **Prefers-contrast support** — The prefers-contrast query automatically boosts borders and text weights.
50521. **Hunt screen-reader summary** — Loading a hunt announces "Hunt on example.com, phase Testing, 12 findings".
50522. **Hidden decorative animation** — Decorative animations carry aria-hidden so assistive tech ignores them.
50523. **Status-change announcements** — Pause, resume, and completion announce in the live region.
50524. **Sortable table semantics** — Findings tables use proper th scope with sortable-column announcements.
50525. **Reduced transparency** — Glassmorphism panels respect the reduce-transparency preference.
50526. **Code-block focus contrast** — High-contrast focus indicators work inside evidence code blocks.
50527. **Screenshot alt text** — Evidence screenshots get auto-generated alt text from finding metadata.
50528. **Avatar speech captions** — The avatar's spoken responses always include captions or transcripts.
50529. **Speakable action names** — Every action has a speakable name for voice-control users.
50530. **Terminal Esc exit** — The terminal panel never traps keyboards; Esc always exits its focus.
50531. **Throttled progress announcements** — Long operations announce progress at 10% steps, never per frame.
50532. **Page landmarks** — Header, nav, main, complementary, and contentinfo landmarks exist on every page.
50533. **Unskipped heading levels** — Heading hierarchy never skips levels in cards and reports.
50534. **Descriptive link text** — Links read "Download PDF report", never "click here".
50535. **Autocomplete attributes** — Login and signup forms use proper autocomplete attributes.
50536. **Text alongside animation** — Progress always shows as text percentages alongside any animation.
50537. **Dual timestamps** — Relative times like "3 minutes ago" include absolute times in the title attribute.
50538. **Explained disabled buttons** — Disabled buttons use aria-disabled plus a tooltip explaining why.
50539. **Theme-tested severity tints** — Severity tints meet contrast minimums in both dark and light themes.
50540. **Roving tabindex list** — Focus is retained when the findings list re-renders via roving tabindex.
50541. **Announced filter changes** — Filter changes announce "Showing 7 of 42 findings" in a live region.
50542. **Keyboard severity slider** — The confidence slider steps with arrow keys and reads values aloud.
50543. **Describe-this-chart button** — Any visualization can generate a textual summary on demand.
50544. **Low-vision spacing rhythm** — A consistent 8px spacing rhythm aids low-vision scanning.
50545. **Underlined links** — Links inside finding descriptions underline instead of relying on color alone.
50546. **Non-haptic confirmations** — Destructive actions confirm with visual plus text feedback.
50547. **Nested-list graph fallback** — The chain graph exposes a nested list of node relationships.
50548. **Announced agent typing** — The agent's "typing" state in mid-hunt chat is announced to screen readers.
50549. **Reduced-data mode** — Prefers-reduced-data disables auto-playing previews and heavy animation.
50550. **Keyboard drag equivalents** — Drag handles show visible focus and every drag has a keyboard equivalent.
50551. **Form error summary** — Forms list all errors at the top with anchor links to each field.
50552. **Timeout announcements** — Session timeouts announce "session expires in 2 minutes" with an extend option.
50553. **Keyboard date entry** — Date pickers always offer a keyboard-entry fallback.
50554. **Readability settings** — Line height of 1.5 and adjustable letter spacing live in readability settings.
50555. **Dyslexia-friendly font** — An accessibility toggle switches to a dyslexia-friendly typeface.
50556. **Acronym expansion** — Acronyms like SSRF expand on first use for screen-reader pronunciation.
50557. **Scroll-margin focus** — Sticky headers never obscure focused elements thanks to scroll-margin.
50558. **Announced bulk results** — Bulk actions announce results like "24 findings marked reviewed".
50559. **Accessibility statement** — A public statement page lists the conformance level and a feedback channel.
50560. **New-card slide-in** — New findings slide in with a 300ms ease-out and a fading severity-tinted flash.
50561. **Self-drawing checkmark** — Phase completion draws its checkmark with an SVG stroke animation.
50562. **Pill hover scale** — Severity pills scale to 1.05 with a soft shadow on hover.
50563. **Button press feedback** — Primary buttons scale to 0.97 for 80ms on press for tactile feel.
50564. **Sliding tab indicator** — A tab underline glides between tabs instead of jumping.
50565. **Chevron rotation** — Expand chevrons rotate 180° while the card height animates smoothly.
50566. **Stat count-up** — Dashboard stats count from 0 to their value over 800ms on load.
50567. **Progress shimmer sweep** — Indeterminate bars show a shimmer sweep that eases into determinate mode on data.
50568. **Toast slide-fade** — Toasts slide up and fade in; dismissal collapses height while sliding down.
50569. **Diagonal skeleton sweep** — Skeleton shimmer sweeps diagonally on a 1.2s loop, paused under reduced-motion.
50570. **Terminal line fade** — New terminal lines fade from 40% opacity to full over 200ms.
50571. **Timeline dot pop** — Live timeline dots pop with a small scale bounce as they arrive.
50572. **Filter-pill morph** — Pills scale in on add and collapse width before fading on remove.
50573. **Thinking-dot wave** — Three dots bounce in a staggered wave while the agent reasons.
50574. **Card hover lift** — Cards lift 2px with a softened shadow over 150ms on hover.
50575. **Modal scale-in** — Backdrops fade in 150ms while panels scale from 0.96 to 1 with ease-out.
50576. **Confidence fill ease** — Confidence meters fill with an eased width transition when cards expand.
50577. **Donut segment sweep** — Severity donut segments sweep into place on first render.
50578. **Drop-zone pulse** — File drop zones pulse with an animated dashed border on drag hover.
50579. **Spring toggles** — Toggle switches slide with a spring curve and a subtle scale kick.
50580. **Smooth auto-scroll** — Step-log auto-scroll uses smooth scrolling unless the user recently scrolled up.
50581. **Completion ring pulse** — The summary card emits a subtle ring pulse on hunt completion.
50582. **Gauge needle sweep** — The risk-gauge needle sweeps to its score with ease-in-out over 900ms.
50583. **Ribbon slide-in** — "NEW" ribbons slide in from the card edge on discovery.
50584. **Staggered search results** — Results fade in at 30ms stagger intervals for perceived speed.
50585. **Theme cross-fade** — Theme switches cross-fade backgrounds and surfaces over 250ms.
50586. **Graph node settle** — Chain-graph nodes spring into place with a force-layout settle animation.
50587. **Copy-button morph** — Copy icons flip to a checkmark with a 120ms rotation on success.
50588. **Dual-ring spinner** — Loading spinners use a dual-ring design rotating at 0.8s per revolution.
50589. **Floating empty illustration** — Empty-state illustrations drift ±6px on a 4s loop to feel alive.
50590. **Focus-ring draw** — Focus rings draw in with a 120ms outline-offset transition.
50591. **Sticky-bar shadow** — The filter bar gains its shadow through a scroll-triggered transition.
50592. **Route fade-rise** — Page changes fade in over 180ms with an 8px upward rise.
50593. **Badge count pop** — Notification badges pop with a scale bounce when the count increments.
50594. **Height-animated reasoning** — The "agent reasoning" section animates height instead of jumping open.
50595. **Scrubber handle grow** — The timeline scrubber handle grows on hover for easier grabbing.
50596. **Chip fill wipe** — Active filter chips fill with a left-to-right color wipe.
50597. **Invalid-input shake** — Invalid inputs shake 4px horizontally over 300ms.
50598. **Save checkmark draw** — Save actions draw a checkmark, hold 1.2s, then fade.
50599. **Sidebar width animation** — The sidebar animates 280px to 64px wide with icon cross-fades.
50600. **Thumbnail zoom hover** — Evidence thumbnails zoom to 1.08 with an "expand" overlay fade on hover.
50601. **Status-change flash** — Step rows flash their new status color briefly, then settle.
50602. **Chat typing pulse** — Chat typing indicators pulse three dots with staggered opacity.
50603. **Avatar ring progress** — The avatar's progress ring animates stroke-dashoffset as the hunt advances.
50604. **Reconnect banner slide** — The "catching up" banner slides down from the header on reconnect.
50605. **Checkbox spring draw** — Selection checkmarks draw with a spring overshoot.
50606. **Sort-arrow flip** — Sort direction arrows flip with a 200ms rotation.
50607. **Thumbnail cascade** — Report page thumbnails cascade in with a staggered rise on preview open.
50608. **Pause-play morph** — The pause button cross-fades its icon and slides its label when toggling.
50609. **Animation time budget** — All animations cap at 400ms and disable entirely under prefers-reduced-motion.
50610. **Mobile single-column hunt** — Small screens stack the hunt into one column with a compact stepper.
50611. **Mobile bottom tab bar** — Phones get a bottom bar with Hunt, Findings, Chat, and More tabs.
50612. **Swipeable finding rows** — Mobile finding cards become swipeable rows with swipe-to-review actions.
50613. **Collapsible mobile timeline** — The timeline collapses to a vertical feed with a sticky "now" marker.
50614. **Filter FAB sheet** — On mobile the filter bar becomes a floating button opening a bottom-sheet panel.
50615. **Single-column widgets** — Dashboard widgets reflow to one column, most-used first, on phones.
50616. **Mobile terminal view** — The live terminal gets a monospace-optimized mobile layout with scroll locking.
50617. **Tablet two-pane layout** — Tablet landscape splits findings list and detail with a draggable divider.
50618. **48px touch chips** — Severity chips use 48px touch targets with press-state feedback.
50619. **Paginated mobile reports** — Report previews paginate into cards on mobile instead of wide PDF views.
50620. **Full-screen mobile chat** — The chat panel becomes a full-screen sheet with a safe-area-aware input.
50621. **Card-list tables** — Tables transform into card lists below 720px width.
50622. **Condensed mobile header** — Narrow viewports show logo, hunt status, and an overflow menu only.
50623. **Pinch-zoom evidence** — Evidence screenshots and the chain graph support pinch-to-zoom on touch.
50624. **Slim mobile offline banner** — The offline banner compresses to a single line with an icon on mobile.
50625. **Repositioned tour steps** — Onboarding steps reposition on small screens so they never cover CTAs.
50626. **Bottom mobile toasts** — Toasts stack from the bottom on mobile and the top on desktop.
50627. **Full-screen mobile palette** — The command palette becomes a full-screen search sheet on phones.
50628. **Landscape stepper visibility** — Landscape phones keep the phase stepper visible above the fold.
50629. **Foldable-device spanning** — Spanned foldables move the detail pane into the second screen area.
50630. **320px minimum support** — Layouts work at 320px wide with no horizontal page scrolling.
50631. **Tablet portrait split** — Portrait tablets split 40/60 between list and detail with a collapsible list.
50632. **Dynamic viewport units** — Mobile layouts use dvh units so browser chrome never clips the chat input.
50633. **Fluid type scale** — Typography scales fluidly from a 14px mobile base to 16px on desktop.
50634. **Code-wrap toggle** — Evidence code blocks offer a "wrap lines" toggle on narrow screens.
50635. **Sticky mobile CTA** — The "Start Hunt" button stays visible while scrolling the mobile landing.
50636. **Auto-fit widget grid** — Dashboards use CSS grid auto-fit with minmax(280px, 1fr) columns.
50637. **Pull-to-refresh lists** — Hunt and findings lists support mobile pull-to-refresh.
50638. **Adaptive log density** — Step logs render compact rows on mobile and full rows on desktop.
50639. **Gesture guide** — Touch-only devices replace the shortcuts page with a gesture guide.
50640. **Swipe triage gestures (hunt-ux)** — Swiping right marks reviewed; swiping left snoozes a finding.
50641. **Long-press quick menu** — Long-pressing a finding card opens its quick-action menu on touch.
50642. **Responsive thumbnails** — Evidence thumbnails serve smaller image sizes on mobile connections.
50643. **Print layout override** — Print CSS forces a desktop-like single column regardless of screen size.
50644. **Orientation-safe scroll** — Rotating the device preserves scroll position and open-card state.
50645. **Notch safe areas** — Layouts respect env(safe-area-inset-*) on notched phones.
50646. **Hybrid tablet UI** — Tablets keep hover tooltips while maintaining large touch targets.
50647. **Collapsed mobile sections** — Collapsible sections default collapsed on mobile to reduce scroll depth.
50648. **OS text-size respect** — Font sizing scales with the OS text-size setting through rem units.
50649. **Save-Data degradation** — Heavy animations degrade automatically on 2G/3G or Save-Data mode.
50650. **Short mobile empty states** — Empty states use shorter copy variants on small screens.
50651. **Swipeable phase carousel** — The phase pipeline becomes a swipeable horizontal carousel on mobile.
50652. **Mobile tab badge** — The findings count badge stays live in the mobile tab bar.
50653. **Bottom-sheet modals** — Dialogs become drag-to-dismiss bottom sheets under 640px.
50654. **Large touch sliders** — Range-slider handles grow larger on touch devices.
50655. **Full-bleed tablet graph** — Landscape tablets show the chain graph full-bleed with a floating legend.
50656. **Desktop-site toggle** — A mobile menu option forces the desktop layout for power users.
50657. **Responsive focus order** — Opening a card moves focus correctly at every breakpoint.
50658. **Container-query widgets** — Widgets use container queries to adapt inside any dashboard layout.
50659. **Tested-width note** — Settings note the tested range "optimized for 360px → 2560px" with a feedback link.
50660. **Three core themes** — Dark (default), Light, and High-Contrast (WCAG AAA-oriented) ship as first-class themes.
50661. **OS-preference following** — The app follows the OS theme automatically with a manual override available.
50662. **Sunset auto-switch** — A schedule switches to dark after sunset based on the user's timezone.
50663. **Per-page theme memory** — The report preview can stay light while the rest of the app is dark.
50664. **Per-theme severity mapping** — Severity colors remap per theme, e.g. darkened reds in light mode, to hold contrast.
50665. **Theme preview thumbnails** — Settings show live mini hunt-UI previews for each theme.
50666. **High-contrast surfaces** — The high-contrast theme uses pure black/white surfaces with 7:1 text contrast and thick focus rings.
50667. **Dim intermediate theme** — A dark-gray "dim" theme suits low light without pure-black harshness.
50668. **Matched syntax themes** — Evidence code blocks use syntax highlighting matched to the active UI theme.
50669. **Theme-aware chart palette** — Charts use distinct per-severity hues tuned for each theme.
50670. **Flash-free theme transition** — Theme changes cross-fade over 250ms with no unstyled-content flash.
50671. **Themed favicon** — The favicon and PWA theme-color meta update with the active theme.
50672. **Light print default** — Printing always renders in the light theme for ink efficiency, configurable in settings.
50673. **Themed email templates** — Notification emails follow the recipient's theme preference.
50674. **Forced link underlines** — High-contrast mode underlines all links and borders all cards.
50675. **Accent-color picker** — Six presets plus a color wheel customize the accent across all themes.
50676. **Themed logo variants** — Light and dark wordmark variants swap automatically with the theme.
50677. **Auto reduced transparency** — High-contrast mode automatically disables glassmorphism transparency.
50678. **Code line-number contrast** — Code-block line numbers hold 4.5:1 contrast in every theme.
50679. **Themed skeleton shimmer** — Skeleton shimmer colors tune per theme to avoid blinding flashes in dark mode.
50680. **Adaptive focus-ring color** — Focus rings render cyan in dark, deep blue in light, and yellow in high-contrast.
50681. **Themed scrollbars** — Scrollbars use thin, theme-matched styling.
50682. **Themed selection color** — Text selection colors pair with sufficient contrast per theme.
50683. **Synced theme preference** — The theme persists per device and syncs as an account preference.
50684. **OLED true-black toggle** — A toggle inside the dark theme switches to true-black OLED surfaces.
50685. **Sepia reading theme** — A warm sepia theme option eases long report-reading sessions.
50686. **Balanced severity tints** — Severity tints use 4% opacity in dark and 8% in light for equal visibility.
50687. **High-contrast tables** — A data-table mode adds zebra rows and strong cell borders.
50688. **Auto-contrast guard** — Custom accent colors auto-adjust their text pairing to stay legible.
50689. **Theme-cycle shortcut** — Ctrl+. cycles Dark → Light → High-contrast instantly.
50690. **Themed embedded reports** — Embedded report iframes inherit the viewer's theme via postMessage.
50691. **Themed progress accents** — Spinners and progress bars use theme-aware accent colors.
50692. **Distinguishable error colors** — Error states pair red/green with icons and text in high-contrast mode.
50693. **Announced theme changes** — Screen readers hear "Switched to light theme" on theme change.
50694. **Theme-gated gradients** — Wallpaper gradients appear only in dark/dim themes; light stays flat.
50695. **Themed empty illustrations** — Empty-state illustrations ship in dark and light variants.
50696. **Contrast-ratio readout** — The theme customizer shows the contrast ratio of the chosen palette.
50697. **Forced-colors support** — The Windows High Contrast forced-colors query maps to system colors.
50698. **Instant themed cards** — Newly opened finding cards apply the theme instantly with no per-card flash.
50699. **IDE-theme sync option** — Code blocks can sync to the user's chosen IDE theme.
50700. **High-contrast focus spec** — High-contrast focus uses a 3px solid outline with 2px offset on every control.
50701. **DND-aware scheduling** — Theme scheduling skips transitions during do-not-disturb hours.
50702. **Per-hunt theme override** — Individual hunts can pin high-contrast for focused review sessions.
50703. **Theme JSON export** — Themes export and import as JSON for team standardization.
50704. **First-run theme picker** — Onboarding shows three large theme previews to choose from.
50705. **Active-hunts widget** — Each running hunt shows its live phase and a progress ring.
50706. **Clickable severity donut** — Donut segments click through to the matching filtered findings.
50707. **Weekly-findings sparkline** — A sparkline shows findings this week with a week-over-week delta.
50708. **Throughput widget** — Hunts completed per day render for the last 30 days.
50709. **Needs-review widget** — The top five unreviewed findings list with quick-review actions.
50710. **Top-vulnerable-targets widget** — Targets rank by critical-finding count with trend arrows.
50711. **Agent-activity heatmap** — A 24×7 grid visualizes when the agent is most active.
50712. **Time-to-first-finding widget** — The average time to first finding shows with a trend arrow.
50713. **False-positive-rate widget** — Per-engine FP rates show with a 30-day sparkline.
50714. **Report-ready widget** — Hunts awaiting report generation list with one-click generate buttons.
50715. **Scheduled-hunts widget** — The next five scheduled runs show with live countdowns.
50716. **Integration-health widget** — Connected providers show green, amber, or red health dots.
50717. **Learning-applied widget** — Rules the agent learned this week list with concrete examples.
50718. **Storage-usage widget** — Evidence and snapshot usage versus quota shows with a cleanup CTA.
50719. **Team-leaderboard widget** — An opt-in board ranks confirmed findings per researcher.
50720. **SLA-risk widget** — Findings approaching SLA breach sort by urgency with countdowns.
50721. **Recent-reports widget** — Recent reports show thumbnails, dates, and download buttons.
50722. **Watchlist widget (hunt-ux)** — Watched targets carry new-finding badges.
50723. **Model-status widget** — Each brain slot shows version, location (local/Kaggle), and health.
50724. **Hunt-calendar widget** — A month view plots scheduled and completed hunts.
50725. **Cost-usage widget** — Tier usage shows with a projected month-end estimate.
50726. **Webhook-delivery widget** — The last ten deliveries show with status dots and retry links.
50727. **Payload-family widget** — A bar chart ranks the most effective payload families.
50728. **Retest-queue widget** — Fixed findings awaiting verification list with a "run all" button.
50729. **Mentions widget** — Unread @mentions across findings collect in one widget.
50730. **Drag-drop widget layout (hunt-ux)** — Widgets reorder on a 12-column grid with the layout persisted.
50731. **Resizable widgets** — Resize handles scale widgets from 1×1 to 4×2 with reflowing content.
50732. **Widget gallery** — Adding widgets opens a gallery with live previews and category filters.
50733. **Per-widget time range** — Each widget offers 24h, 7d, 30d, or all-time ranges.
50734. **Widget maximize** — Maximizing a widget opens its full-page detailed view.
50735. **Widget refresh control** — Each widget shows "updated 2 min ago" with its own refresh button.
50736. **Widget empty state** — Unconfigured widgets show a setup CTA instead of a blank box.
50737. **Widget error state** — Failed widgets show "couldn't load — retry" without breaking the dashboard.
50738. **Dashboard presets** — One-click layouts for Executive, Researcher, and Triage roles.
50739. **Duplicate dashboard (hunt-ux)** — Layouts clone for building a second team view.
50740. **Widget deep links** — Every widget title links to its corresponding full page.
50741. **Auto-refresh toggle** — Dashboards auto-refresh every 30s, pausing when the tab hides.
50742. **Kiosk mode** — A full-screen rotating dashboard suits SOC wall displays.
50743. **Widget threshold alerts** — Pinned widgets notify when their metric crosses a threshold.
50744. **Comparative mini cards** — "This hunt vs average" side-by-side cards contextualize metrics.
50745. **Dashboard snapshot export (hunt-ux)** — The current dashboard exports as a PNG or PDF snapshot.
50746. **Widget access control** — Roles control which widgets each user can see.
50747. **Findings ticker widget** — A scrolling ticker streams the latest findings across all hunts.
50748. **Uptime widget** — Backend and agent-service reliability render as uptime percentages.
50749. **Chains widget** — Chained findings show a count plus the top three chains with mini graphs.
50750. **Coverage widget** — The percentage of attack surface tested shows across recent hunts.
50751. **Keyboard widget navigation** — Arrow keys move between widgets; Enter opens the focused one.
50752. **Widget gallery search** — The gallery filters widgets by name as you type.
50753. **Sticky widget** — One widget pins to stay visible while scrolling the dashboard.
50754. **Quiet-hours dashboards** — Widgets pause live updates overnight and resume with a morning summary.
50755. **Critical-finding toast** — New criticals trigger a severity-colored toast with "view" and "snooze hunt" actions.
50756. **Phase-complete toast** — Phase completions toast with a stat, e.g. "Recon done — 142 URLs".
50757. **Toast stacking** — At most three toasts show; older ones collapse into a "+2 more" chip.
50758. **Inline toast actions** — Toasts carry "View", "Undo", and "Retry" buttons without opening pages.
50759. **Persistent error toasts** — Error toasts persist until explicitly acknowledged and dismissed.
50760. **Configurable toast position** — Toasts anchor bottom-right on desktop and bottom-center on mobile, configurable in settings.
50761. **Progress toasts** — Long operations show toasts with live progress bars for exports and retests.
50762. **Toast grouping** — Five new findings merge into one expandable summary toast.
50763. **Undo toast** — Bulk actions show an "Undo" toast with a five-second restore window.
50764. **Toast sounds** — Distinct tones per severity play when sounds are enabled.
50765. **Do-not-disturb schedule** — Non-critical toasts silence overnight on a user-defined schedule.
50766. **Toast history** — Every toast archives into the notification center for later review.
50767. **Toast rate limiting** — At most one toast per ten seconds per category prevents storms.
50768. **Hunt-complete toast** — Completion toasts offer "view report" and "start next hunt" actions.
50769. **Connection-lost toast** — An amber persistent toast shows until reconnection, with a retry button.
50770. **Reduced-motion toasts** — Toasts fade only, without sliding, under reduced-motion settings.
50771. **Keyboard-dismissable toasts** — Esc dismisses toasts and returns focus to the trigger.
50772. **Toast screen-reader announcements** — All toasts announce through a polite screen-reader live region.
50773. **Per-hunt quiet mode** — One noisy hunt can mute without silencing every other hunt.
50774. **Idle-timeout countdown toast** — "Hunt pauses in 60s (idle timeout)" offers a "keep running" action.
50775. **Copy micro-toast** — Copy confirmations like "PoC copied" auto-dismiss in 1.5 seconds.
50776. **Hover-paused toasts** — Hovering a toast pauses its auto-dismiss timer.
50777. **Swipe-to-dismiss** — Touch devices dismiss toasts with a swipe gesture.
50778. **Mention toast** — @mentions toast with a direct jump to the comment.
50779. **Update-available toast** — New frontend versions toast with a "reload" action to apply them.
50780. **Toast thumbnails** — Toasts include a tiny severity icon or finding screenshot.
50781. **Toast priority levels** — Critical toasts persist until dismissed; info toasts auto-dismiss.
50782. **Clickable toast body** — Clicking a toast's body opens the relevant finding or hunt.
50783. **Mark-all-read** — The notification center clears toast badges with "mark all read".
50784. **Scheduled-hunt toast** — Scheduled runs announce "Nightly scan of example.com started".
50785. **Duplicate suppression (hunt-ux)** — Identical toasts within 60 seconds merge with a counter badge.
50786. **Capped toast width** — Toast text ellipsizes with an expander for long messages.
50787. **Offline-action toasts** — Offline actions toast "will sync when back online" with a queued count.
50788. **Learning-event toast** — Agent learning toasts, e.g. "Agent learned a new dedup rule from your feedback".
50789. **Export-ready toast** — Finished exports toast with a direct download button.
50790. **Above-modal z-index** — Critical toasts render above modals so alerts are never hidden.
50791. **Snooze-1h action** — Finding toasts offer "snooze 1h" to pause alerts for that hunt.
50792. **Labeled toast icons** — Toast icons always pair with text labels, never icon-only meaning.
50793. **Permission-change toast** — Access changes toast, e.g. "You now have editor access to Hunt #42".
50794. **Session-expiry toast** — Expiring sessions warn with an "extend session" action.
50795. **Theme-tested toasts** — Toast contrast is verified in all three themes.
50796. **Test-notification button** — Settings preview the toast style with a "test notification" button.
50797. **Quota-warning toasts** — Usage warnings fire at 80% and 100% with an upgrade CTA.
50798. **Auto-expanded criticals** — Critical toasts auto-expand to show the finding title and affected host.
50799. **Synced badge counts** — Notification-center badges sync with unread toasts in real time.
50800. **First-run checklist** — Paste target, run hunt, review finding, and export report track as a progress checklist.
50801. **Coach-mark tour** — A six-step skippable tour walks through the hunt page, resumable anytime.
50802. **First-finding hint** — The first finding pulses with "this is a finding card — expand it".
50803. **First-operator hint** — Empty search suggests the first operator: "try sev:critical".
50804. **First-pause hint** — The first pause explains "hunts can pause anytime — state saves automatically".
50805. **Sidebar progress bar** — Onboarding progress shows as "3 of 7 steps done" in the sidebar.
50806. **One-click sample hunt** — A demo hunt populates a realistic completed hunt for exploration.
50807. **Dismissible hint cards** — Each hint dismisses individually; a global toggle hides all tips.
50808. **First-export walkthrough** — The first export walks through the PDF-versus-Markdown choice.
50809. **Shortcut nudge** — After five mouse-driven reviews, a tip suggests "press R instead".
50810. **First-filter hint** — A hint teaches combining severity and status to triage faster.
50811. **Welcome-back tour** — After 14 idle days, a "here's what's new" tour covers recent changes.
50812. **Role-based onboarding** — Researcher and executive paths start with different first tasks.
50813. **Models-page hint** — The Models page notes "each brain slot needs a model before hunts use AI fully".
50814. **First-chat hint** — The chat panel suggests three example questions for the mid-hunt agent.
50815. **Widget tour** — A tooltip tour explains "drag to rearrange, click to expand" on the dashboard.
50816. **Weak-target hint** — Pasting a low-surface URL suggests stronger alternatives to hunt.
50817. **First-share hint** — A hint teaches copying deep links from any finding's card menu.
50818. **Opt-in drip emails** — Three onboarding emails arrive over the first week for opted-in users.
50819. **Checklist celebration** — Completing the checklist triggers a subtle animation and a "you're set" state.
50820. **First-chain hint** — The first auto-chained findings explain "these two were linked automatically".
50821. **First-FP hint** — The first false-positive dismissal teaches the flow and its learning effect.
50822. **Embedded video snippets** — Complex flows include 30-second video snippets inside hints.
50823. **Tip-of-the-day card** — The dashboard shows one dismissible power-user tip per day.
50824. **Schedule hint** — After the third manual run, a hint suggests "automate this hunt weekly".
50825. **Low-confidence hint** — The first low-confidence finding explains what the score means.
50826. **Onboarding sandbox** — A safe playground hunt lets users experiment without spending quota.
50827. **Team-invite hint** — After the second hunt, a hint suggests inviting reviewers to collaborate.
50828. **Voice-command hint** — Mobile users see "tap the mic and say 'start a hunt'" on first visit.
50829. **Zero-results hint** — Empty filter results teach the "clear filters" recovery path.
50830. **Accessibility onboarding** — A hint notes "press Shift+? anytime for keyboard shortcuts".
50831. **First-print hint** — A hint notes "reports print cleanly — try Ctrl+P on any report".
50832. **Timeline-click hint** — A hint teaches "click any step to see exactly what the agent did".
50833. **Rotating help-panel tips** — The help panel shows one "did you know" tip per visit.
50834. **Integration hint** — After the first export, a hint suggests sending reports to Slack automatically.
50835. **Synced hint state** — Dismissed hints stay dismissed across all of the user's devices.
50836. **Paywall-explainer hint** — The first paywall explains what the tier unlocks with a trial CTA.
50837. **Post-hunt rating hint** — Completed hunts invite a rating "to improve the agent".
50838. **Dark-mode hint** — A hint suggests "easier on the eyes — switch themes with Ctrl+.".
50839. **Onboarding graduation** — The finished checklist archives itself into a "tips" section.
50840. **Copy-PoC button** — Every finding card copies a formatted markdown PoC block in one click.
50841. **Evidence copy feedback** — Code-block copy buttons morph to a checkmark on success.
50842. **Copy-as-cURL** — One click copies the exact replayable request as a cURL command.
50843. **Copy finding deep link** — Card menus copy a URL that opens the finding already expanded.
50844. **Copy CVSS vector** — A button beside the vector chip copies the raw CVSS string.
50845. **Copy target URL** — The hunt header copies the target URL with a trailing-slash normalization note.
50846. **Terminal copy toggle** — The terminal copies with or without timestamps via a toggle.
50847. **Copy table as CSV** — Findings tables and audit logs copy as well-formed CSV.
50848. **Per-section report copy** — Report previews offer copy buttons on each section.
50849. **Copy share text** — A pre-formatted share line reads "Critical: SQLi on example.com/login — details: <link>".
50850. **Masked token copy** — API tokens stay masked until revealed, then copy with a 30-second reveal window.
50851. **Copy diagnostics bundle** — Error dialogs copy an ID plus stack excerpt plus environment info.
50852. **Copy search as URL** — Any search query copies as a shareable encoded URL.
50853. **Copy webhook example** — Integration pages copy a sample webhook payload for testing.
50854. **Copy remediation as ticket** — Findings copy as Jira- or GitHub-flavored markdown tickets.
50855. **Copy filtered set** — The current filter set copies as JSON or CSV in one action.
50856. **Copy hunt summary** — A one-paragraph standup summary copies, e.g. "Hunt X: 12 findings, 3 critical…".
50857. **Copy report checksum** — Exported reports expose a SHA-256 checksum copy button for verification.
50858. **Copy timeline event** — Timeline events copy as timestamped log lines with hunt context.
50859. **Clipboard history panel** — The last twenty copies list with re-copy buttons.
50860. **Copy-format chooser** — Long-pressing copy offers plain text, rich text, or markdown.
50861. **Copy with citation** — Finding copies append the source hunt ID and timestamp automatically.
50862. **Copy asset list** — In-scope hosts and paths copy as a newline-delimited list.
50863. **Copy retest diff** — Retest before/after copies as a unified diff.
50864. **Copy shortcut text** — The cheat sheet copies bindings like "Ctrl+Shift+E" as text.
50865. **Copy status update** — Notifications copy as pre-written status updates for standups.
50866. **Copy model config** — Brain-slot setups copy as JSON for team sharing.
50867. **Copy filter as URL** — The exact filter state copies as an encoded shareable URL.
50868. **Auto-copy selection** — An optional toggle auto-copies selected evidence text.
50869. **Copy line-count toast** — Copy confirmations note "copied 42 lines" in the micro-toast.
50870. **Clipboard-blocked fallback** — Blocked clipboard access opens the text in a selectable modal instead.
50871. **Labeled copy buttons** — Copy buttons carry focus states and aria-labels like "Copy PoC as markdown".
50872. **Encoded-payload copy** — Payloads copy in base64 or URL-encoded variants from a submenu.
50873. **Copy dual timestamps** — Timeline timestamps copy in both ISO and relative formats.
50874. **Copy invite link** — Team invites copy with the role and expiry shown before copying.
50875. **Copy widget config** — Dashboard widget layouts copy as JSON for sharing.
50876. **Copy verified regex** — The filter builder copies regex with escaping already verified.
50877. **Multi-block copy** — Checkboxes on evidence blocks combine selections into one copied block.
50878. **Accessible table copy** — Copied tables include header rows for screen-reader-friendly pasting.
50879. **Copy rate guard** — A ten-copies-per-second guard shows a friendly "slow down" note.
50880. **Mobile share-sheet fallback** — Mobile copy falls back to the native share sheet when needed.
50881. **Copy version info** — Bug reports copy "Dark-Matter v2.4.1 (build 8812)" in one click.
50882. **Copy as API query** — Finding filters copy as API query params for automation scripts.
50883. **Copy image bytes** — Screenshots copy as image data, not just file paths, where supported.
50884. **No copy on secrets** — Sensitive fields never show copy buttons without an explicit reveal first.
50885. **Dedicated print stylesheet** — Findings render as a clean paginated document when printing.
50886. **Print page header** — Hunt target, date range, and branding repeat on every printed page.
50887. **Page-number footer** — Printed pages carry "Page X of Y" footers.
50888. **Text-labeled severity** — Severity prints as labeled pills like "CRITICAL", never color-dependent.
50889. **Hidden interactive chrome** — Buttons, tooltips, and hover actions hide automatically in print.
50890. **Expand-aware printing** — Expanded cards print full evidence; collapsed cards print summaries only.
50891. **Print-scope toggle** — The print dialog offers "expand all" versus "print current view".
50892. **Wrapped code printing** — Code evidence prints with line numbers and wrapping, never clipped.
50893. **Captioned screenshots** — Screenshots print at capped width with captions and source URLs.
50894. **Printed table of contents** — Hunts with 10+ findings print a table of contents with page references.
50895. **Unbroken cards** — Finding cards avoid page breaks via break-inside: avoid.
50896. **Visible link URLs** — Printed links show their href in parentheses after the link text.
50897. **Labeled chart values** — Charts print data labels, not just colored segments.
50898. **Forced light print** — Print output always uses the light theme regardless of the UI theme.
50899. **Ink-saving print** — Print strips animations, shadows, and background tints to save ink.
50900. **Grayscale print toggle** — An "ink-saver" toggle renders the print output in grayscale.
50901. **Condensed timeline print** — The timeline prints as a chronological list with timestamps.
50902. **WYSIWYG print preview** — The print dialog previews exactly what will print.
50903. **Per-section printing** — Report previews offer print buttons on each individual section.
50904. **Configurable margins** — Print options include narrow, normal, and wide margins.
50905. **Draft watermark** — Draft prints overlay a diagonal "DRAFT — not for distribution" watermark.
50906. **Filter-aware print header** — Print headers note "printing 7 of 42 findings (filtered)".
50907. **Classification footer** — Every printed page carries the confidentiality classification label.
50908. **Print QR code** — Printed reports include a QR code linking back to the live hunt.
50909. **Two-column summaries** — Executive summaries offer a two-column print layout option.
50910. **Graph-as-list print** — The chain graph prints as a labeled node list fallback.
50911. **Print type size** — Print body text renders at 12pt independent of screen settings.
50912. **Audit-trail appendix** — The audit trail prints as an appendix with timestamps and actors.
50913. **Save-as-PDF guidance** — Print help detects the browser's save-as-PDF with recommended settings.
50914. **Hidden nav in print** — Sidebar, header nav, and chat panel hide automatically when printing.
50915. **Section page breaks** — Severity sections can optionally start on new printed pages.
50916. **Printable checklists** — Remediation checklists print with empty checkboxes for field use.
50917. **Stacked diff print** — Retest diffs print as stacked before/after blocks.
50918. **One-page dashboard print** — The dashboard prints as a one-page executive snapshot.
50919. **Labeled timezones** — Printed timestamps name the user's timezone explicitly.
50920. **Glossary appendix** — Printed reports append a glossary for jargon used in findings.
50921. **Prepared-by line** — Prints include the reviewer's name and the preparation date.
50922. **Duplex-friendly layout** — Print avoids stray blank pages and offers mirrored margins for duplex.
50923. **Scope appendix** — The hunt's scope definition and exclusions print as an appendix.
50924. **Full-list print rendering** — Virtualized lists render fully for print with no missing rows.
50925. **Shortcut cheat sheet printout** — The shortcut cheat sheet prints as a one-page reference card.
50926. **Cross-browser print CSS** — Print styles are tested in Chrome, Edge, Firefox, and Safari.
50927. **Compliance-history print** — Notification and audit history print as compliance evidence.
50928. **Printer-icon print buttons** — Print buttons use a printer icon plus label and open the native dialog.
50929. **Print-stylesheet fallback note** — If print preview fails, the UI suggests downloading the PDF instead.
50930. **Optimistic status changes** — Finding cards update instantly, sync in the background, and roll back on failure.
50931. **Instant hunt creation** — The hunt row appears in history before the create API responds.
50932. **Optimistic comments** — Comments render immediately with a "sending" tick that flips to "sent".
50933. **Instant cached filtering** — Filter changes apply to cached findings instantly while the server revalidates silently.
50934. **Skeleton-first rendering** — Layouts appear within 100ms; data fills in progressively afterward.
50935. **Hover prefetch** — Hovering a finding card for 300ms prefetches its detail view.
50936. **Debounced local search** — Search debounces at 150ms and filters already-loaded findings instantly.
50937. **Virtualized findings list** — Only visible rows render, keeping 10k+ finding lists smooth.
50938. **Virtualized timeline** — Only the visible window of timeline events renders at once.
50939. **Lazy evidence images** — Evidence thumbnails load as they scroll into view.
50940. **Progressive report preview** — The first report page renders before the full PDF is ready.
50941. **Optimistic bookmarks** — Star and bookmark toggles respond with instant visual feedback.
50942. **Route code splitting** — Hunt-page JavaScript loads separately from dashboard JavaScript.
50943. **Cached hunt snapshots** — Reopening a hunt shows its last state instantly, then live-syncs.
50944. **Stale-while-revalidate widgets** — Dashboard widgets show cached data while refreshing in the background.
50945. **Optimistic widget reorder** — Dragged widgets move instantly; the layout persists on drop.
50946. **Instant theme switching** — CSS variables swap themes with no reload and no flash.
50947. **Background PDF prefetch** — Opening the report tab prefetches the PDF in the background.
50948. **Optimistic bulk review** — "Mark all reviewed" updates instantly with a progress toast and per-item rollback.
50949. **Client-side filter/sort** — Filtering and sorting run locally when the dataset is already loaded.
50950. **100ms acknowledgment budget** — Every interaction acknowledges within 100ms via spinner or update.
50951. **Batched detail fetches** — Rapid card expands batch their detail requests into a single call.
50952. **Optimistic pause/resume** — The button flips instantly while the backend confirms asynchronously.
50953. **Skeletons over spinners** — Any load expected beyond 300ms shows skeletons instead of spinners.
50954. **Priority content loading** — Finding titles and severity load before evidence thumbnails.
50955. **Idle-time preloading** — The next hunt in history preloads when the browser goes idle.
50956. **Optimistic dismissal** — Notification badges decrement the instant a toast is dismissed.
50957. **Worker-thread search index** — A cached index in a worker thread powers instant fuzzy search on large hunts.
50958. **Streaming step log** — Step events append incrementally instead of waiting for batches.
50959. **Optimistic FP dismissal** — Dismissed cards collapse instantly with an undo toast for recovery.
50960. **Deferred non-critical JS** — Analytics and tips load after the interactive core is ready.
50961. **Font-display swap** — Text renders immediately with font-display: swap before custom fonts finish.
50962. **Optimistic tab switches** — Cached tab content shows instantly while a background refresh runs.
50963. **Ghost action buttons** — Buttons appear disabled-looking, then activate the moment data arrives.
50964. **Bandwidth-aware quality** — Low-bandwidth connections automatically get lower-resolution thumbnails.
50965. **Local-echo presence** — Collaborator avatars appear via local echo before the server echo arrives.
50966. **Debounced note autosave** — Finding notes autosave after 500ms idle with a "saved" indicator.
50967. **Predictive dialog preload** — Hovering "Export" preloads the export dialog's code.
50968. **Shift-free first finding** — The first finding's arrival causes no layout shift from the empty state.
50969. **Optimistic retry** — Clicking retry shows "retrying…" immediately on failed steps.
50970. **WebSocket-first updates** — Live updates prefer WebSocket with an invisible HTTP-polling fallback.
50971. **Offline mutation queue** — Offline actions queue locally and replay in order on reconnect.
50972. **Optimistic read receipts** — "Seen" watermarks update without waiting for server confirmation.
50973. **Chunked evidence streaming** — Code blocks stream in 50-line chunks for long evidence.
50974. **Memoized finding cards** — Cards re-render only when their own finding's data changes.
50975. **Optimistic re-grading** — Severity pills recolor instantly while the audit log writes async.
50976. **Descriptive loading copy** — Loading messages describe real progress like "indexing 1,204 findings…".
50977. **Instant back navigation** — Back-navigation restores scroll position and open cards from cache.
50978. **Optimistic widget refresh** — Old widget data stays visible under a subtle "updating" shimmer.
50979. **Deduplicated requests** — Identical in-flight API calls share a single response.
50980. **Optimistic hunt rename** — Title edits apply instantly in the header and sidebar.
50981. **Lazy chain-graph init** — The graph canvas initializes only when its tab opens.
50982. **SSR fallback text** — Core triage content renders server-side if client JavaScript partially fails.
50983. **Optimistic file attach** — Chat attachment thumbnails appear before the upload completes.
50984. **Smart polling backoff** — Polling slows to 30s when the tab hides and resumes instantly on return.
50985. **Perceived-complete state** — The "Done" state shows when the last phase finishes, before report finalization.
50986. **Optimistic SLA badges** — SLA badges update the moment a finding's status changes.
50987. **Immutable avatar URLs** — Cached avatars use immutable URLs to avoid re-download flicker.
50988. **Cross-faded preset switches** — Filter presets cross-fade between result sets for continuity.
50989. **Optimistic watch toggles** — Target watch bells flip state immediately on toggle.
50990. **Route bundle budgets** — Each route stays under 200KB gzipped, enforced in CI.
50991. **Inlined critical CSS** — Critical CSS inlines so the first paint is styled without waiting.
50992. **Optimistic pagination** — "Load more" appends instantly from prefetched pages.
50993. **Time-sliced rendering** — Heavy list updates yield to keep the UI responsive.
50994. **Perceived-latency analytics** — Click-to-acknowledgment time is tracked as a product metric.
50995. **Optimistic toast undo** — Toast "Undo" actions work even before the server confirms.
50996. **Service-worker asset cache** — Static assets cache for instant repeat visits.
50997. **Optimistic checklist** — Onboarding steps check off the instant the user acts.
50998. **Preloaded user settings** — Settings load at login so the first render matches preferences.
50999. **Optimistic reactions** — Comment emoji counts increment immediately on click.
51000. **Fast-path repeat hunts** — Cached recon data pre-fills repeat hunts instantly.
51001. **Optimistic share links** — Share links appear instantly while permissions sync afterward.
51002. **Debounced resize handling** — Window-resize recalculations debounce to avoid layout jank.
51003. **Instant keyboard focus** — Focus moves instantly even while a card's detail is still loading.
51004. **Latency self-test** — Settings include an honest interaction-latency self-test with reported results.
