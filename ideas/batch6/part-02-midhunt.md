# Mid-hunt interaction (51005–52004)
51005. **Pinned chat dock** — a collapsible chat panel that stays docked beside the live hunt timeline so questions never cover the findings feed.
51006. **Context-aware replies** — every chat message carries the current hunt phase and scope so the agent always answers with the right state in mind.
51007. **Dynamic question chips** — quick-ask buttons like "what changed in the last 10 minutes?" that refresh automatically as the hunt phase changes.
51008. **Reply reactions** — emoji and thumbs reactions on agent answers that silently tune its verbosity and technical depth.
51009. **Conversation search** — full-text search across the current hunt's chat with jump-to-context for each match.
51010. **Threaded follow-ups** — reply-in-thread on any agent message to drill deeper without derailing the main conversation.
51011. **Agent presence badge** — a live "thinking / acting / idle / waiting on you" indicator in the chat header synced to the execution loop.
51012. **Mid-chat language switch** — change the reply language at any point and the agent continues seamlessly without restarting the hunt.
51013. **Voice-note questions** — record a spoken question that transcribes into chat, keeping the transcript as the message record.
51014. **Chat file attachments** — drop a screenshot or note into chat and the agent references it in its next reasoning step.
51015. **Transcript export** — one-click markdown download of the full hunt conversation with timestamps and phase markers.
51016. **Pinned answers rail** — pin key agent replies to a side rail for quick reference while the hunt continues.
51017. **Proactive follow-up prompts** — after each answer the agent suggests two or three natural next questions.
51018. **Auto-condensing answers** — during high chat volume the agent shortens replies automatically to stay readable.
51019. **Slash-command controls** — /status, /pause, /focus and similar chat shortcuts that execute real hunt controls.
51020. **Finding ID deep links** — pasting a finding ID in chat expands an inline card showing its live status.
51021. **Offline message queue** — messages typed while disconnected are queued and delivered when the session resumes.
51022. **Typing indicator** — a visible "agent is composing" state so you know a reply is on the way.
51023. **Split chat panes** — two parallel threads with the agent (strategy vs findings) in side-by-side panes.
51024. **Tone selector** — switch the agent's chat tone between concise analyst and patient explainer without changing its actions.
51025. **@-mentions for artifacts** — mention findings, tools, or phases by name to pull their details into the conversation.
51026. **Chat-to-report notes** — select chat messages and append them as annotated notes in the draft report.
51027. **Cited answers** — every factual claim in a reply links to the log line or finding that supports it.
51028. **Chat message filters** — toggle views showing only agent questions, only your steering commands, or only explanations.
51029. **Chat quiet hours** — mute proactive agent messages during a set window while keeping critical alerts active.
51030. **Guided test-request flow** — a chat wizard that turns "try X on Y" into a validated, queued test.
51031. **Answer confidence meter** — a subtle confidence indicator on replies where the agent is uncertain.
51032. **Timeline-synced replay** — replay the conversation chronologically in sync with the execution timeline.
51033. **Teammate chat invites** — bring a teammate into the same hunt chat with role-based permissions.
51034. **Screenshot annotation (mid-hunt)** — sketch on a screenshot in chat and the agent factors the marked region into its reasoning.
51035. **Clarification-first behavior** — on ambiguous requests the agent asks one precise clarifying question instead of guessing.
51036. **Keyboard-first chat** — full keyboard navigation for sending, searching, pinning, and reacting.
51037. **One-tap translation** — translate any agent message into another language instantly.
51038. **Approval cards in chat** — approve/deny cards for sensitive actions appear directly inside the conversation.
51039. **Natural-language scope edits** — type "also include the API subdomain" and the agent confirms before expanding scope.
51040. **On-demand chat digest** — ask "summarize the last hour" for phases, tests, and findings in one digest.
51041. **Persistent chat sessions** — reopening a hunt restores the full conversation exactly where it left off.
51042. **Read receipts** — see which agent messages you've opened and which proactive alerts remain unread.
51043. **Agent memory notes** — say "remember this for later" and the agent stores a pinned note for the rest of the hunt.
51044. **Cross-hunt comparison** — ask how current progress compares with a previous hunt of the same target.
51045. **Emergency stop phrase** — a configurable phrase that pauses the hunt instantly when typed or spoken.
51046. **Pacing awareness** — the agent reduces proactive messages when your replies suggest you're busy.
51047. **Handoff brief generator** — generate a chat-based handoff summary when passing the hunt to a teammate.
51048. **Saved question templates** — reusable prompts like "any new criticals?" or "recon coverage so far?".
51049. **Reply-length slider** — a terse/balanced/detailed control applied to all future answers.
51050. **URL unfurling** — pasting a link shows inline target context: resolved host and in-scope status.
51051. **Command history recall** — up-arrow cycles through your previous chat commands and steering instructions.
51052. **Working-notes channel** — a separate read-only stream where the agent posts raw reasoning as it works.
51053. **Chat triage commands** — reply "mark as false positive" under a finding alert to update its state instantly.
51054. **Scheduled chat check-ins** — the agent posts a status digest in chat every N minutes, configurable per hunt.
51055. **Answer escalation** — flag an agent reply for human expert review with one click and track the outcome.
51056. **Technical/plain toggle** — switch the whole session between technical and plain-language answers.
51057. **Evidence footnotes** — every finding claim in chat carries its evidence link as a footnote.
51058. **Sub-agent chat tabs** — when sub-agents run, chat splits into per-agent tabs plus a coordinator thread.
51059. **Immutable chat audit log** — a tamper-evident record of all chat instructions, exportable for compliance.
51060. **Long-hunt personality** — optional light tone in status replies to keep overnight hunts pleasant.
51061. **Instant status command** — ask "what are you doing right now?" and get a one-line answer in under a second.
51062. **Plain-language narration** — the agent describes its current action as a sentence, not a tool name or log dump.
51063. **Phase breadcrumb trail** — a clickable path showing exactly where the current action sits in the hunt plan.
51064. **Active-tool indicator** — a live badge naming the tool or module currently executing.
51065. **In-phase progress bar** — percentage completion of the current phase with remaining sub-steps listed.
51066. **Sub-step checklist** — the current phase broken into checkable steps that tick off as they finish.
51067. **Time-in-phase readout** — how long the agent has spent in the current phase versus the planned budget.
51068. **Last-action timestamp** — when the most recent action completed, so silence is distinguishable from stalling.
51069. **Next-action preview** — what the agent plans to do immediately after the current step.
51070. **Status in your language** — status answers always match the language you chatted in, switchable anytime.
51071. **Visual status card** — a glanceable card with phase, action, progress, and ETA in one place.
51072. **Status history timeline** — scroll back through every status the agent reported during the hunt.
51073. **Scheduled status digests** — automatic plain-language updates posted at intervals you choose.
51074. **Ask-about-this-action** — tap any running action to ask the agent why it's doing it and what it expects.
51075. **Self-reported blockers** — the agent proactively says what it's stuck on instead of spinning silently.
51076. **Waiting-on-you flag** — a distinct state when the agent is paused awaiting your approval or input.
51077. **Plan-vs-reality view** — current activity shown against the original plan with deviations highlighted.
51078. **Shareable status link** — a read-only link showing live hunt status to a stakeholder without chat access.
51079. **Spoken status readout** — hear the current status read aloud through the avatar or voice mode.
51080. **Dashboard status widget** — a mini live-status card embeddable on your hunts dashboard.
51081. **Tab-title status** — the browser tab title shows a one-line live status for at-a-glance monitoring.
51082. **Status API endpoint** — machine-readable current-status JSON for integrations and bots.
51083. **Status snapshots** — capture timestamped status cards into the hunt record with one click.
51084. **Intent explanation** — "why am I doing this" answers that connect the current action to the hunt goal.
51085. **Dependency display** — shows what the current step is waiting for, e.g. recon results before probing.
51086. **Approach confidence** — the agent states how confident it is that the current approach will pay off.
51087. **Considered alternatives** — ask what else it considered before choosing the current action.
51088. **Per-module status** — drill into any single module to see exactly what that component is doing.
51089. **Quiet status mode** — suppress routine updates and surface only phase changes and findings.
51090. **Push status alerts** — phase changes and completions pushed to your phone or desktop.
51091. **Terminal-style status** — an optional monospace live feed for users who prefer raw operational text.
51092. **Status emoji legend** — consistent icons for phases so status is scannable at a glance.
51093. **Time-since-finding** — how long since the last finding, to judge whether the hunt has gone cold.
51094. **Coverage-so-far summary** — which parts of the target have been exercised and which remain untouched.
51095. **Paused-state status** — while paused, status shows exactly where the hunt froze and what resumes next.
51096. **Approval-wait status** — during approval waits, status names the pending action and who's holding it up.
51097. **Status export** — download the full status history as CSV or markdown for records.
51098. **Status Q&A thread** — every status update opens a thread where you can question that specific moment.
51099. **Uncertainty flag** — the agent marks status lines it's unsure about rather than stating them as fact.
51100. **Upcoming-phase forecast** — "about to start API fuzzing" style lookahead of the next 2–3 steps.
51101. **Status granularity dial** — choose summary, standard, or verbose depth for all status output.
51102. **Component-specific status** — ask "what's the crawler doing?" for a focused answer on one component.
51103. **Timeline scrubber (mid-hunt)** — drag through the hunt timeline to see what the agent was doing at any minute.
51104. **Status bookmarks** — bookmark moments in the status stream to revisit or cite later.
51105. **Agent workload meter** — how many parallel tasks the agent is juggling right now, shown as a simple gauge.
51106. **Model-switch status** — a notice whenever the agent swaps brains mid-hunt, with the reason for the switch.
51107. **Bilingual status view** — status displayed in two languages side by side for mixed-language teams.
51108. **Payload-redacted status** — status lines automatically hide sensitive payload contents with reveal-on-click.
51109. **Finding-linked status** — each status update links to the findings discovered during that window.
51110. **Idle-nudge suggestions** — when the agent idles, it proposes useful next steps you can approve with one tap.
51111. **Activity heatmap** — a visual map of agent activity intensity across the hunt timeline.
51112. **Avatar status narration** — the avatar speaks status updates in a natural voice during long hunts.
51113. **Manager-friendly status** — a jargon-free status view designed for non-technical stakeholders.
51114. **Since-your-last-visit diff** — "here's what happened since you last checked" summary shown on return.
51115. **Current-task ETA** — estimated finish time for the specific step in progress, not just the whole hunt.
51116. **Status confidence trend** — a sparkline showing how the agent's confidence evolved across phases.
51117. **Focus-this-URL command** — tell the agent to concentrate testing on one URL with immediate reprioritization.
51118. **Skip-this-area command** — mark a section as off-limits and watch the agent reroute around it.
51119. **Finding-type priority boost** — elevate a vulnerability class so the agent hunts it first everywhere.
51120. **Noisy-check demotion** — push low-signal checks to the back of the queue without disabling them.
51121. **Mid-hunt scope addition** — add a subdomain or path to scope with instant agent acknowledgement.
51122. **Mid-hunt scope removal** — pull a target out of scope and halt its in-flight tests gracefully.
51123. **Target-profile switch** — change the assumed target profile (e.g. SPA vs API) and retune the plan live.
51124. **Custom wordlist injection** — upload a wordlist mid-hunt that the agent starts using immediately.
51125. **Live request-rate cap** — set a max requests-per-second that throttles the agent on the spot.
51126. **Scan-intensity dial** — move between light, normal, and aggressive testing without restarting.
51127. **Endpoint redirect** — point the agent at a newly discovered endpoint to investigate next.
51128. **Module-level pause** — pause one module while the rest of the hunt keeps running.
51129. **Phase reordering** — drag phases into a new order and the agent adopts the sequence.
51130. **Time-budget extension** — grant the hunt extra hours and watch the plan expand to use them.
51131. **Wrap-up command** — tell the agent to finish within N minutes and get a condensed final sweep.
51132. **Natural-language steering** — plain sentences like "spend more time on the API" that the agent executes.
51133. **Drag-and-drop priorities** — reorder a visual priority list to reshape the hunt plan.
51134. **Steering presets** — one-tap modes like "go wide", "go deep", or "be quiet" that reconfigure the hunt.
51135. **Undo steering** — revert your last steering command and restore the previous plan.
51136. **Steering preview** — see the planned changes before confirming a major redirection.
51137. **Impact estimate** — the agent tells you a steering change adds roughly N minutes or M requests.
51138. **Steering history log** — every redirection recorded with who issued it and what changed.
51139. **Co-steering** — teammates propose steering changes that take effect after your approval.
51140. **Saved steering templates** — store redirection patterns per target type and apply them in one click.
51141. **Conditional steering rules** — "if you find an admin panel, go deep on it" style if-then instructions.
51142. **Time-boxed focus** — "focus the API for the next 30 minutes, then resume the plan."
51143. **Steer-from-finding** — right on a finding card, choose "investigate similar areas" to redirect the agent.
51144. **Steer-from-log** — click any log line and choose "do more of this" or "stop doing this".
51145. **Spoken redirection** — speak redirection commands hands-free during a live hunt.
51146. **Touch priority board** — a tablet-friendly board for reprioritizing hunt areas by drag and drop.
51147. **Steering API** — programmatic endpoints so external tools can redirect a running hunt.
51148. **Steer while paused** — rearrange the plan during a pause so it resumes with the new strategy.
51149. **Big-change approval** — major redirections require explicit confirmation before the agent acts.
51150. **Agent pushback** — the agent warns you when a steering command risks missing better leads.
51151. **Agent steering suggestions** — the agent proposes redirections based on what it's seeing, for you to approve.
51152. **Bandwidth steering** — cap total requests or bandwidth for the remainder of the hunt.
51153. **Stealth steering** — switch the hunt to low-noise mode mid-run without losing progress.
51154. **Depth limiter** — set how many levels deep crawling or chaining may go from now on.
51155. **Retest-on-change** — when the target changes mid-hunt, the agent re-tests affected areas automatically.
51156. **Steering dry-run** — simulate a redirection to preview its effect on the plan before applying it.
51157. **Priority inheritance (mid-hunt)** — boosted priorities automatically apply to newly discovered in-scope assets.
51158. **Steering cooldown** — optional lockout preventing conflicting redirections within a short window.
51159. **Module enable/disable live** — toggle individual testing modules on or off without restarting the hunt.
51160. **Focus window** — define a URL pattern; the agent spends a fixed share of effort inside it.
51161. **De-emphasize findings class** — tell the agent a finding category is out of interest and watch it adapt.
51162. **Steering via findings feed** — bulk-select findings and choose "find more like these".
51163. **Hunt persona switch** — change the agent's testing persona (e.g. cautious auditor vs aggressive hunter) live.
51164. **Checkpoint steering** — set plan checkpoints where the agent must check in before continuing.
51165. **Steering analytics** — see which of your redirections led to findings, improving future steering.
51166. **Emergency re-scope** — one command that narrows the hunt to a single critical asset instantly.
51167. **Steering command aliases** — define your own shorthand commands mapped to complex redirections.
51168. **Scheduled steering** — queue a redirection to apply at a future time or phase boundary.
51169. **Steering conflict resolver** — when two teammates steer differently, a merge view reconciles the commands.
51170. **Agent autonomy slider** — dial how much the agent may self-redirect versus awaiting your steering.
51171. **Steering notification feed** — a dedicated feed showing every plan change and its trigger.
51172. **Post-steering summary** — after each redirection, a one-line summary of the new plan.
51173. **Inline approval cards** — sensitive actions arrive as approve/deny cards with full context attached.
51174. **Action risk labels** — every approval shows a clear risk level: safe, cautious, or destructive.
51175. **Approval detail drawer** — expand any request to see exact requests, targets, and expected side effects.
51176. **One-tap approve/deny** — big, unambiguous buttons designed for fast decisions under time pressure.
51177. **Bulk approval queue** — review and decide on multiple pending actions in one focused screen.
51178. **Approval timeouts** — pending actions auto-deny or auto-pause after a configurable wait.
51179. **Approve-with-limits** — approve an action but cap its scope, rate, or duration.
51180. **Always-allow rules** — pre-approve categories of safe actions so they never interrupt the hunt.
51181. **Always-deny rules** — permanently forbid action categories for this hunt or all hunts.
51182. **Approval delegation (mid-hunt)** — route specific approval types to a teammate automatically.
51183. **Step-up authentication (mid-hunt)** — destructive approvals require a second confirmation factor.
51184. **Approval audit trail (mid-hunt)** — who approved what, when, and with what context, immutably logged.
51185. **Pending-action countdown** — see how long each request has waited and what the agent is doing meanwhile.
51186. **Agent waits gracefully** — while awaiting approval, the agent works on unrelated safe tasks.
51187. **Approval templates (mid-hunt)** — prebuilt policies like "paranoid", "balanced", "permissive" applied per hunt.
51188. **Destructive-action sandbox preview** — see a simulated outcome before approving a risky action.
51189. **Reversible-action badges** — approvals mark which actions can be rolled back afterwards.
51190. **Approval on mobile** — approve or deny from your phone with the same context as desktop.
51191. **Voice approvals** — speak "approved" with voice verification for hands-free decisions.
51192. **Approval expiry (mid-hunt)** — approvals apply only to the specific instance requested, never blanket future ones.
51193. **Request-more-info button** — ask the agent to justify a request before you decide.
51194. **Approval analytics (mid-hunt)** — track your approval patterns to auto-suggest smarter defaults.
51195. **Emergency deny-all** — one button that denies every pending request and pauses the hunt.
51196. **Approval chat thread** — discuss a pending action with the agent before deciding.
51197. **Side-effect estimator** — the agent lists likely side effects of the action it's requesting.
51198. **Rollback plan attached** — destructive requests include the agent's plan to undo changes if needed.
51199. **Approval notifications** — push, email, or SMS alerts the moment an approval is needed.
51200. **Quiet approval batching** — non-urgent requests grouped into a digest instead of interrupting you.
51201. **Approval history search** — find any past decision with its context in seconds.
51202. **Policy inheritance** — new hunts inherit your approval policies from previous hunts.
51203. **Granular action scopes** — approve an action for one endpoint without approving it everywhere.
51204. **Approval-required watermark** — the hunt header shows a persistent badge while approvals are pending.
51205. **Dual-control approvals** — destructive actions need two different people to approve before running.
51206. **Approval SLAs** — set a target decision time; the agent escalates if you exceed it.
51207. **Contextual approval hints** — the agent explains why this action matters right now in plain words.
51208. **Approval from chat** — decide directly inside the conversation without opening a separate panel.
51209. **Scheduled approval windows** — approvals only interrupt you during hours you define.
51210. **Approval fatigue guard** — the agent batches or defers requests when you're deciding too often.
51211. **Pre-approved target list** — actions against listed assets skip approval automatically.
51212. **Forbidden-target list** — any action touching listed assets is denied before it reaches you.
51213. **Approval reason codes** — tag each decision with a reason for later review and learning.
51214. **Agent self-denial log** — see actions the agent considered but decided not to request.
51215. **Approval simulation mode** — practice the approval flow on a demo hunt before a real one.
51216. **Time-limited approvals** — an approval grants permission for N minutes, then expires.
51217. **Approval revocation (mid-hunt)** — withdraw an approval while the action is still running to halt it.
51218. **Cross-hunt approval rules** — one policy governing sensitive actions across all your hunts.
51219. **Approval digest email** — a summary of decisions made, sent when the hunt ends.
51220. **Legal-hold approvals** — flag approvals that need legal sign-off before execution.
51221. **Approval confidence score** — the agent shows how sure it is the action is necessary.
51222. **Alternative-action suggestion** — with each request, the agent offers a safer alternative.
51223. **Approval keyboard shortcuts** — approve, deny, or request info without touching the mouse.
51224. **Offline approval queue** — decisions made offline sync and apply when you reconnect.
51225. **Approval streaks** — the agent learns your patterns and pre-fills likely decisions for review.
51226. **Destructive-action insurance** — snapshot target state before approved destructive tests for recovery.
51227. **Approval ceremony log** — a formal record of approvals suitable for regulated environments.
51228. **Post-approval monitoring (mid-hunt)** — after approval, watch the action's live effects with a kill switch at hand.
51229. **Live log stream** — every tool invocation and result streaming in real time with millisecond timestamps.
51230. **Log level filter** — toggle between debug, info, warning, and error to control noise.
51231. **Per-module log tabs** — separate live streams for recon, scanning, exploitation, and reporting modules.
51232. **Log search** — instant full-text search across the live and historical log buffer.
51233. **Log line details** — click any line to expand the full request, response, and agent reasoning behind it.
51234. **Payload redaction** — sensitive values in logs masked automatically with reveal-on-click.
51235. **Log highlighting** — custom rules that highlight lines matching patterns you care about.
51236. **Error-only view** — one click to see only errors and warnings across the whole hunt.
51237. **Log export** — download the full log as structured JSON or readable text at any moment.
51238. **Live request inspector** — see the actual HTTP requests the agent sends as they go out.
51239. **Response viewer** — expand any tool result to inspect the raw response body.
51240. **Log playback** — replay the log stream at 1x, 4x, or 16x speed like a video.
51241. **Log bookmarks** — mark lines to revisit, with notes attached to each bookmark.
51242. **Anomaly flagging** — the agent flags unusual log patterns for your attention automatically.
51243. **Log correlation** — lines linked to the finding or phase they contributed to.
51244. **Tail-follow mode** — the stream auto-scrolls with a pause-on-hover for reading.
51245. **Log sampling (mid-hunt)** — during floods, show a representative sample with a "showing 1 of N" indicator.
51246. **Structured log cards** — key events rendered as readable cards instead of raw text.
51247. **Log diff view** — compare log segments between two phases or two hunts.
51248. **Tool runtime stats** — per-tool execution counts, durations, and error rates live.
51249. **Command echo** — every agent decision shown with the command it issued and why.
51250. **Log retention control** — choose how much history stays in the live buffer per hunt.
51251. **Multi-hunt log switcher** — flip the log view between concurrent hunts without losing scroll position.
51252. **Log annotations** — add your own notes inline on any log line for later review.
51253. **Quiet hours for logs** — collapse routine recon chatter into summaries during long phases.
51254. **Log-driven alerts** — get notified when a log pattern you defined appears.
51255. **Screenshot-on-event** — the agent captures screenshots at key log moments automatically.
51256. **Log timeline minimap** — a density overview for jumping to busy or quiet periods.
51257. **Copy-as-curl (mid-hunt)** — one click copies any logged request as a curl command for manual replay.
51258. **Log redaction presets** — one-tap masking profiles for demos, clients, or public sharing.
51259. **Agent thought stream** — the agent's internal reasoning rendered as a readable companion to raw logs.
51260. **Log performance overlay** — request rates and latencies graphed alongside the log stream.
51261. **Stall detection** — the log view highlights when no new activity appears for an unusual gap.
51262. **Log sharing links** — share a live, read-only log view with a teammate via link.
51263. **Log watermarking** — shared log views carry viewer identity to discourage leaks.
51264. **Offline log cache** — the full log stays browsable even if the hunt connection drops.
51265. **Log summarizer** — AI-condensed summaries of any selected log range in plain language.
51266. **Tool output diffing** — compare outputs of the same tool across runs to spot changes.
51267. **Log keyboard navigation** — jump between errors, findings, and bookmarks with shortcuts.
51268. **Custom log views** — save filter combinations as named views like "auth failures only".
51269. **Log-to-finding promotion** — turn any log line into a draft finding with evidence attached.
51270. **Execution graph view** — the hunt rendered as a live node graph of actions and their results.
51271. **Log sentiment** — phases color-coded by success, struggle, or idle based on log signals.
51272. **Request replay sandbox** — re-run a logged request in an isolated sandbox from the log view.
51273. **Log integrity hash** — tamper-evident hashing so logs serve as reliable evidence.
51274. **Parallel stream merge** — sub-agent logs merged into one chronological stream with color coding.
51275. **Log density control** — slider from "every packet" to "milestones only".
51276. **Smart log folding** — repetitive sequences collapsed into "repeated 47×" with expand option.
51277. **Log voice narration** — have key log events read aloud during hands-free monitoring.
51278. **Log export scheduling** — auto-export logs to your storage at phase boundaries.
51279. **Cross-hunt log compare** — overlay logs from two hunts of the same target to spot differences.
51280. **Log-based Q&A** — ask "why did the login test fail?" and get an answer grounded in the logs.
51281. **Live artifact gallery** — screenshots, responses, and files the agent captured, browsable as they arrive.
51282. **Log access roles** — control which teammates can see raw logs versus summaries.
51283. **Log retention policies** — auto-archive or purge logs per your compliance schedule.
51284. **One-click incident package** — bundle logs, findings, and timeline into a shareable evidence pack.
51285. **Instant pause button** — freeze all agent activity within a second, with visual confirmation.
51286. **Graceful pause** — finish the in-flight request before pausing to avoid half-written state.
51287. **Pause with reason** — tag each pause with a reason for the hunt record.
51288. **Resume exactly** — pick up precisely where the hunt stopped, no repeated or skipped steps.
51289. **Pause scheduling** — set the hunt to pause automatically at a future time.
51290. **Pause on finding** — auto-pause when a finding above a severity threshold appears.
51291. **Pause on approval** — auto-pause while any sensitive-action approval is pending.
51292. **Abort with confirmation** — a two-step abort that shows what will be discarded before you commit.
51293. **Abort-and-archive** — stop the hunt and immediately archive everything collected so far.
51294. **Soft abort** — stop new actions but let the agent finish writing findings and the report.
51295. **Pause per module** — freeze one testing module while others continue.
51296. **Global pause all hunts** — one command pauses every running hunt in your workspace.
51297. **Pause state indicator** — an unmistakable banner showing the hunt is paused and why.
51298. **Resume checklist** — before resuming, see what will run next and confirm.
51299. **Auto-resume timer** — pause for N minutes and resume automatically.
51300. **Pause during stealth** — pausing also halts all network traffic instantly for sensitive windows.
51301. **Abort reason codes** — categorize why hunts were aborted for later analysis.
51302. **Pause notifications** — teammates get notified when a shared hunt is paused or resumed.
51303. **Resume from checkpoint** — roll back to an earlier checkpoint instead of the exact pause point.
51304. **Pause API** — external systems can pause or resume hunts programmatically.
51305. **Pause heat indicator** — shows how "hot" the pause is: mid-exploit pauses flagged for review.
51306. **Resume dry-run** — preview the next 5 actions before actually resuming.
51307. **Abort impact summary** — what findings, coverage, and time are lost if you abort now.
51308. **Pause-and-chat** — while paused, chat freely with the agent about strategy before resuming.
51309. **Conditional auto-resume** — resume automatically when a condition you set becomes true.
51310. **Pause templates** — named pause reasons reused across hunts for consistent records.
51311. **Hunt hibernation (mid-hunt)** — deep-freeze a hunt for days with full state preserved on disk.
51312. **Wake-on-finding** — a hibernated hunt wakes if the target changes in a watched way.
51313. **Pause cost display** — shows idle resource cost while a hunt sits paused.
51314. **Resume with new instructions** — attach fresh steering commands that apply on resume.
51315. **Abort-and-clone** — abort this run but clone its config for a fresh hunt later.
51316. **Pause approval chains** — pausing also suspends pending approval timers.
51317. **Resume conflict check** — warns if the target changed while paused before resuming.
51318. **Pause screen lock** — optionally lock the hunt view while paused for shared screens.
51319. **Abort to report** — abort testing but keep the agent available to finalize the report.
51320. **Pause analytics** — track how often and why you pause to improve hunt planning.
51321. **Hands-free pause toggle** — pause and resume the hunt with spoken voice commands.
51322. **Mobile pause control** — a big thumb-friendly pause button on the mobile view.
51323. **Pause inheritance** — pausing a parent hunt pauses its linked sub-hunts.
51324. **Resume ordering** — when resuming multiple hunts, choose the order they restart.
51325. **Pause during approvals** — approvals decided while paused queue for execution on resume.
51326. **Abort confirmation summary** — a final screen summarizing the hunt before it's gone.
51327. **Pause-to-steer** — one gesture that pauses and opens the steering panel together.
51328. **Resume with reduced scope** — resume but drop the lowest-priority remaining phases.
51329. **Pause watchdog** — alerts you if a hunt stays paused longer than expected.
51330. **Abort cascade control** — choose whether aborting affects linked hunts or just this one.
51331. **Pause state export** — download the frozen state for audit or transfer.
51332. **Resume notes** — attach a note explaining why the hunt is resuming now.
51333. **Pause button placement** — the pause control stays visible and reachable on every hunt screen.
51334. **Abort requires reason** — a mandatory reason that feeds hunt retrospectives.
51335. **Pause-and-snapshot** — automatically capture a report snapshot at the moment of pausing.
51336. **Resume speed ramp** — optionally resume at reduced request rate, ramping back up.
51337. **Pause collaboration** — teammates see who paused and can discuss before resuming.
51338. **Hunt pause calendar** — schedule recurring pause windows (e.g. business hours blackout).
51339. **Pause state diff** — on resume, see what changed in the target during the pause.
51340. **Abort archive search** — aborted hunts remain searchable with their partial findings.
51341. **Breadth-to-depth switch** — one control that shifts the agent from wide coverage to deep dives.
51342. **Depth-to-breadth switch** — the reverse: pull back from deep testing to cover more surface.
51343. **Strategy presets** — named strategies like "API-first" or "auth-focused" applied live.
51344. **Strategy comparison** — see the current strategy side by side with the proposed one.
51345. **Strategy impact forecast** — estimated time and coverage change before you commit.
51346. **Custom strategy builder** — compose phase mixes with sliders and save as your own preset.
51347. **Strategy versioning** — every strategy change versioned so you can roll back.
51348. **A/B strategy testing** — run two strategies on mirrored scope and compare finding yield.
51349. **Strategy suggestions** — the agent recommends strategy shifts based on live results.
51350. **Scheduled strategy shifts** — "go deep on auth after recon completes" queued in advance.
51351. **Strategy per asset** — different strategies for different in-scope assets simultaneously.
51352. **Strategy heatmap** — visual map of where effort is going under the current strategy.
51353. **Strategy rationale log** — why each strategy change was made, in the agent's own words.
51354. **Strategy templates by industry** — prebuilt strategies tuned for fintech, health, SaaS, and more.
51355. **Strategy import/export** — share strategies with teammates or the community as files.
51356. **Strategy dry-run** — simulate a strategy change against remaining scope before applying.
51357. **Strategy confidence** — the agent rates how well the current strategy fits what it's discovering.
51358. **Auto-strategy mode** — let the agent shift strategies on its own within bounds you set.
51359. **Strategy guardrails** — limits on what auto-strategy may change without asking.
51360. **Strategy change alerts** — notified whenever the strategy shifts, manually or automatically.
51361. **Strategy effectiveness score** — findings-per-hour under each strategy, tracked live.
51362. **Strategy rollback (mid-hunt)** — one click returns to the previous strategy with state intact.
51363. **Strategy annotations** — note why you chose a strategy for the final report.
51364. **Strategy chat commands** — "switch to depth mode" works from chat, voice, or buttons.
51365. **Strategy timeline** — the hunt timeline color-coded by active strategy per segment.
51366. **Strategy-based reporting** — the final report notes which strategy found each finding.
51367. **Strategy presets marketplace** — community-shared strategies you can preview and install.
51368. **Strategy simulator** — test strategies against historical hunt data before going live.
51369. **Strategy focus areas** — pick 2–3 focus areas; the strategy optimizer weights them.
51370. **Strategy exclusions** — rule out techniques or areas under the new strategy explicitly.
51371. **Strategy timeboxing** — "try depth mode for 45 minutes, then report back."
51372. **Strategy voting** — teammates vote on proposed strategy changes in shared hunts.
51373. **Strategy diff view** — exactly what changes in phases, modules, and priorities.
51374. **Strategy presets for retests** — "retest mode" strategy optimized for verifying fixes.
51375. **Strategy learning** — the agent remembers which strategies worked on similar targets.
51376. **Strategy quiet hours** — aggressive strategies auto-downgrade during business hours.
51377. **Strategy cost estimator** — projected requests, time, and spend under the new strategy.
51378. **Strategy approval flow** — major strategy changes routed through approval like sensitive actions.
51379. **Strategy chaining** — queue "breadth now, depth later, retest at the end" as a sequence.
51380. **Strategy performance alerts** — warned when the current strategy underperforms its forecast.
51381. **Strategy personalization** — strategies adapt to your historical preferences automatically.
51382. **Strategy explainability** — "why is depth mode better here?" answered with evidence.
51383. **Strategy snapshots** — capture the strategy state alongside report snapshots.
51384. **Strategy migration** — apply a working strategy from one hunt to another live hunt.
51385. **Strategy fairness** — ensure all in-scope assets get minimum coverage under any strategy.
51386. **Strategy pause points** — strategy changes only apply at safe phase boundaries if you prefer.
51387. **Strategy notifications digest** — batch strategy updates instead of interrupting you.
51388. **Strategy rollback window** — a grace period after each change to undo with one click.
51389. **Strategy tags** — label strategy segments for filtering in analytics later.
51390. **Strategy vs findings correlation** — which strategy produced each finding, visualized.
51391. **Strategy export to report** — the strategy journey included as an appendix automatically.
51392. **Strategy voice control** — switch strategies hands-free with voice commands.
51393. **Strategy mobile control** — change strategy from the phone with a simplified picker.
51394. **Strategy guardrail presets** — "never go aggressive on prod" style rules enforced automatically.
51395. **Strategy retrospectives** — post-hunt review of strategy decisions and their outcomes.
51396. **Strategy recommendation engine (mid-hunt)** — ML-driven suggestions based on thousands of past hunts.
51397. **Explain-this-finding button** — one tap turns any finding into a plain-language explanation.
51398. **ELI5 mode** — explanations pitched at a complete non-technical reader on demand.
51399. **Executive summary toggle** — a business-impact paragraph for every finding, generated live.
51400. **Analogy generator** — the agent explains vulnerabilities through real-world analogies.
51401. **Explanation depth slider** — from one sentence to a full walkthrough, you choose.
51402. **Jargon buster** — technical terms in explanations get inline plain definitions.
51403. **Visual exploit walkthrough** — step-by-step illustrated flow of how the finding was proven.
51404. **Ask-follow-up on explanations** — keep questioning any explanation until it clicks.
51405. **Explanation in your language** — plain-language explanations in any language you speak.
51406. **Role-based explanations** — tailored versions for developer, manager, or executive audiences.
51407. **Explanation confidence** — the agent flags parts of the explanation it's less sure about.
51408. **Evidence-linked explanations** — each claim in the explanation links to supporting evidence.
51409. **Comparison explanations** — "this is like the finding we saw last month, except…" framing.
51410. **Risk-in-context explainer** — why this finding matters for this specific business.
51411. **Fix-oriented explanations** — every explanation ends with what fixing it looks like.
51412. **Explanation history** — revisit every explanation generated during the hunt.
51413. **Shareable explanation cards** — clean cards you can send to stakeholders directly.
51414. **Voice explanations** — hear the finding explained aloud by the avatar.
51415. **Explanation quizzes** — quick check-questions to confirm a stakeholder understood.
51416. **Kid-friendly mode** — extreme simplification for awareness-training contexts.
51417. **Explanation templates** — your preferred explanation structure applied automatically.
51418. **Live explanation editing** — tweak the agent's explanation and it learns your style.
51419. **Explanation versioning** — track how an explanation evolved as the finding matured.
51420. **Contrasting opinions** — the agent presents alternative interpretations of ambiguous findings.
51421. **Severity justification** — plain-language reasoning for why the severity rating was assigned.
51422. **Attack-scenario narration** — "here's how an attacker would actually use this" storytelling.
51423. **Business-process mapping** — the finding mapped to the business process it threatens.
51424. **Explanation search** — find past explanations by keyword across all hunts.
51425. **Explanation export** — download explanations as slides or one-pagers.
51426. **Regulatory framing** — the finding explained in terms of relevant compliance requirements.
51427. **Cost-of-breach framing** — potential financial impact explained in plain numbers.
51428. **Timeline explanations** — how long the weakness likely existed, explained simply.
51429. **Peer-benchmark context** — "similar companies typically fix this in X days" framing.
51430. **Explanation feedback loop** — rate explanations to improve future ones.
51431. **Multi-finding narratives** — several related findings woven into one coherent story.
51432. **Explanation chat threads** — discuss any explanation with the agent in a thread.
51433. **Visual severity scales** — intuitive gauges showing where the finding sits on risk scales.
51434. **Remediation difficulty meter** — plain indication of how hard the fix will be.
51435. **Exploitability meter** — how easily an attacker could use this, in plain terms.
51436. **Explanation for clients** — white-labeled explanations suitable for sending to your clients.
51437. **Glossary auto-linking** — every technical term links to a plain definition.
51438. **Story-mode report section** — findings retold as a narrative chapter in the report.
51439. **Explanation personalization** — the agent adapts explanations to what you already know.
51440. **Myth-busting notes** — common misconceptions about the finding type, corrected plainly.
51441. **FAQ generator** — anticipated stakeholder questions answered for each finding.
51442. **Explanation diff** — see how the explanation changed as evidence grew.
51443. **Confidence-to-clarity meter** — how solid the evidence is, expressed without jargon.
51444. **Plain-language titles** — every finding gets a non-technical headline alongside its technical name.
51445. **One-line takeaways** — the single most important sentence about each finding.
51446. **Explanation sharing controls** — choose which explanation depth each stakeholder receives.
51447. **Audio explanation clips** — short listenable summaries per finding for busy stakeholders.
51448. **Explanation analytics** — which explanations stakeholders actually opened and understood.
51449. **Live explanation updates** — explanations refresh automatically as the finding's confidence changes.
51450. **Cross-finding plain summaries** — "overall, your login system has…" synthesis in plain words.
51451. **Explanation citations** — sources and evidence listed in reader-friendly form.
51452. **Explain-while-you-watch** — explanations generated live as you watch the finding being proven.
51453. **On-demand test box** — type "try SQLi on the login form" and the agent queues a targeted test.
51454. **Test request wizard** — guided steps that turn a vague idea into a precise, safe test.
51455. **Test targeting picker** — point-and-click selection of the exact URL, form, or parameter to test.
51456. **Test technique menu** — choose from the agent's full technique catalog with plain descriptions.
51457. **Custom payload input** — supply your own test payload for the agent to execute safely.
51458. **Test priority flag** — mark a requested test as urgent to jump the queue.
51459. **Test queue view** — see all your requested tests with live status: queued, running, done.
51460. **Test cancellation** — withdraw a requested test before or during execution.
51461. **Test result alerts** — notified the moment your requested test completes, with the verdict.
51462. **Test cost preview** — estimated requests and time before you confirm the test.
51463. **Test safety check** — the agent warns if your requested test risks side effects.
51464. **Test approval routing** — risky requested tests flow through the approval system automatically.
51465. **Test templates** — save frequent test requests as one-click templates.
51466. **Test chaining** — "if that works, then try…" conditional follow-up tests.
51467. **Test scheduling** — queue a test to run when the current phase completes.
51468. **Test repetition** — re-run a previous test against a changed target with one click.
51469. **Test comparison** — run the same test across multiple endpoints and compare results.
51470. **Test notes** — attach your hypothesis to a requested test for the record.
51471. **Test result explanation** — every completed test gets a plain-language verdict.
51472. **Test evidence capture** — full request/response evidence stored automatically per test.
51473. **Test sharing** — send a test request link to a teammate to review before running.
51474. **Voice test requests** — dictate test ideas hands-free during a live hunt.
51475. **Test request history** — every test you ever requested, searchable with outcomes.
51476. **Test suggestion engine** — the agent proposes tests based on what it's discovering.
51477. **Bulk test requests** — submit a list of targets and techniques in one batch.
51478. **Test parameter tuning** — adjust depth, payload count, or timeouts per requested test.
51479. **Test sandbox mode** — run your requested test against a safe replica first.
51480. **Test dry-run** — preview exactly what the agent will send before it sends anything.
51481. **Test result streaming** — watch your requested test execute step by step live.
51482. **Test interruption** — stop a running requested test instantly with a kill switch.
51483. **Test follow-ups** — one click asks the agent to dig deeper into a test result.
51484. **Test to finding promotion** — successful tests convert into draft findings automatically.
51485. **Test labeling** — tag requested tests for filtering in reports and analytics.
51486. **Test collaboration** — teammates can comment on and refine your test requests.
51487. **Test request API** — external tools can submit test requests programmatically.
51488. **Test quota display** — see how many on-demand tests remain in your hunt budget.
51489. **Test technique info** — plain-language cards explaining what each technique does.
51490. **Test risk badges** — each request labeled safe, cautious, or destructive upfront.
51491. **Test rollback** — for state-changing tests, the agent restores target state afterwards.
51492. **Test result export** — download any test's full evidence as a standalone file.
51493. **Test replay** — re-execute an identical test later for regression checking.
51494. **Test diffing** — compare results of the same test across two points in time.
51495. **Test request chat** — discuss a planned test with the agent before launching it.
51496. **Test auto-documentation** — requested tests documented in the report automatically.
51497. **Test success metrics** — track which of your requested tests actually found issues.
51498. **Test idea inbox** — a place to jot test ideas that the agent picks up when idle.
51499. **Test priority queue controls** — reorder your requested tests by drag and drop.
51500. **Test environment selector** — choose whether the test runs against prod, staging, or a mirror.
51501. **Test credential injection** — securely supply test credentials for authenticated tests.
51502. **Test session recording** — requested tests recorded as replayable sessions.
51503. **Test result sharing** — share a test's outcome via link with full evidence.
51504. **Test feedback loop** — rate test usefulness so the agent suggests better tests next time.
51505. **Test request templates gallery** — community-shared test recipes you can install with one click.
51506. **Test dependency mapping** — see which requested tests depend on others' results.
51507. **Test outcome predictions** — the agent estimates likely success before running your test.
51508. **Test request archiving** — old requests archived but restorable for future hunts.
51509. **Live findings feed** — findings stream in the moment they're confirmed, newest first.
51510. **Finding toast alerts** — unobtrusive popups for new findings with severity color-coding.
51511. **Severity sound cues** — optional audio tones distinguishing critical from low findings.
51512. **Findings ticker** — a scrolling ticker of latest findings across all your hunts.
51513. **Live finding cards** — rich cards with evidence preview expanding inline.
51514. **Finding detail drawer (mid-hunt)** — slide-over panel with full evidence without leaving the feed.
51515. **Real-time severity badges** — severity updates live as the agent gathers more evidence.
51516. **Finding confidence sparkline** — confidence trending up or down as validation proceeds.
51517. **New-finding spotlight** — the newest finding highlighted until you acknowledge it.
51518. **Finding feed filters** — filter by severity, confidence, asset, or technique instantly.
51519. **Finding feed search** — full-text search across live and historical findings.
51520. **Finding grouping** — related findings auto-clustered into collapsible groups.
51521. **Duplicate detection live** — near-duplicate findings merged as they arrive.
51522. **Finding timeline view** — findings plotted on the hunt timeline by discovery moment.
51523. **Finding map view** — findings plotted on a visual map of the target's attack surface.
51524. **Finding kanban board (mid-hunt)** — drag findings between new, triaging, confirmed, and false-positive.
51525. **Live triage actions** — confirm, dismiss, or escalate directly from the feed.
51526. **Finding assignment** — assign a live finding to a teammate with one click.
51527. **Finding comments** — discuss each finding in its own thread as it develops.
51528. **Finding watchers (mid-hunt)** — follow a finding to get updates as its evidence evolves.
51529. **Finding version history** — see how a finding changed from first detection to now.
51530. **Evidence preview inline** — screenshots and payloads visible without opening a new view.
51531. **Finding replay** — watch the exact steps that led to the finding, replayed live.
51532. **Finding provenance** — which phase, module, and steering decision produced it.
51533. **Finding export** — download any finding as PDF or markdown instantly.
51534. **Finding share links** — read-only links to individual findings for stakeholders.
51535. **Finding print view** — clean printable layout per finding or per batch.
51536. **Finding notifications** — push, email, or Slack alerts tuned by severity threshold.
51537. **Quiet finding mode** — batch low-severity findings into hourly digests.
51538. **Finding digest emails** — scheduled summaries of new findings per hunt.
51539. **Finding RSS feed** — subscribe to a hunt's findings as a live feed.
51540. **Finding webhook** — push new findings to your systems the instant they appear.
51541. **Finding API** — programmatic access to the live findings stream.
51542. **Finding dashboard widgets** — embeddable live counters and lists for your dashboards.
51543. **Finding heatmap** — target areas colored by finding density in real time.
51544. **Finding trends** — live chart of finding rate and severity mix over the hunt.
51545. **Finding comparison** — current hunt's findings overlaid on the last hunt's.
51546. **Finding milestones** — celebrations and markers at finding-count milestones.
51547. **Finding leaderboard** — which techniques and modules are finding the most, live.
51548. **Finding coverage meter** — findings mapped against attack-surface coverage.
51549. **Finding deduplication review** — review and split auto-merged findings if needed.
51550. **Finding severity voting (mid-hunt)** — teammates vote on severity; the agent shows the consensus.
51551. **Finding SLA tracking** — time-to-triage tracked live per finding.
51552. **Finding aging alerts** — nudge when a critical finding sits untriaged too long.
51553. **Finding bulk actions** — select many findings to triage, assign, or export together.
51554. **Finding tag system** — custom tags for organizing findings your way.
51555. **Finding saved views** — save filter combinations as named views like "criticals only".
51556. **Finding presentation mode** — full-screen, auto-advancing walkthrough of findings.
51557. **Finding voice briefing** — the avatar reads out new findings as they arrive.
51558. **Finding mobile cards** — thumb-friendly finding cards optimized for phones.
51559. **Finding offline access** — the feed stays browsable if the connection drops.
51560. **Finding redaction mode** — hide sensitive evidence when screen-sharing the feed.
51561. **Finding watermark** — shared finding views carry viewer identity.
51562. **Finding to ticket** — one-click creation of Jira/Linear tickets from live findings.
51563. **Finding chat integration** — new criticals posted to your team channel automatically.
51564. **Finding retrospective prompts** — after each hunt, review which findings mattered most.
51565. **Dig-deeper prompts** — "I found X — want me to dig deeper?" asked at the right moment.
51566. **Scope-expansion suggestions** — the agent proposes newly discovered assets worth adding.
51567. **Technique proposals** — "I noticed Y; should I try Z next?" with one-tap approval.
51568. **Priority check-ins** — the agent asks which of two leads matters more to you.
51569. **Ambiguity clarifications** — proactive questions when your steering could mean two things.
51570. **Risk confirmations** — the agent double-checks before crossing a risk threshold.
51571. **Finding triage questions** — "this looks like a duplicate of #12 — merge them?"
51572. **Strategy pivot proposals** — the agent suggests a strategy change with its reasoning.
51573. **Resource check-ins** — "I'm using a lot of requests; should I slow down?"
51574. **Time check-ins** — "30 minutes left on the budget — how should I spend it?"
51575. **Credential requests** — the agent asks for login credentials when authenticated testing would help.
51576. **Context questions** — "is this staging or production?" asked before risky steps.
51577. **Business-context questions** — the agent asks what matters most to prioritize impact.
51578. **False-positive checks** — "this might be a false positive — want me to verify?"
51579. **Exploit-depth questions** — "I've confirmed the issue; should I demonstrate full impact?"
51580. **Report-scope questions** — "should low-severity items go in the main report?"
51581. **Notification preference checks** — the agent learns when you want to be interrupted.
51582. **Handoff questions** — "you seem away — should I continue autonomously or wait?"
51583. **Retest proposals** — "the target changed; want me to re-verify the earlier findings?"
51584. **Collaboration prompts** — "should I invite a teammate to look at this finding?"
51585. **Learning questions** — "was that finding useful? Your answer improves my future hunts."
51586. **Assumption disclosures** — the agent states assumptions it's operating under for you to correct.
51587. **Plan-review prompts** — "here's my plan for the next phase — any changes?"
51588. **Checkpoint questions** — scheduled moments where the agent asks for direction.
51589. **Anomaly alerts as questions** — "traffic spiked unusually — should I investigate or ignore?"
51590. **Coverage questions** — "I've covered 80% — chase the last 20% or go deeper on findings?"
51591. **Tool-choice questions** — "two tools could do this; prefer speed or thoroughness?"
51592. **Evidence questions** — "I have enough for a medium; want stronger proof for a high?"
51593. **Timing questions** — "this test is slow; run it now or overnight?"
51594. **Parallelism questions** — "I can run these in parallel; okay to increase load?"
51595. **Data-handling questions** — "I found exposed data; how should I handle it?"
51596. **Disclosure questions** — "critical finding confirmed — notify the client now or at the end?"
51597. **Steering feedback requests** — "did that redirection help? I'll remember your answer."
51598. **Goal-alignment checks** — "just confirming: the goal is still maximum coverage, right?"
51599. **Interruption triage** — when several questions queue, the agent asks the most urgent first.
51600. **Question snoozing** — snooze a proactive question and have it return at a better time.
51601. **Question batching (mid-hunt)** — non-urgent questions grouped into a single digest.
51602. **Question urgency labels** — every agent question marked FYI, decision-needed, or blocking.
51603. **Auto-answer rules** — predefine answers to recurring questions like "yes, always dig deeper".
51604. **Question history** — review every question the agent asked and how you answered.
51605. **Question response analytics** — which of your answers led to the best outcomes, tracked over time.
51606. **Silent-mode questions** — in quiet mode, questions queue silently instead of interrupting.
51607. **Voice-asked questions** — the avatar speaks important questions aloud.
51608. **Mobile question cards** — proactive questions as swipeable cards on your phone.
51609. **Question escalation** — unanswered blocking questions escalate to a teammate.
51610. **Contextual question timing** — questions arrive at phase boundaries, not mid-thought.
51611. **Question previews** — see what the agent will do for each answer option before choosing.
51612. **Multi-option questions** — questions with 3–4 concrete options instead of yes/no.
51613. **Question templates** — the agent's question style adapts to your preferred format.
51614. **Question fatigue guard** — the agent limits how often it interrupts you per hour.
51615. **Proactive question log** — an auditable record of every question and decision.
51616. **Question-driven learning** — your answers fine-tune the agent's future judgment.
51617. **Emergency questions** — critical questions break through quiet hours and do-not-disturb.
51618. **Question delegation** — route specific question types to designated teammates.
51619. **Question confidence display** — the agent shows how strongly it leans toward each option.
51620. **Post-hunt question review** — revisit the key decisions the agent asked you to make.
51621. **One-click snapshot** — capture a full report draft at any moment mid-hunt.
51622. **Scheduled snapshots** — auto-generate snapshots at intervals you configure.
51623. **Snapshot comparison (mid-hunt)** — diff any two snapshots to see how the hunt progressed.
51624. **Snapshot timeline** — all snapshots arranged on a scrubbable timeline.
51625. **Snapshot sharing** — send a snapshot link to stakeholders without exposing live controls.
51626. **Snapshot PDF export** — download any snapshot as a polished PDF instantly.
51627. **Snapshot annotations (mid-hunt)** — add your notes on top of a snapshot for stakeholders.
51628. **Snapshot watermarking** — snapshots stamped with draft status and generation time.
51629. **Snapshot deltas** — each snapshot highlights what's new since the previous one.
51630. **Executive snapshot mode** — a one-page business summary generated mid-hunt.
51631. **Technical snapshot mode** — full evidence detail for engineering audiences.
51632. **Snapshot subscriptions** — stakeholders auto-receive new snapshots as they're taken.
51633. **Snapshot approval** — mark a snapshot as reviewed before it's shared externally.
51634. **Snapshot retention** — old snapshots auto-archived per your policy.
51635. **Snapshot search** — find any snapshot by date, finding, or note.
51636. **Snapshot templates** — your branded layout applied to every snapshot.
51637. **Snapshot language options** — generate snapshots in any supported language.
51638. **Live snapshot preview** — see the draft report updating in real time as findings land.
51639. **Snapshot completeness meter** — how close the snapshot is to a final-report standard.
51640. **Snapshot finding states** — findings marked draft, validating, or confirmed within snapshots.
51641. **Snapshot comments** — stakeholders comment on snapshots without hunt access.
51642. **Snapshot versioning** — every snapshot numbered and immutable once shared.
51643. **Snapshot diff alerts** — notified when a new snapshot differs significantly.
51644. **Snapshot API** — pull snapshot data programmatically into your systems.
51645. **Snapshot embedding** — embed a live-updating snapshot in wikis or dashboards.
51646. **Snapshot redaction** — generate client-safe snapshots with sensitive details hidden.
51647. **Snapshot cover page** — auto-generated cover with target, date, and scope summary.
51648. **Snapshot table of contents** — navigable TOC generated for every snapshot.
51649. **Snapshot charts** — severity distribution and trend charts rendered automatically.
51650. **Snapshot appendices** — evidence and logs attached as organized appendices.
51651. **Snapshot sign-off** — collect stakeholder sign-off on a snapshot digitally.
51652. **Snapshot expiry** — shared links expire automatically after a set period.
51653. **Snapshot access logs** — see who viewed each snapshot and when.
51654. **Snapshot translation** — one-click translation of the full snapshot.
51655. **Snapshot print optimization** — layouts tuned for clean printing.
51656. **Snapshot mobile view** — snapshots readable and navigable on phones.
51657. **Snapshot voice summary** — an audio walkthrough of the latest snapshot.
51658. **Snapshot Q&A** — ask questions about a snapshot and get answers grounded in it.
51659. **Snapshot comparison charts** — finding counts across snapshots visualized.
51660. **Snapshot milestone markers** — snapshots auto-taken at phase completions.
51661. **Snapshot custom sections** — add your own sections that persist across snapshots.
51662. **Snapshot data export** — raw snapshot data as JSON/CSV for your own tooling.
51663. **Snapshot integrity seal** — cryptographic seal proving a snapshot hasn't been altered.
51664. **Snapshot collaboration** — teammates co-edit snapshot notes in real time.
51665. **Snapshot notification rules** — control who gets told about each new snapshot.
51666. **Snapshot archive browser** — browse every snapshot from every hunt in one place.
51667. **Snapshot restore** — revert the draft report to an earlier snapshot's state.
51668. **Snapshot diff summary** — plain-language "what changed" for each new snapshot.
51669. **Snapshot KPI panel** — key metrics (findings, coverage, time) atop every snapshot.
51670. **Snapshot risk overview** — overall risk posture summarized visually per snapshot.
51671. **Snapshot remediation preview** — upcoming fix guidance included even mid-hunt.
51672. **Snapshot compliance mapping** — findings mapped to frameworks live in the snapshot.
51673. **Snapshot client portal** — clients view snapshots in a branded portal without seeing internals.
51674. **Snapshot feedback collection** — stakeholders rate snapshot usefulness per section.
51675. **Final-from-snapshot** — promote any snapshot to the final report with one click.
51676. **Live confidence score** — every finding shows a 0–100 confidence that updates as evidence grows.
51677. **Confidence trend arrow** — rising, falling, or stable indicators beside each score.
51678. **Evidence-strength meter** — visual gauge of how much proof backs the finding.
51679. **Validation-stage labels** — detected, reproducing, validated, confirmed stages shown live.
51680. **Confidence breakdown** — expand a score to see which evidence contributed how much.
51681. **Low-confidence flagging** — findings below your threshold highlighted for skepticism.
51682. **Confidence-based sorting** — sort the feed by confidence as well as severity.
51683. **Confidence filters (mid-hunt)** — show only findings above a confidence you set.
51684. **Confidence history graph** — how a finding's confidence evolved over time.
51685. **Agent uncertainty notes** — the agent writes what it's unsure about in plain words.
51686. **Cross-validation badges** — marked when multiple techniques independently confirm a finding.
51687. **Manual-verification prompts** — the agent suggests human checks for shaky findings.
51688. **Confidence vs severity matrix** — a grid view plotting findings on both axes.
51689. **Confidence-weighted prioritization (mid-hunt)** — triage order blends severity with confidence automatically.
51690. **Confidence decay** — scores fade if supporting evidence is later contradicted.
51691. **Confidence boost events** — visible markers when new evidence raises a score.
51692. **Peer-agreement indicator** — how often similar findings proved true in past hunts.
51693. **Confidence calibration view** — compare the agent's past confidence scores against actual outcomes.
51694. **Threshold alerts (mid-hunt)** — notified when a finding crosses your confidence threshold.
51695. **Confidence in notifications** — alerts include the score so you can judge urgency.
51696. **Confidence in snapshots** — draft reports show scores so readers know what's solid.
51697. **Confidence color coding** — consistent colors from red (shaky) to green (certain).
51698. **Confidence tooltips** — hover any score for a one-line plain explanation.
51699. **Confidence audit log** — every score change recorded with its trigger.
51700. **Confidence-based auto-triage** — high-confidence findings auto-escalate per your rules.
51701. **Confidence dispute** — challenge a score and the agent re-evaluates with your input.
51702. **Confidence benchmarks** — compare a finding's score against typical scores for its class.
51703. **Confidence export** — scores included in every finding export format.
51704. **Confidence API** — programmatic access to live confidence data.
51705. **Confidence in chat answers** — the agent states its confidence when discussing findings.
51706. **Multi-model agreement** — when brains disagree, both confidence scores shown side by side.
51707. **Confidence floor setting** — findings below the floor stay in a "needs work" tray.
51708. **Confidence milestone badges** — "validated" and "confirmed" badges earned as scores rise.
51709. **Confidence-driven evidence requests** — low scores trigger the agent to gather more proof automatically.
51710. **Confidence by evidence type** — see which evidence kinds (screenshot, response, replay) back the score.
51711. **Confidence sharing controls** — choose whether clients see raw scores or simplified labels.
51712. **Confidence trend alerts** — warned when a finding's confidence drops sharply.
51713. **Confidence-weighted reporting** — report sections ordered by a blend of severity and confidence.
51714. **Confidence explanations** — "why is this only 62?" answered with specifics.
51715. **Confidence calibration training (mid-hunt)** — the agent improves scoring from your triage feedback.
51716. **Confidence in mobile view** — scores and trends fully visible on phones.
51717. **Confidence snapshot diffs** — see which scores changed between report snapshots.
51718. **Confidence-based SLAs** — triage deadlines scale with confidence level.
51719. **Confidence grouping** — findings clustered into certain, likely, and unproven buckets.
51720. **Confidence override** — analysts can set a manual score with a required note.
51721. **Override audit trail** — manual overrides logged with who and why.
51722. **Confidence in retrospectives** — post-hunt review of scoring accuracy.
51723. **Confidence-driven retesting** — borderline findings automatically retested before the hunt ends.
51724. **Confidence notifications digest** — score changes batched instead of spammed.
51725. **Confidence legend** — a persistent guide explaining what each score band means.
51726. **Confidence for duplicates** — merged findings show combined confidence transparently.
51727. **Confidence in presentations** — presentation mode includes scores tastefully.
51728. **Confidence-based approvals** — low-confidence destructive validations need extra approval.
51729. **Confidence export to SIEM** — scores flow into your security tooling.
51730. **Confidence maturity model** — track how scoring accuracy improves across hunts.
51731. **Live ETA display** — always-visible estimated completion time for the whole hunt.
51732. **Per-phase ETAs** — each remaining phase shows its own estimated duration.
51733. **ETA confidence interval** — a range ("2–3 hours") instead of a false-precise number.
51734. **ETA trend** — whether the estimate is shrinking or slipping, shown as a trend.
51735. **Current-step ETA** — how long the specific action in progress should take.
51736. **ETA breakdown** — expand to see which phases consume the remaining time.
51737. **ETA history graph** — how the estimate evolved since the hunt started.
51738. **Finish-time clock** — the ETA rendered as a wall-clock time in your timezone.
51739. **ETA notifications** — alerted when the estimate shifts significantly.
51740. **Deadline mode** — set a hard deadline; the agent replans to fit.
51741. **Deadline feasibility** — the agent says honestly whether the deadline is achievable.
51742. **Time-budget tracker** — hours used versus hours allocated, visualized live.
51743. **Overtime warnings** — warned before the hunt exceeds its budget.
51744. **ETA by strategy** — how each strategy option changes the remaining time.
51745. **Steering impact on ETA** — redirections show their time cost before you confirm.
51746. **Pause-adjusted ETA** — pauses and resumes recalculate the estimate automatically.
51747. **ETA per asset** — remaining time broken down by in-scope asset.
51748. **ETA per finding** — average time-to-next-finding based on current pace.
51749. **Slowdown detection** — flagged when progress per hour drops below expectations.
51750. **Speed-up options** — the agent offers concrete ways to finish faster.
51751. **ETA calibration** — estimates improve using your historical hunt data.
51752. **ETA in chat** — ask "how much longer?" anytime for an instant answer.
51753. **ETA voice announcements** — milestone time updates spoken during long hunts.
51754. **ETA mobile widget** — a home-screen widget showing the live countdown.
51755. **ETA sharing** — share a read-only countdown link with stakeholders.
51756. **ETA in snapshots** — every report snapshot stamps the current estimate.
51757. **ETA vs plan variance** — planned versus actual pace shown side by side.
51758. **Phase-duration predictions** — upcoming phases estimated from similar past hunts.
51759. **ETA confidence meter** — how much to trust the current estimate.
51760. **Best/worst-case ETAs** — optimistic and pessimistic bounds alongside the main estimate.
51761. **ETA recalculation log** — every estimate change recorded with its cause.
51762. **Time-to-first-finding** — tracked live and compared with historical averages.
51763. **Idle-time accounting** — time spent paused or awaiting approval shown separately.
51764. **Active-time counter** — pure working time excluding pauses and waits.
51765. **ETA export** — timing data included in hunt exports for planning.
51766. **Multi-hunt ETAs** — all running hunts' estimates on one comparison board.
51767. **ETA-based prioritization** — the agent focuses on what fits the remaining time.
51768. **Wrap-up ETA** — "time to wrap up cleanly from here" estimated on demand.
51769. **ETA for approvals** — pending approvals show how long they've waited.
51770. **ETA for requested tests** — your on-demand tests show individual estimates.
51771. **Overnight ETA** — "done by morning" style estimates for long hunts.
51772. **ETA timezone handling** — finish times shown correctly for distributed teams.
51773. **ETA in tab title** — the countdown visible in the browser tab.
51774. **ETA milestones** — "50% there" style progress celebrations.
51775. **ETA drift alerts** — warned when the estimate slips beyond a threshold.
51776. **ETA scenario planner** — "what if I add two more hours?" answered instantly.
51777. **ETA learning** — the agent explains why its estimate changed in plain words.
51778. **ETA for sub-agents** — each sub-agent's remaining time shown in its tab.
51779. **ETA API** — programmatic access to live estimates.
51780. **ETA dashboard** — timing analytics across all your hunts.
51781. **ETA fairness** — remaining time distributed fairly across assets.
51782. **ETA-based autoscaling** — the agent adds parallelism when behind schedule.
51783. **ETA freeze option** — lock the plan so the estimate stops moving during reviews.
51784. **ETA retrospective** — post-hunt accuracy review of every estimate.
51785. **Countdown voice control** — ask the avatar "how much longer?" hands-free.
51786. **Live request counter** — total HTTP requests sent, ticking in real time.
51787. **Request-rate graph** — requests per second plotted live with your cap overlaid.
51788. **Bandwidth meter** — data sent and received, with per-phase breakdowns.
51789. **CPU usage panel** — local agent CPU consumption shown live.
51790. **Memory usage panel** — RAM footprint with warnings before limits hit.
51791. **GPU usage display** — accelerator utilization when local models run.
51792. **Token usage tracker** — LLM tokens consumed per phase and per hunt.
51793. **Cost estimator** — live projected spend based on tokens, compute, and APIs.
51794. **Budget alerts (mid-hunt)** — warned at 50%, 80%, and 100% of your resource budget.
51795. **Per-module resource split** — which modules consume the most, ranked live.
51796. **Resource history** — usage curves across the whole hunt for review.
51797. **Resource caps** — set hard limits; the agent throttles or pauses at the cap.
51798. **Throttle controls** — dial request rate, parallelism, or model usage live.
51799. **Resource efficiency score** — findings per thousand requests, tracked live.
51800. **Waste detector** — flags modules burning resources with no results.
51801. **Resource forecast** — projected total usage if the hunt runs to completion.
51802. **Resource comparison** — current hunt's usage versus your historical average.
51803. **Export resource data** — download usage stats as CSV for chargeback.
51804. **Resource alerts API** — webhooks when usage crosses thresholds.
51805. **Per-asset resource view** — usage broken down by target asset.
51806. **Model-cost breakdown** — spend per brain/model when multiple models run.
51807. **Kaggle/Colab quota view** — remote GPU session time remaining, shown live.
51808. **Network egress monitor (mid-hunt)** — outbound traffic watched for anomalies.
51809. **Disk usage tracker** — evidence and log storage growth shown live.
51810. **Resource pause triggers** — auto-pause the hunt if usage spikes abnormally.
51811. **Eco mode** — one toggle that minimizes tokens, requests, and compute.
51812. **Resource presets** — "light", "balanced", "unlimited" profiles applied live.
51813. **Team resource dashboard** — organization-wide usage across all hunts.
51814. **Chargeback tags** — tag hunts with cost centers for billing.
51815. **Resource anomaly alerts** — unusual consumption patterns flagged instantly.
51816. **Parallelism tuner** — adjust concurrent tasks and watch resource impact live.
51817. **Cache hit rates** — how often the agent reuses prior work instead of recomputing.
51818. **Resource-based strategy hints** — "you're under budget — consider going deeper."
51819. **Session time tracker** — wall-clock versus active compute time distinguished.
51820. **API quota monitor** — third-party API limits tracked with auto-throttling.
51821. **Resource leaderboard** — your hunts ranked by efficiency.
51822. **Resource retrospectives** — post-hunt usage review with optimization tips.
51823. **Real-time cost ticker** — spend accumulating visibly as the hunt runs.
51824. **Budget top-ups** — increase the budget mid-hunt without restarting.
51825. **Resource guardrails (mid-hunt)** — rules like "never exceed X requests/min on prod".
51826. **Usage heatmap** — resource intensity across the hunt timeline.
51827. **Resource voice queries** — ask "how much have we spent?" hands-free.
51828. **Resource mobile view** — full usage dashboard on your phone.
51829. **Multi-hunt resource board** — all hunts' consumption compared side by side.
51830. **Resource export scheduling** — auto-send usage reports at hunt end.
51831. **Carbon estimate** — approximate energy footprint of the hunt's compute.
51832. **Resource sharing** — pool budgets across hunts in a campaign.
51833. **Idle resource display** — what paused hunts still cost you.
51834. **Resource prediction** — ML forecast of total cost from the first 10 minutes.
51835. **Spend-by-finding metric** — cost per confirmed finding, tracked live.
51836. **Resource quota API** — programmatic budget checks for automation.
51837. **Resource alert routing** — usage alerts sent to the right person per policy.
51838. **Historical resource trends** — your efficiency improving (or not) over months.
51839. **Resource-aware scheduling** — heavy hunts suggested for off-peak windows.
51840. **One-click resource report** — a clean usage summary attached to every final report.
51841. **Hunt switcher bar** — jump between running hunts from a persistent top bar.
51842. **Hunt tabs** — each hunt in its own tab with live status badges.
51843. **Unified command center** — all hunts' key metrics on one screen.
51844. **Hunt comparison view (mid-hunt)** — progress, findings, and ETA side by side.
51845. **Global pause/resume** — control all hunts at once or pick a subset.
51846. **Cross-hunt chat** — ask the coordinator about all hunts in one conversation.
51847. **Hunt priority ranking** — drag hunts into priority order; resources follow.
51848. **Attention-needed sorting** — hunts needing your input float to the top automatically.
51849. **Hunt grouping** — organize hunts into campaigns or client folders.
51850. **Bulk steering** — apply one steering command to multiple hunts at once.
51851. **Bulk approvals** — approve similar requests across hunts in one queue.
51852. **Hunt cloning** — clone a running hunt's config to launch a sibling.
51853. **Hunt templates** — launch new hunts from saved configurations instantly.
51854. **Cross-hunt findings** — one feed merging findings from all running hunts.
51855. **Cross-hunt deduplication (mid-hunt)** — identical findings across hunts linked automatically.
51856. **Hunt health scores** — at-a-glance health per hunt: on track, struggling, stalled.
51857. **Stalled-hunt alerts** — notified when any hunt goes quiet unexpectedly.
51858. **Hunt resource sharing** — a shared pool of request budget across hunts.
51859. **Per-hunt resource caps** — individual limits within the shared pool.
51860. **Hunt scheduling (mid-hunt)** — queue hunts to start when others finish.
51861. **Hunt dependencies** — "start hunt B when hunt A reaches reporting".
51862. **Campaign view** — a campaign dashboard rolling up all its hunts.
51863. **Client view** — per-client rollup of hunts, findings, and time.
51864. **Hunt search (mid-hunt)** — find any hunt by target, status, or finding instantly.
51865. **Hunt filters** — filter by phase, severity, owner, or health.
51866. **Hunt archiving (mid-hunt)** — finished hunts archived but instantly reopenable.
51867. **Hunt favorites** — pin critical hunts to the top of every list.
51868. **Hunt notifications hub** — one inbox for alerts from all hunts.
51869. **Notification routing (mid-hunt)** — per-hunt rules for who gets which alerts.
51870. **Hunt ownership** — assign owners; ownership transfers cleanly.
51871. **Hunt collaboration** — invite teammates to specific hunts with roles.
51872. **Hunt activity feed** — every action across hunts in one chronological stream.
51873. **Hunt timeline compare** — overlay two hunts' timelines to compare pace.
51874. **Hunt notes** — per-hunt notes visible to the whole team.
51875. **Hunt tags** — custom tags for slicing hunts any way you like.
51876. **Hunt saved views** — named filter sets like "my criticals this week".
51877. **Hunt export all** — bulk-export data from multiple hunts at once.
51878. **Hunt API tokens** — per-hunt API access for integrations.
51879. **Hunt webhooks** — per-hunt event streams for your tooling.
51880. **Hunt SSO scoping** — team members see only hunts they're assigned to.
51881. **Hunt audit log** — who did what across all hunts, in one log.
51882. **Hunt cost rollup** — total spend across hunts with per-hunt breakdown.
51883. **Hunt ETA board** — all hunts' completion estimates on one board.
51884. **Hunt conflict detection** — warned when two hunts target overlapping scope.
51885. **Hunt merge** — combine two hunts of the same target into one.
51886. **Hunt split** — split one hunt's scope into two parallel hunts.
51887. **Hunt pause presets** — "pause everything except client X" in one tap.
51888. **Hunt resume ordering** — choose the sequence when restarting several hunts.
51889. **Hunt keyboard shortcuts** — switch hunts and command them without the mouse.
51890. **Hunt voice switching** — "switch to the API hunt" hands-free.
51891. **Hunt mobile cards** — each hunt as a swipeable card on your phone.
51892. **Hunt widgets** — home-screen widgets per hunt or for the whole fleet.
51893. **Hunt dark-mode parity** — the multi-hunt views fully usable in dark mode.
51894. **Hunt onboarding tour** — a guided tour the first time you run multiple hunts.
51895. **Fleet retrospective** — post-campaign review across all hunts at once.
51896. **Voice pause/resume** — "pause the hunt" and "resume" work hands-free instantly.
51897. **Voice status queries** — ask "what are you doing?" aloud and hear the answer.
51898. **Voice steering** — "focus on the API now" redirects the hunt by voice.
51899. **Spoken approval decisions** — approve or deny sensitive actions by voice with voice verification.
51900. **Dictated test commands** — "try SQLi on the login form" spoken aloud becomes a queued test.
51901. **Voice finding briefings** — "read me the new criticals" gives a spoken summary.
51902. **Voice strategy changes** — "switch to depth mode" changes strategy by voice.
51903. **Voice ETA checks** — "how much longer?" answered aloud.
51904. **Voice language choice** — speak in Hindi, English, or Hinglish; the agent follows.
51905. **Push-to-talk control** — hold a button or hotkey to issue voice commands.
51906. **Always-listening mode** — optional wake-word activation for hands-free operation.
51907. **Voice command history** — every spoken command logged with its transcript.
51908. **Voice confirmation** — the agent repeats back commands before acting on risky ones.
51909. **Voice shortcuts** — custom phrases mapped to complex command sequences.
51910. **Voice feedback tones** — audio confirmation when a command is accepted.
51911. **Voice error recovery** — "I didn't catch that" with suggestions instead of silence.
51912. **Voice command help** — "what can I say?" lists available voice commands aloud.
51913. **Voice multi-hunt switching** — "switch to the client X hunt" by voice.
51914. **Voice snapshot requests** — "take a report snapshot" captured by voice.
51915. **Voice explanation requests** — "explain that finding simply" spoken on demand.
51916. **Voice note dictation** — dictate notes that attach to the hunt record.
51917. **Voice chat mode** — full conversational voice interaction with the hunting agent.
51918. **Voice interruption** — barge in while the agent is speaking to redirect it.
51919. **Voice volume ducking** — hunt alert sounds lower automatically while you speak.
51920. **Voice profiles** — the system recognizes authorized voices for sensitive commands.
51921. **Voice command permissions** — destructive commands require an enrolled voice.
51922. **Voice audit trail** — voice commands included in the immutable hunt log.
51923. **Voice in noisy environments** — noise-robust recognition tuned for offices and commutes.
51924. **Voice offline mode** — core commands work without internet via on-device recognition.
51925. **Voice command chaining** — "pause the hunt and take a snapshot" in one breath.
51926. **Voice timers** — "pause for ten minutes, then resume" by voice.
51927. **Voice during screen share** — present findings while controlling the hunt by voice.
51928. **Voice accessibility mode** — full hunt operability for users who can't use a keyboard.
51929. **Voice command discovery** — the agent suggests voice commands based on your habits.
51930. **Voice feedback collection** — "was that command right?" improves recognition.
51931. **Voice emergency stop** — a spoken kill phrase that halts everything immediately.
51932. **Voice whisper mode** — quiet commands recognized without speaking loudly.
51933. **Voice over phone call** — control hunts through a phone call interface.
51934. **Voice smart-speaker integration** — "ask Dark-Matter for hunt status" on home speakers.
51935. **Voice car mode** — driver-safe minimal voice interface for monitoring commutes.
51936. **Voice meeting mode** — discreet status updates during meetings without looking at screens.
51937. **Voice command analytics** — which commands you use most, improving the interface.
51938. **Voice latency display** — shows recognition and execution delay transparently.
51939. **Voice fallback to text** — any voice command also available as a typed equivalent.
51940. **Voice bilingual commands** — mix Hindi and English naturally in one command.
51941. **Voice finding triage** — "mark that as false positive" triages by voice.
51942. **Voice approval delegation** — "let Priya approve the next request" spoken delegation.
51943. **Voice hunt creation** — "start a hunt on example.com" launches by voice.
51944. **Voice report narration** — the agent reads the draft report aloud section by section.
51945. **Voice Q&A on logs** — "why did that test fail?" answered from logs by voice.
51946. **Voice confidence checks** — "how sure are you about that finding?" answered aloud.
51947. **Voice resource queries** — "how much have we spent?" answered by voice.
51948. **Voice team coordination** — voice messages to teammates attached to hunt events.
51949. **Voice command sandbox** — practice voice commands safely on a demo hunt.
51950. **Voice privacy mode** — sensitive readouts rerouted to text instead of speakers.
51951. **Mobile hunt dashboard** — all running hunts glanceable from your phone.
51952. **Mobile live findings** — findings stream to your phone in real time.
51953. **Mobile push alerts** — severity-tuned push notifications for new findings.
51954. **Mobile approval cards** — approve or deny sensitive actions from your phone.
51955. **Mobile pause button** — a big, thumb-friendly pause control.
51956. **Mobile status view** — "what's it doing now?" answered on mobile.
51957. **Mobile ETA widget** — home-screen countdown for active hunts.
51958. **Mobile chat** — full chat with the hunting agent from your phone.
51959. **Mobile voice control** — all voice commands available in the mobile app.
51960. **Mobile log viewer** — condensed live logs readable on small screens.
51961. **Mobile snapshot viewer** — report snapshots beautifully rendered on phones.
51962. **Mobile finding triage** — swipe to confirm, dismiss, or escalate findings.
51963. **Mobile offline mode** — cached hunt state browsable without connectivity.
51964. **Mobile biometric lock** — fingerprint or face unlock for the hunt app.
51965. **Mobile quick actions** — 3D-touch shortcuts for pause, status, and snapshot.
51966. **Mobile dark mode** — full dark theme for nighttime monitoring.
51967. **Mobile data saver** — low-bandwidth mode that minimizes updates.
51968. **Mobile battery saver** — reduced polling to protect battery life.
51969. **Mobile widget stack** — multiple hunt widgets on one home screen.
51970. **Mobile Apple Watch app** — critical alerts and pause control on your wrist.
51971. **Mobile Wear OS app** — the same wrist experience for Android watches.
51972. **Mobile tablet layout** — a two-pane optimized view for tablets.
51973. **Mobile landscape mode** — timeline and logs shine in landscape orientation.
51974. **Mobile share sheet** — share findings or snapshots to any app instantly.
51975. **Mobile screenshot markup** — annotate finding screenshots on the go.
51976. **Mobile comment threads** — discuss findings with teammates from your phone.
51977. **Mobile steering** — redirect the hunt with simplified mobile controls.
51978. **Mobile strategy picker** — change strategies from a thumb-friendly picker.
51979. **Mobile test requests** — request on-demand tests from your phone.
51980. **Mobile confidence view** — finding confidence scores visible on mobile.
51981. **Mobile resource monitor** — spend and usage tracked on the go.
51982. **Mobile multi-hunt switcher** — swipe between hunts effortlessly.
51983. **Mobile onboarding** — a quick tour the first time you monitor on mobile.
51984. **Mobile accessibility** — full VoiceOver/TalkBack support.
51985. **Mobile language support** — the app in your preferred language.
51986. **Mobile quiet hours** — notification schedules respected per device.
51987. **Mobile emergency controls** — kill-switch and deny-all reachable in two taps.
51988. **Mobile handoff** — start on desktop, continue seamlessly on mobile.
51989. **Mobile deep links** — notifications open the exact finding or chat thread.
51990. **Mobile biometric approvals** — approve sensitive actions with fingerprint.
51991. **Mobile hunt creation** — paste a link and launch a hunt from your phone.
51992. **Mobile report export** — download PDFs directly to your phone.
51993. **Mobile team chat** — coordinate with teammates around live hunts.
51994. **Mobile calendar integration** — hunt milestones synced to your calendar.
51995. **Mobile Siri/Assistant shortcuts** — "check hunt status" via system assistants.
51996. **Mobile focus mode** — only critical alerts break through when enabled.
51997. **Mobile glanceable complications** — hunt status on watch faces and lock screens.
51998. **Mobile data export** — share hunt data to files or cloud storage.
51999. **Mobile feedback** — report issues with the mobile experience in-app.
52000. **Mobile performance** — the app stays smooth even with thousand-finding hunts.
52001. **Mobile security** — certificate pinning and encrypted local storage.
52002. **Mobile update channel** — beta features for mobile monitoring, opt-in.
52003. **Mobile usage analytics** — see how you monitor to improve the experience.
52004. **Mobile end-of-hunt summary** — a clean wrap-up card when a hunt completes.
