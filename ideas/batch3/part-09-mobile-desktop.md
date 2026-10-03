# Dark-Matter Idea Batch 3 — Part 09: Mobile & Desktop Experience (28005–29004)

28005. **Live hunt progress ring on mobile app home** — a circular phase indicator showing recon, probing, exploitation, and reporting stages so users see the current hunt stage at a glance.
28006. **Finding push alerts with severity color coding** — critical findings arrive as red push banners while info-level ones are muted, letting hunters triage by color alone.
28007. **Remote hunt start from mobile** — paste or share a URL into the app to launch a full backend hunt without touching the desktop client.
28008. **Remote hunt pause and resume controls** — pause a running hunt from the phone when something needs attention, then resume it later from the same screen.
28009. **Hunt history browser with search** — scrollable, filterable list of every past hunt with dates, targets, and finding counts for quick reference.
28010. **Offline report reader** — downloaded PDF and markdown reports open fully offline with cached formatting for reading on planes or in low-connectivity areas.
28011. **Severity filter chips on the mobile findings list** — one-tap chips for critical, high, medium, low, and info to slice findings without typing a query.
28012. **Mobile finding detail sheets** — bottom-sheet cards showing PoC steps, affected endpoints, and remediation guidance optimized for small screens.
28013. **Biometric app lock for hunt data** — Face ID or fingerprint gate before opening findings so sensitive target data stays protected on a lost phone.
28014. **Hunt timeline scrubber** — a draggable timeline showing when each recon task and probe ran, letting users replay what the agent did and when.
28015. **Real-time agent log stream on mobile** — a live scrolling console of the hunting agent's actions for users who want to watch the reasoning unfold.
28016. **Finding acknowledgment swipe actions** — swipe right on a finding to acknowledge it, swipe left to mark it false positive, with undo support.
28017. **Mobile evidence screenshot gallery** — grid of every screenshot and artifact the agent captured, pinch-zoomable with per-image captions.
28018. **Target health dashboard cards** — per-target cards showing active hunts, open findings, and last-scan age in a glanceable card layout.
28019. **Hunt comparison view** — side-by-side comparison of two hunts against the same target showing which new findings appeared since last time.
28020. **Dark mode optimized for OLED** — true-black theme that reduces battery drain during long monitoring sessions in the dark.
28021. **Haptic feedback on critical findings** — a distinct vibration pattern when a critical finding lands so users feel severity without looking.
28022. **Mobile chat with the hunting agent** — mid-hunt conversational thread where users ask "what are you doing now?" and get plain-language answers.
28023. **Quick-scan mode for single endpoints** — lightweight 60-second scan of one URL from the phone for rapid checks without a full hunt.
28024. **Hunt scheduling from mobile** — set a hunt to start at a future time or repeat nightly, with calendar-style picker.
28025. **Multi-account switching on mobile** — switch between team workspaces with one tap, each with its own hunts, findings, and notification settings.
28026. **Finding share sheet** — export any finding as a formatted message, email, or PDF attachment directly from iOS or Android share sheets.
28027. **Offline queue indicator** — badge showing how many annotations or commands are queued to sync when connectivity returns.
28028. **Mobile onboarding walkthrough** — interactive first-run tour that launches a demo hunt so new users understand the product in minutes.
28029. **Voice-to-target input** — dictate a target URL instead of typing it, with automatic scheme normalization and validation.
28030. **Screenshot markup on findings** — draw arrows and circles on evidence screenshots with touch to highlight the vulnerable element for teammates.
28031. **Finding severity override from mobile** — bump or lower a finding's severity with a required reason note that syncs to the main platform.
28032. **Agent confidence meter per finding** — visible score showing how confident the agent is, helping users decide what to verify first.
28033. **Hunt cost and credit meter** — live display of API credits or compute consumed by the running hunt with a projected total.
28034. **Pause-on-critical setting** — toggle that automatically pauses a hunt when a critical finding is confirmed, waiting for human review.
28035. **Mobile diff of re-scans** — when a hunt re-runs, the app highlights new, fixed, and unchanged findings in green, red, and gray.
28036. **Starred findings collection** — star important findings into a personal collection that syncs across mobile and desktop.
28037. **Export hunt to CSV from mobile** — one-tap CSV export of findings for spreadsheets, saved to device files.
28038. **Hunt notes with markdown** — attach personal markdown notes to any hunt, rendered natively with checklist support.
28039. **Target tagging from mobile** — add tags like "client-a" or "retest" to targets for organization across the fleet.
28040. **Notification inbox inside the app** — a persistent notification history so dismissed push alerts can be revisited later.
28041. **Finding assignment to teammates** — assign a finding to a teammate from the mobile detail sheet with a due date.
28042. **Mobile SLA countdown timers** — per-severity countdown showing time left before a finding breaches its remediation SLA.
28043. **Hunt template picker** — choose from saved hunt profiles (quick, deep, API-focused) when starting a hunt remotely.
28044. **Bandwidth-saver mode** — reduces image and log streaming on cellular data, showing text summaries instead of full evidence.
28045. **Low-battery hunt throttling notice** — warns when the phone is low on battery and offers to hand monitoring to the backend silently.
28046. **Landscape findings kanban** — rotate to landscape for a kanban board of findings across triage columns on larger phones.
28047. **Pull-to-refresh hunt status** — standard pull gesture forces a fresh status poll instead of waiting for the next push cycle.
28048. **Hunt geofencing pause** — automatically pause hunts when the phone enters a geofenced location like the office for compliance.
28049. **Mobile kill switch for all hunts** — big red in-app button that halts all running hunts across the account within seconds.
28050. **Mobile hunt duplication** — clone a finished hunt's configuration to re-run it against the same target with one tap.
28051. **Finding comment threads** — threaded comments on findings so mobile teammates can discuss without leaving the app.
28052. **Read-receipt on shared findings** — see who on the team has viewed a shared finding link.
28053. **App icon badge with open criticals** — the launcher icon shows the count of unacknowledged critical findings.
28054. **Widget-ready hunt summary API** — the mobile app exposes hunt data to OS widgets for home-screen glance cards.
28055. **Finding photo capture for physical evidence** — attach phone photos (e.g., of a kiosk or device) to findings when hunts cover physical attack surfaces.
28056. **Mobile hunt performance stats** — show probes per minute, requests sent, and coverage percentage in a compact stats strip.
28057. **Hunt pause reason prompts** — when pausing remotely, pick a reason (lunch, incident, review) that appears in the hunt audit log.
28058. **Shared device kiosk mode** — lock the app to a single read-only hunt dashboard for SOC wall displays or shared tablets.
28059. **Mobile two-factor approval for sensitive hunts** — starting a hunt against a production target requires a biometric or TOTP confirmation.
28060. **Finding deduplication indicator** — badge showing a finding was auto-merged as a duplicate of an earlier one with a link to the original.
28061. **Hunt health alerts** — push when a hunt stalls, errors repeatedly, or the brain connection drops so users can intervene.
28062. **Mobile retarget from finding** — tap "hunt deeper here" on a finding to launch a focused follow-up hunt on that endpoint.
28063. **Data usage monitor** — show how much mobile data the app consumed this month with per-hunt breakdowns.
28064. **Hunt export to PDF from mobile** — generate the full professional report PDF on-device and save or share it.
28065. **Collaborative hunt watching** — join a live hunt session started by a teammate and watch the same progress stream together.
28066. **Mobile finding verification checklist** — step-by-step verify buttons (reproduced, screenshot taken, impact confirmed) for manual validation.
28067. **Quick reply templates for agent chat** — canned questions like "summarize findings so far" and "what's taking so long" as tappable chips.
28068. **Hunt priority flagging** — mark hunts as urgent so they sort first and get louder notification treatment.
28069. **Offline mode auto-detection banner** — clear banner when the app loses connection, listing exactly what still works offline.
28070. **Mobile audit log viewer** — browse who did what on each hunt (pauses, severity changes, comments) in a chronological feed.
28071. **Target screenshot thumbnails** — cached thumbnails of scanned pages next to findings for visual context.
28072. **Hunt resume from crash** — if the app is killed, reopening restores the exact hunt screen and scroll position.
28073. **Finding text-to-speech** — have the app read a finding's summary aloud for hands-free review while commuting.
28074. **Mobile hunt archiving** — archive old hunts out of the active list while keeping them searchable.
28075. **Custom finding tags** — create personal tags like "needs-poc" or "client-visible" and filter by them.
28076. **Hunt duration estimates** — ML-based ETA shown at hunt start, refined as the hunt progresses.
28077. **Battery-aware background sync** — background refresh of hunt status pauses when battery is critically low.
28078. **Mobile deep links for findings** — every finding has a shareable deep link that opens directly in the app for teammates.
28079. **Hunt starter templates from community** — browse and import hunt configurations shared by the community.
28080. **In-app hunt recording** — record the agent's screen-capture session as a video for demos or evidence.
28081. **Mobile proxy status indicator** — show whether hunt traffic is routing through the configured proxy or VPN.
28082. **Finding impact calculator** — interactive sliders estimating business impact that feed into the risk score.
28083. **Hunt pause on finding limit** — auto-pause when findings exceed a threshold to avoid notification floods on noisy targets.
28084. **Mobile onboarding demo target** — a safe built-in demo target so new users can run a real hunt without any setup.
28085. **App shortcuts for recent hunts** — long-press the app icon for quick actions: resume last hunt, start new hunt, view criticals.
28086. **Hunt notes voice memos** — record audio notes attached to hunts, transcribed automatically for search.
28087. **Mobile finding export to Jira** — push a finding to Jira as a ticket with fields pre-filled from the finding data.
28088. **Hunt coverage map** — visual map of crawled paths and endpoints showing which areas of the target were explored.
28089. **Dark-Matter mobile API key management** — generate and revoke personal API tokens for the mobile app from settings.
28090. **Finding reopen workflow** — reopen a resolved finding from mobile with a reason, notifying the assignee.
28091. **Mobile hunt guest view** — generate a time-limited read-only link so clients can watch a hunt without an account.
28092. **Hunt completion certificate** — downloadable completion summary with coverage stats for compliance records.
28093. **Mobile notification preview redaction** — hide finding details in lock-screen previews until the phone is unlocked.
28094. **Hunt queue position display** — when backend capacity is limited, show queue position and estimated start time.
28095. **Finding similarity suggestions** — "similar to 3 other findings" links that group related issues across hunts.
28096. **Mobile screen-time style weekly report** — weekly summary card of hunts run, findings found, and time saved.
28097. **Hunt abort with reason codes** — abort a runaway hunt with a reason code that feeds back into the learning engine.
28098. **Mobile language selector** — switch the app UI between English and the user's preferred language independently of the OS.
28099. **Finding bookmark with reminder** — bookmark a finding and set a reminder to revisit it after a chosen interval.
28100. **Slideshow hunt event replay** — step through a completed hunt's key events like a slideshow for post-mortems.
28101. **Mobile data export for compliance** — export all personal hunt data as a structured archive for GDPR-style requests.
28102. **Hunt collaboration presence** — see which teammates are currently viewing the same hunt with live cursors on shared notes.
28103. **Mobile quick-triage inbox** — a dedicated inbox of unreviewed findings sorted by severity for rapid morning triage.
28104. **Hunt start confirmation summary** — before launching, show scope, estimated duration, and cost for one-tap confirmation.
28105. **Critical-finding push with severity colors** — critical alerts arrive with a red banner and distinct sound while lows are silent, making triage instant from the lock screen.
28106. **Hunt-complete summary push** — when a hunt finishes, a rich notification shows finding counts by severity and a tap opens the full report.
28107. **Daily digest notification** — one morning push summarizing overnight hunts, new criticals, and resolved items instead of scattered alerts.
28108. **Custom rule: notify only for RCE** — user-defined rules like "only ping me for RCE or auth bypass" to cut noise on noisy targets.
28109. **Quiet hours scheduler** — set do-not-disturb windows where only critical-severity alerts break through, synced with OS focus modes.
28110. **Lock-screen acknowledge action** — acknowledge a finding directly from the notification without unlocking the phone.
28111. **Lock-screen false-positive action** — mark a finding as false positive from the notification with a follow-up reason prompt.
28112. **Hunt milestone pushes** — notify at phase transitions (recon done, probing started) so users feel progress on long hunts.
28113. **Stalled-hunt alert** — push when a hunt makes no progress for 15 minutes, with pause and restart actions attached.
28114. **Finding SLA breach warning** — push 24 hours before a critical finding's remediation SLA expires.
28115. **New critical while hunting** — interrupt-style alert when a critical lands mid-hunt, distinct from routine updates.
28116. **Retest-complete notification** — when a scheduled retest finishes, push a fixed-versus-still-open comparison summary.
28117. **Team mention pushes** — notify when a teammate assigns you a finding or mentions you in a comment thread.
28118. **Finding-discussion push replies** — push when someone replies to your comment on a finding so discussions stay live.
28119. **Hunt error push with diagnostics** — if a hunt crashes, push includes the error class and one-tap "retry" and "view logs" actions.
28120. **Brain disconnect alert** — push when the Kaggle brain link drops, with a reconnect shortcut in the notification.
28121. **Weekly security posture push** — Sunday evening summary of the week's hunts, trends, and top risks for leadership.
28122. **Escalation chain notifications** — if a critical is unacknowledged for 30 minutes, escalate to the next person in the on-call chain.
28123. **Notification grouping by hunt** — all alerts from one hunt stack into a single expandable group instead of flooding the shade.
28124. **Severity-based vibration patterns** — distinct haptic rhythms per severity so users can feel the difference in a pocket.
28125. **Rich media finding previews** — notifications expand to show the evidence screenshot thumbnail inline.
28126. **Pause-hunt action from push** — long-press a hunt-progress notification to pause or abort without opening the app.
28127. **Resume-hunt action from push** — a paused hunt's notification offers one-tap resume when you're ready.
28128. **Snooze finding alerts** — snooze non-critical notifications for 1, 4, or 24 hours with automatic re-alert.
28129. **Notification priority per target** — mark production targets as high-priority so their alerts always break through quiet hours.
28130. **Repeated-finding notification collapse** — if the same finding class fires repeatedly, collapse into one notification with a count.
28131. **First-critical-of-day highlight** — the day's first critical gets a special full-screen-style alert to guarantee attention.
28132. **Hunt start confirmation push** — when a scheduled hunt begins, a quiet push confirms it's running with an option to watch live.
28133. **Coverage milestone pushes** — notify at 25%, 50%, and 75% of estimated hunt progress for long engagements.
28134. **Finding verified push** — when the agent confirms a finding with a working PoC, push the verified status upgrade.
28135. **False-positive auto-filtered notice** — daily count of findings the fpFilter suppressed, expandable for audit.
28136. **Chained-finding alert** — special push when chainBuilder links findings into an exploit chain, since chains matter more than singles.
28137. **Secret-leak instant alert** — leaked API keys or tokens trigger the highest-urgency push with immediate rotation guidance.
28138. **Subdomain takeover alert** — takeoverChecker hits push instantly because they are time-sensitive to claim.
28139. **JWT misconfiguration alert** — none-algorithm or missing-expiry JWT findings get their own alert category for auth-focused teams.
28140. **CORS misconfiguration digest** — wildcard CORS findings batched into a single digest rather than one push each.
28141. **Notification sound packs** — choose distinct sounds per severity from a built-in pack for audio triage.
28142. **Spoken notification option** — critical pushes can be read aloud via TTS when headphones are connected.
28143. **Car-mode notification summarization** — while driving, pushes are condensed into short spoken briefs via CarPlay or Android Auto.
28144. **Watch-mirrored critical alerts** — critical pushes mirror to the smartwatch with haptic escalation even if the phone is silent.
28145. **Notification action: assign to me** — claim a finding directly from the push with one tap.
28146. **Notification action: create Jira ticket** — turn a finding push into a Jira ticket without opening the app.
28147. **Scheduled digest times** — choose digest delivery at 8am, noon, and 6pm instead of a single daily slot.
28148. **Weekend digest suppression** — option to hold all non-critical pushes until Monday morning.
28149. **Vacation auto-responder routing** — when vacation mode is on, critical pushes route to your designated backup automatically.
28150. **Push analytics dashboard** — see how many pushes you got per category and tune rules from real data.
28151. **Smart quiet hours by calendar** — auto-enable quiet hours during calendar events marked as meetings.
28152. **Location-based notification rules** — stricter alerting at the office, digests only at home.
28153. **Notification history search** — search past pushes by target, severity, or keyword inside the app.
28154. **Critical alert bypass for DND** — OS-level critical alert entitlement so true criticals sound even in Do Not Disturb.
28155. **Hunt phase-change chimes** — short distinct tones when a hunt moves phases, keeping ambient awareness without looking.
28156. **Finding count threshold alerts** — push when open criticals cross a user-set threshold like "more than 5".
28157. **Target newly-exposed alert** — when recon discovers a new subdomain or exposed service, push it as its own alert class.
28158. **PoC-ready notification** — push when pocGenerator finishes a working proof-of-concept for a finding you starred.
28159. **Report-ready push** — notify the moment the PDF report is generated with a direct download action.
28160. **Learning-engine insight push** — weekly push with what the learning engine learned, like "this target class keeps yielding IDORs".
28161. **Peer benchmark notification** — opt-in push comparing your mean-time-to-triage against anonymized team stats.
28162. **Notification fatigue guard** — if you dismiss 10 pushes without acting, the app suggests tightening your rules.
28163. **Critical alert confirmation loop** — critical pushes repeat every 10 minutes until acknowledged, with escalating haptics.
28164. **Acknowledgment sync across devices** — acknowledging on the watch instantly clears the phone and desktop notifications.
28165. **Push with one-tap retest** — a "fixed?" finding's push offers a one-tap retest action to verify the remediation.
28166. **Hunt aborted push** — when any device or teammate aborts a hunt, everyone watching gets an immediate push with the reason.
28167. **New team member hunt invite push** — when added to a hunt, get a push with the hunt summary and a join button.
28168. **Compliance deadline pushes** — reminders for report delivery deadlines tied to client engagements.
28169. **Dark-Matter tip-of-day push** — optional daily micro-tip about a feature or technique to build product mastery.
28170. **Battery-friendly push batching** — non-urgent pushes batch every 30 minutes to save radio wake-ups on Android.
28171. **Notification channels per severity (Android)** — separate Android notification channels so users control sound and vibration per severity in OS settings.
28172. **iOS Live Activity for active hunts** — lock-screen live activity showing real-time hunt progress, phase, and finding count.
28173. **Live Activity finding ticker** — the live activity flips to show the latest finding title as they land.
28174. **Notification deep-link routing** — every push deep-links to the exact finding, hunt phase, or chat message it references.
28175. **Smart reply to agent from push** — reply to the hunting agent's question directly from the notification shade.
28176. **Push opt-in per hunt** — choose notification verbosity per hunt: all events, findings only, or silent.
28177. **Client-facing status pushes** — optional sanitized pushes for client stakeholders showing progress without technical detail.
28178. **Hunt ETA update pushes** — when the estimated completion time shifts significantly, push the revised ETA.
28179. **Finding downgrade notice** — if a finding's severity is lowered after review, notify watchers so urgency matches reality.
28180. **Bulk-acknowledge from digest** — the daily digest lets you acknowledge all lows in one tap.
28181. **Push for avatar-spoken summaries** — when the avatar finishes narrating a hunt summary, push the transcript.
28182. **Offline queued push replay** — pushes that arrived while offline replay in chronological order when reconnecting, marked as delayed.
28183. **Notification content redaction levels** — choose redaction: full detail, titles only, or "new finding" with no specifics for shoulder-surfing safety.
28184. **Emergency broadcast from team lead** — team leads can send a high-priority broadcast push to all members watching a hunt.
28185. **Hunt handoff push** — when you hand a hunt to a teammate, they get a push with context and open items.
28186. **Shift-change digest** — at shift handoff time, push a summary of active hunts and unacknowledged criticals to the incoming person.
28187. **Finding comment digest** — batch comment notifications into an hourly digest instead of one push per reply.
28188. **Retest reminder pushes** — remind assignees when a finding marked "fix in progress" hasn't been retested in 7 days.
28189. **Stale-hunt cleanup nudge** — push suggesting archival for hunts idle over 30 days.
28190. **Model download complete push** — when a background model download finishes on desktop, push to the phone.
28191. **Kaggle brain expiry warning** — push before a Kaggle Gradio session is likely to expire so hunts don't die silently.
28192. **Desktop bridge offline alert** — push when the Python desktop bridge disconnects during a Control-mode task.
28193. **Voice-note transcription push** — when an attached voice memo finishes transcribing, push the text.
28194. **Shared report view push** — notify when a client opens a shared report link so you know it landed.
28195. **Finding exported confirmation** — quiet push confirming a Jira ticket or CSV export completed successfully.
28196. **Hunt template update notice** — push when a hunt template you use gets updated by its author.
28197. **Security advisory push** — push when Dark-Matter's intel feed flags a new CVE relevant to your scanned tech stacks.
28198. **Opt-in product changelog pushes** — notify about new mobile features with a "try it" deep link.
28199. **Do-not-disturb override test** — a test button that fires a sample critical alert so users verify bypass settings work.
28200. **Notification rule templates** — one-tap presets like "SOC analyst", "Manager", and "On-call" that configure sensible rule sets.
28201. **Per-finding mute** — mute all future pushes about one specific finding while keeping others flowing.
28202. **Noisy-target quick mute on mobile** — mute a noisy target for 24 hours, auto-unmuting after.
28203. **Push to desktop handoff** — send a push's finding to your desktop client with one tap for big-screen analysis.
28204. **Critical push screenshot attachment** — critical pushes include the evidence screenshot as a notification attachment.
28205. **Apple Watch complication: active hunt count** — watch face complication showing how many hunts are currently running.
28206. **Critical alert haptics on watch** — a distinctive SOS-style vibration pattern for critical findings that you can't miss.
28207. **watchOS quick-triage approve/reject** — approve or reject a finding from the watch with two buttons, syncing instantly.
28208. **Wear OS tiles for hunt status** — swipeable tiles showing hunt progress, open criticals, and last finding.
28209. **Watch hunt progress ring** — a complication ring filling as the active hunt progresses through its phases.
28210. **Watch finding detail glance** — tap a notification to see finding title, severity, endpoint, and one-line impact on the watch.
28211. **Voice reply to agent from watch** — dictate a question to the hunting agent via Siri or watch mic and hear the spoken answer.
28212. **Watch pause/resume hunt** — pause or resume the active hunt from the watch during meetings without touching the phone.
28213. **Watch complication: open criticals** — red numeric complication counting unacknowledged critical findings.
28214. **Severity color on watch alerts** — alert backgrounds tinted by severity so color alone communicates urgency.
28215. **Watch acknowledgment with haptic confirm** — acknowledging a finding triggers a confirming tap so you know it registered.
28216. **Standalone watchOS app** — core triage works over LTE without the phone nearby for on-call analysts.
28217. **Watch hunt start via voice** — "start a hunt on example.com" from the watch kicks off a backend hunt.
28218. **Complication: hunt ETA** — shows estimated minutes remaining for the longest-running hunt.
28219. **Watch daily digest card** — morning digest rendered as a watch card with key numbers and top finding.
28220. **Triage queue on watch** — swipe through unreviewed findings one by one, acknowledging or escalating each.
28221. **Watch escalation button** — one-tap escalate to the on-call chain when a critical needs human eyes now.
28222. **Watch finding assignment** — assign the current finding to yourself or a teammate from a short list.
28223. **Haptic-only mode** — criticals announced by vibration pattern alone with no screen wake for discreet environments.
28224. **Watch battery-aware sync** — reduces background sync frequency when the watch battery drops below 20 percent.
28225. **Complication: findings today** — count of new findings discovered today across all hunts.
28226. **Watch hunt abort** — emergency abort of all hunts from the watch with a confirm-by-crown-press gesture.
28227. **Siri shortcut: hunt status** — "Hey Siri, Dark-Matter status" reads the active hunt summary aloud.
28228. **Siri shortcut: latest critical** — asks Siri for the latest critical finding's summary.
28229. **Google Assistant routine: morning briefing** — a routine that reads the overnight hunt digest through the watch speaker.
28230. **Watch note dictation on findings** — dictate a note onto a finding that syncs to the mobile and desktop apps.
28231. **Complication: agent activity pulse** — animated dot pulsing while the agent is actively probing, still when idle.
28232. **Watch retest trigger** — trigger a retest of a fixed finding from the watch after a deploy.
28233. **Family-setup watch support** — a kid-safe paired watch shows only hunt counts, never finding details.
28234. **Watch workout-style hunt sessions** — start a "hunt watch" session that keeps the screen alive during active monitoring like a workout.
28235. **Double-tap gesture triage (watchOS)** — double-tap to acknowledge the current finding without looking at the screen.
28236. **Watch smart stack integration** — hunt status cards appear in the Apple Watch Smart Stack at relevant times.
28237. **Wear OS complication slots** — small and large complication formats for different watch faces.
28238. **Watch finding severity filter** — choose to only receive critical and high alerts on the watch.
28239. **Watch quiet hours override list** — per-contact-style override so only escalation alerts break watch silent mode.
28240. **Hunt phase announcements** — optional spoken phase changes through the watch speaker during long hunts.
28241. **Watch glanceable PoC status** — icon showing whether a finding has a verified PoC, pending, or none.
28242. **Team presence on watch** — see which teammates are online and watching the same hunt.
28243. **Watch quick-reply templates** — canned replies to agent questions like "continue" or "skip this target".
28244. **Fallback to phone for detail** — "view on phone" handoff button pushes the full finding to the paired phone.
28245. **Watch hunt history mini-list** — last five hunts with status dots, tappable for basic detail.
28246. **Complication: SLA risk count** — number of findings approaching SLA breach, in amber.
28247. **Watch calendar-aware muting** — auto-mute non-critical watch alerts during workouts or sleep focus.
28248. **Watch battery complication** — combined complication showing watch battery plus hunt status for field analysts.
28249. **Voice-controlled severity change** — "mark this as high severity" updates the finding by voice.
28250. **Watch finding search by voice** — "find the SQL injection on example.com" pulls up the matching finding.
28251. **Haptic countdown to hunt end** — gentle taps as a hunt nears its ETA for ambient awareness.
28252. **Watch screenshot view** — evidence screenshots render on the watch with pinch zoom for quick visual checks.
28253. **Complication: recon discoveries** — count of new subdomains or endpoints found in the current hunt.
28254. **Watch low-power hunt summary** — in low-power mode the watch shows a static text summary updated every 15 minutes.
28255. **WatchOS live activity for hunts** — persistent live activity on the watch showing hunt phase and elapsed time.
28256. **Wear OS quick settings tile** — a quick-settings tile to pause or resume hunts from the phone's shade via the watch app.
28257. **Watch finding share to phone** — beam the current finding to the phone's full detail view with one tap.
28258. **Critical alert auto-open** — critical pushes auto-open the triage screen on the watch for fastest response.
28259. **Watch digest read-aloud** — the morning digest can be played as audio through watch speakers or paired earbuds.
28260. **Watch hunt template picker** — start a hunt from the watch choosing quick, deep, or API-focused templates.
28261. **Complication: verified PoCs today** — count of findings with verified proof-of-concepts generated today.
28262. **Watch team chat quick view** — read-only glance at the hunt's team comment thread from the wrist.
28263. **Emergency contact auto-notify** — if a critical goes unacknowledged for an hour, optionally notify a designated emergency contact.
28264. **Watch face hunt theme** — a Dark-Matter watch face with hunt stats integrated into the design.
28265. **Haptic severity scale** — one tap for low, two for medium, three for high, continuous for critical.
28266. **Watch DND sync with phone** — enabling Do Not Disturb on one device syncs alert rules to the other.
28267. **Watch offline triage queue** — triage decisions made without connectivity queue and sync when back online.
28268. **Complication: chained findings** — count of exploit chains discovered, highlighted because chains are high-value.
28269. **Watch finding timeline scrub** — digital crown scrolls through the hunt's event timeline.
28270. **Voice memo on hunt from watch** — record a quick voice note attached to the active hunt.
28271. **Watch hunt guest invite** — generate a guest view link from the watch to share with a client on a call.
28272. **Complication: brain status** — dot showing whether the Kaggle brain link is connected, amber when flaky.
28273. **Watch pause-all with reason** — pause every running hunt from the watch, picking a reason by voice.
28274. **Fitness-style hunt rings** — close daily rings for hunts run, findings triaged, and reports delivered as a gamified habit loop.
28275. **Watch achievement badges** — badges for milestones like "100 criticals triaged" to keep analysts engaged.
28276. **Complication: queue position** — when hunts are queued, show position on the watch face.
28277. **Watch handoff to desktop** — push the current finding to the desktop client for deep analysis later.
28278. **Smart reply suggestions** — watch suggests replies to agent questions based on hunt context.
28279. **Watch finding bookmark** — bookmark a finding from the wrist to review on a bigger screen later.
28280. **Complication: open assignments** — count of findings assigned to you awaiting action.
28281. **Watch SLA countdown** — nearest SLA deadline shown as a countdown complication in red when under 24 hours.
28282. **Theater-mode aware alerts** — in theater mode, criticals use haptics only with no screen wake.
28283. **Watch water-lock hunt guard** — during water lock, hunt controls lock to prevent accidental pauses while swimming.
28284. **Complication: learning insights** — badge when the learning engine has a new insight about your targets.
28285. **Watch quick poll for team** — start a one-question poll like "ship this report?" with teammate votes on their watches.
28286. **Voice-controlled hunt scheduling** — "schedule a deep hunt on example.com tonight at 2am" from the watch.
28287. **Watch notification bundling** — findings from one hunt bundle into a single stackable watch notification.
28288. **Complication: last finding time** — shows how long ago the most recent finding landed, e.g., "12m ago".
28289. **Watch export finding as PDF** — generate a one-page finding PDF on the watch and AirDrop it to the phone.
28290. **Fall-detection style escalation** — if a critical is unacknowledged and the watch detects no movement, escalate to backup.
28291. **Watch hunt completion celebration** — subtle haptic fanfare and summary card when a hunt completes cleanly.
28292. **Complication: retest due count** — number of findings awaiting retest after fixes.
28293. **Watch target health dots** — per-target status dots (green, amber, red) in a compact watch list.
28294. **Voice-driven finding search filters** — "show only criticals from today's hunt" filters the watch triage queue by voice.
28295. **WatchOS widget for lock screen (iPhone)** — lock-screen widgets showing hunt count and criticals on the paired iPhone.
28296. **Wear OS watch-face data source** — expose hunt stats as a system data source any Wear OS face can display.
28297. **Watch app onboarding** — 60-second wrist tutorial teaching triage gestures on first launch.
28298. **Complication: digest readiness** — indicator when the daily digest is ready to read.
28299. **Watch hunt duplication** — clone the last hunt's config from the watch for a quick re-run.
28300. **Cross-device triage continuity** — start triage on the watch, continue exactly where you left off on the phone.
28301. **Watch critical alert flashlight** — the watch flashlight strobes subtly for critical alerts in dark server rooms.
28302. **Complication: weekly hunt streak** — consecutive days with completed hunts, encouraging consistent scanning habits.
28303. **Watch meeting-mode auto-triage** — during calendar meetings, auto-acknowledge lows and queue criticals for after.
28304. **WatchOS accessibility: VoiceOver triage** — full VoiceOver support so visually impaired analysts can triage by voice and gesture.
28305. **macOS hunt status widget** — a desktop widget showing active hunts, current phase, and finding counts that updates live.
28306. **Windows hunt status widget** — the same live hunt overview as a Windows 11 widgets-board panel.
28307. **Finding-count badge widget** — a compact widget with red-amber-green badges for open findings by severity.
28308. **Mini progress bar widget** — a slim horizontal bar showing the active hunt's completion percentage on the desktop.
28309. **Quick-start hunt widget** — paste a URL into the widget and launch a hunt without opening the full app.
28310. **Widget hunt phase timeline** — tiny phase dots (recon, probe, exploit, report) lighting up as the hunt advances.
28311. **Critical ticker widget** — scrolling ticker of the latest critical finding titles across all hunts.
28312. **macOS Notification Center widget** — hunt summary in Notification Center with pause and resume buttons.
28313. **Windows widget: SLA countdown** — nearest remediation deadline counting down in a glanceable widget.
28314. **Widget: agent activity sparkline** — a tiny sparkline of agent actions per minute showing hunt liveliness.
28315. **Desktop widget themes** — match widget appearance to light, dark, or accent-color system themes.
28316. **Widget: today's stats** — hunts run, findings found, and PoCs verified today in one compact card.
28317. **Multi-hunt widget grid** — a larger widget showing up to four hunts side by side with individual progress.
28318. **Widget: brain connection status** — green or red dot for the Kaggle brain link with reconnect button.
28319. **Widget quick-triage buttons** — acknowledge or escalate the latest finding right from the widget.
28320. **macOS Sonoma desktop widget** — native desktop-placed widget that stays visible beside windows.
28321. **Widget: learning insight of the day** — rotates tips from the learning engine, like recurring weakness patterns.
28322. **Widget drag-to-resize layouts** — small, medium, and large widget sizes with progressively richer detail.
28323. **Windows widget: team presence** — avatars of teammates currently watching hunts.
28324. **Widget: queue position** — shows queued hunts and estimated start times when backend capacity is limited.
28325. **Widget finding severity donut** — a donut chart of open findings by severity, tappable to open the filtered list.
28326. **Widget: last hunt report link** — one-tap open of the most recent completed report PDF.
28327. **Linux Conky-style hunt overlay** — a lightweight text overlay for Linux desktops showing hunt stats for tinkerers.
28328. **Widget: hunt ETA countdown** — live countdown to estimated hunt completion.
28329. **Widget keyboard shortcut hint** — shows the global hotkey for starting a hunt as a discoverability aid.
28330. **Widget: offline status** — clearly indicates when the desktop client is offline and what is cached.
28331. **Widget clipboard hunt prompt** — when a URL is copied, the widget surfaces a "hunt this URL?" button.
28332. **Widget: weekly trend arrow** — up or down arrow comparing this week's findings to last week's.
28333. **Widget dark-mode adaptive art** — widget illustrations adapt between light and dark system appearance.
28334. **Widget: retest reminders** — lists findings awaiting retest with due dates in a compact checklist.
28335. **Widget: top vulnerable target** — highlights the target with the most open criticals as a priority callout.
28336. **Widget notification dot** — pulsing dot on the widget when a new critical arrives, clearing on view.
28337. **Widget: agent chat snippet** — shows the agent's latest status message like "probing login form now".
28338. **Widget: coverage percentage** — per-hunt crawl coverage shown as a percentage with a mini bar.
28339. **Widget multi-workspace switcher** — switch team workspaces from the widget without opening the app.
28340. **Widget: compliance deadline** — next report delivery deadline with days remaining.
28341. **Widget screenshot of the day** — rotates an interesting evidence screenshot as a conversation starter for teams.
28342. **Widget: model download progress** — shows local model download percentage when the Models page is fetching.
28343. **Widget: desktop bridge status** — indicates whether the Python computer-control bridge is connected.
28344. **Widget: Control-mode task status** — shows the active desktop-automation task and its current step.
28345. **Widget accessibility labels** — full screen-reader labels so widget content works with VoiceOver and Narrator.
28346. **Widget: hunt cost meter** — live API credit consumption for the active hunt.
28347. **Widget pin-to-always-on-top** — pin a mini widget above all windows during critical hunts.
28348. **Widget: false-positive stats** — count of findings auto-filtered today with a review link.
28349. **Widget: chain discoveries** — special highlight when an exploit chain is found, with chain visualization link.
28350. **Widget: secret-leak siren** — a distinct red flashing state when leaked secrets are detected.
28351. **Widget quick note** — jot a hunt note from the widget that syncs to the hunt's notes.
28352. **Widget: hunt templates** — start quick, deep, or API hunts from template buttons in the widget.
28353. **Widget: recent findings list** — the five most recent findings with severity dots, tappable for detail.
28354. **Widget transparency control** — adjustable opacity so the widget blends with the wallpaper.
28355. **Widget: phase elapsed timers** — shows time spent in each hunt phase so users spot where long hunts get stuck.
28356. **Widget: finding velocity gauge** — findings discovered per hour rendered as a speedometer-style gauge.
28357. **Widget: duplicate-merge log** — recent auto-merged duplicates listed with links to the surviving findings.
28358. **Widget: confidence histogram** — mini bar chart of agent confidence distribution across current findings.
28359. **Widget: endpoint coverage treemap** — tiny treemap visualizing which target paths were crawled and which were missed.
28360. **Widget: pause reason display** — when a hunt is paused, the widget shows who paused it and why.
28361. **Widget: last error snippet** — the most recent hunt error summarized in one line with a logs link.
28362. **Widget: proxy routing indicator** — icon showing whether hunt traffic flows direct, via proxy, or via VPN.
28363. **Widget: data usage this month** — mobile and desktop data consumed by the client with per-hunt breakdown.
28364. **Widget: hunt streak flame** — consecutive days with completed hunts shown as a streak flame for motivation.
28365. **Widget: top finding classes** — horizontal bars of the most common vulnerability classes in the active hunt.
28366. **Widget: fixed-this-week counter** — findings remediated and verified this week, celebrating defensive progress.
28367. **Widget: mean-time-to-triage gauge** — your average triage speed versus the team average in one dial.
28368. **Widget: hunt delta mini** — new, fixed, and unchanged finding counts versus the previous hunt on the same target.
28369. **Widget: target uptime monitor** — live up/down status dots for monitored targets from the last health check.
28370. **Widget: TLS certificate watch** — days until each target's certificate expires, red when under 14 days.
28371. **Widget: DNS change feed** — recent DNS record changes detected for monitored domains.
28372. **Widget: open-port delta** — newly opened or closed ports since the last scan, flagged for review.
28373. **Widget: JS library vuln matches** — outdated JavaScript libraries with known CVEs found during recon.
28374. **Widget: WAF detection badge** — badge showing whether the target sits behind a WAF and which one.
28375. **Widget: template usage stats** — how often each hunt template was used this month with success rates.
28376. **Widget: API credit forecast** — projected month-end spend based on current hunt burn rate.
28377. **Widget: team roster with roles** — who's online, their role, and what they're watching, in a compact roster.
28378. **Widget: shift handoff summary** — auto-generated handoff card with active hunts and unacknowledged criticals.
28379. **Widget: report delivery status** — sent, viewed, and signed-off states for shared client reports.
28380. **Widget: client feedback stars** — average client rating on delivered reports with recent comments.
28381. **Widget: hunt tag cloud** — most-used target and hunt tags sized by frequency, tappable to filter.
28382. **Widget: target infra minimap** — tiny geographic map of where the target's infrastructure is hosted.
28383. **Widget: intel mention count** — how many times your targets appeared in threat-intel feeds this week.
28384. **Widget: recon discovery feed** — live feed of newly discovered subdomains and endpoints during recon.
28385. **Widget: probe counter** — running count of HTTP probes sent in the active hunt with per-minute rate.
28386. **Widget: tech-stack chips** — detected technologies shown as chips, tappable for related findings.
28387. **Widget: PoC status icons** — per-finding icons showing verified, pending, or failed proof-of-concept state.
28388. **Widget: team leaderboard** — weekly triage stats per teammate to gamify security work.
28389. **Widget: incident timeline mini** — condensed timeline of today's key hunt events in the medium widget.
28390. **Widget: target risk score** — aggregate 0–100 risk score per target computed from open findings.
28391. **Widget: hunt notes preview** — latest hunt note excerpt with a quick-add field.
28392. **Widget: scheduled hunt countdown** — time until the next scheduled hunt begins.
28393. **Widget: evidence thumbnail strip** — horizontal strip of latest evidence screenshots, tappable to enlarge.
28394. **Widget: CVE watch matches** — count of scanned tech stacks matching newly published CVEs.
28395. **Widget: digest preview** — first lines of the daily digest with a "read full" link.
28396. **Widget: assignment inbox** — findings assigned to you, with due-time badges.
28397. **Widget: hunt duration timer** — live elapsed-time counter for the active hunt.
28398. **Widget: severity trend sparkline** — 7-day sparkline of new critical and high findings.
28399. **Widget: backend latency** — ping time to localhost and Vercel backends with color coding.
28400. **Widget: notification rule shortcut** — one-tap jump to notification settings from the widget.
28401. **Widget: avatar speaking indicator** — animated waveform when the avatar is narrating a summary.
28402. **Widget: guest link manager** — list active guest links with copy and revoke buttons.
28403. **Widget: hunt archive shortcut** — quick archive action for completed hunts from the widget menu.
28404. **Widget: uptime of backend** — shows local backend and Vercel backend health with latency.
28405. **Tray icon with hunt status color** — the menu-bar icon glows green, amber, or red based on the most severe open finding.
28406. **Right-click pause-all hunts** — tray context menu offers pause-all and resume-all for instant fleet control.
28407. **Finding toast notifications** — native OS toasts for new findings with severity icon and one-line summary.
28408. **Tray mini-dashboard** — clicking the icon opens a compact panel with active hunts, progress bars, and latest findings.
28409. **Animated tray icon during probing** — the icon subtly animates while the agent is actively sending probes, still when idle.
28410. **Tray quick-start hunt** — paste a URL into a tray text field to launch a hunt without opening the main window.
28411. **Tray finding ticker** — hovering the icon shows a tooltip with the latest finding title and severity.
28412. **Toast action: acknowledge** — acknowledge a finding directly from the Windows or macOS toast.
28413. **Toast action: open finding** — clicking a toast deep-links to the exact finding in the desktop app.
28414. **Tray hunt history submenu** — recent hunts listed in a submenu for one-click reopening.
28415. **Do-not-disturb toggle in tray** — one click silences all toasts for a chosen duration.
28416. **Tray backend switcher** — switch between localhost and Vercel backends from the tray menu.
28417. **Tray brain status indicator** — submenu shows Kaggle brain connection health with a reconnect option.
28418. **Tray desktop-bridge toggle** — start or stop the Python computer-control bridge from the tray.
28419. **Toast grouping by hunt** — toasts from the same hunt collapse into a single stacked notification.
28420. **Tray critical counter badge** — numeric overlay on the tray icon for unacknowledged criticals.
28421. **Tray menu: copy last finding link** — copies a shareable deep link to the most recent finding.
28422. **Tray emergency stop** — a red menu item halting all hunts and Control tasks immediately.
28423. **Toast sound per severity** — distinct system sounds for critical, high, and medium findings.
28424. **Tray scheduled-hunt list** — view and cancel upcoming scheduled hunts from the menu.
28425. **Tray: open latest report** — menu item opening the most recently generated PDF report.
28426. **Tray network activity sparkline** — mini graph in the dashboard showing requests per second.
28427. **Tray: mute target** — mute notifications for a noisy target for 24 hours from the toast's context menu.
28428. **Linux system tray support** — AppIndicator-compatible tray for GNOME, KDE, and other Linux desktops.
28429. **Tray: switch workspace** — change team workspaces without opening the full window.
28430. **Toast: PoC verified** — special toast when a proof-of-concept is confirmed working.
28431. **Toast: exploit chain found** — distinct toast style when findings link into an exploit chain.
28432. **Tray: hunt ETA** — menu header shows estimated completion of the longest hunt.
28433. **Tray: agent chat quick-reply** — answer the agent's yes/no questions from a toast without opening the app.
28434. **Tray icon monochrome mode** — respect OS monochrome tray conventions on macOS while keeping a status dot.
28435. **Tray: start Control task** — launch a desktop-automation task from the tray with a typed instruction.
28436. **Toast: secret leaked** — highest-urgency toast style with red border for leaked credentials.
28437. **Tray: download reports** — queue report downloads from the tray menu for offline reading.
28438. **Tray update notifier** — dot on the icon when a new desktop client version is available.
28439. **Tray: open logs folder** — one click opens the hunt log directory for debugging.
28440. **Toast persistence setting** — choose whether toasts auto-dismiss or stay until acknowledged.
28441. **Tray: keyboard shortcut list** — submenu showing all global hotkeys as a quick reference.
28442. **Tray focus-mode integration** — auto-silence toasts when the OS enters focus or presentation mode.
28443. **Tray: pause on battery** — option to auto-pause hunts when the laptop switches to battery below 20 percent.
28444. **Toast: retest complete** — toast comparing fixed versus still-open findings after a retest.
28445. **Tray: export diagnostics** — bundle logs and config into a support archive from the tray.
28446. **Tray multi-monitor toast placement** — choose which display shows toasts on multi-monitor setups.
28447. **Tray: hunt templates** — start quick, deep, or API hunts from template submenu items.
28448. **Toast click behavior setting** — configure whether clicking a toast opens the finding, the hunt, or just dismisses.
28449. **Tray: learning insight** — weekly submenu item surfacing what the learning engine discovered.
28450. **Tray icon left-click action setting** — choose whether left-click opens the mini-dashboard, the main app, or the latest finding.
28451. **Toast: weekly digest ready** — toast when the weekly security summary is ready to read.
28452. **Tray: proxy status** — shows whether hunt traffic routes through the configured proxy.
28453. **Tray: clipboard hunt suggestion** — when a URL is copied, the tray icon bounces gently with a hunt prompt.
28454. **Toast: teammate mention** — distinct toast when a teammate mentions you in a finding comment.
28455. **Tray: SLA countdown header** — menu header shows the nearest SLA deadline in red when under 24 hours.
28456. **Toast: hunt stalled** — warning toast when a hunt makes no progress, with pause and restart actions.
28457. **Tray: guest link generator** — create a read-only guest hunt link from the tray for quick client sharing.
28458. **Toast: model download done** — toast when a background model download completes.
28459. **Tray: screen-lock pause** — auto-pause hunts when the workstation locks, resume on unlock (configurable).
28460. **Toast action: assign to me** — claim a finding from the toast with one click.
28461. **Toast action: create Jira ticket** — file a Jira ticket from the toast without opening the app.
28462. **Tray: recent evidence** — submenu with the latest evidence screenshots for quick viewing.
28463. **Toast: digest mode** — batch non-critical toasts into an hourly summary toast.
28464. **Tray: hunt priority boost** — raise a hunt's priority from the tray to allocate more backend resources.
28465. **Toast: brain reconnected** — confirmation toast when the Kaggle brain link recovers.
28466. **Tray: offline queue count** — badge showing actions queued while offline, syncing on reconnect.
28467. **Toast: report shared** — confirmation when a shared report link is opened by the recipient.
28468. **Tray: dark-mode aware icon** — icon assets swap automatically with OS light/dark appearance.
28469. **Toast: new subdomain discovered** — toast when recon finds a previously unknown subdomain.
28470. **Tray: hunt notes quick-add** — jot a note onto the active hunt from the tray menu.
28471. **Toast: false-positive filtered** — quiet toast summarizing how many findings were auto-filtered today.
28472. **Tray: open at login toggle** — enable or disable launch-at-login from the tray menu.
28473. **Toast: Control task finished** — toast when a desktop-automation task completes with its result summary.
28474. **Tray: voice briefing** — play a spoken summary of the active hunt through the desktop speakers.
28475. **Toast: CVE match** — toast when a scanned tech stack matches a newly published CVE.
28476. **Tray: bandwidth saver** — toggle low-bandwidth mode that reduces evidence image streaming.
28477. **Toast action: snooze finding** — snooze alerts for one finding for 1, 4, or 24 hours from the toast.
28478. **Tray: duplicate hunt config** — clone the selected hunt's configuration for re-running.
28479. **Toast: team member joined** — toast when a teammate starts watching the same hunt.
28480. **Tray: hunt comparison** — pick two hunts from submenus to open a side-by-side diff.
28481. **Toast: coverage milestone** — toast at 50% and 100% crawl coverage for long hunts.
28482. **Tray: open evidence folder** — jump straight to the hunt's evidence directory on disk.
28483. **Toast: avatar summary ready** — toast with a play button for the avatar's spoken hunt summary.
28484. **Tray: reset onboarding** — replay the first-run tutorial from the tray for new team members on shared machines.
28485. **Toast: weekly streak** — celebrate consecutive days of completed hunts with a motivational toast.
28486. **Tray: check for updates** — manual update check with changelog preview in the menu.
28487. **Toast: compliance deadline near** — toast 48 hours before a client report deadline.
28488. **Tray: sign out** — quick sign-out with an option to clear cached hunt data.
28489. **Toast redaction setting** — choose whether toasts show finding titles or generic "new finding" text.
28490. **Tray: hunt cost today** — submenu showing API credit spend per hunt today.
28491. **Toast: retest reminder** — toast when a fix-marked finding hasn't been retested in 7 days.
28492. **Tray: open community templates** — browse shared hunt templates from the tray.
28493. **Toast: escalation** — distinct urgent toast when a finding is escalated to you.
28494. **Tray: accessibility shortcut** — toggle high-contrast toasts and larger text from the tray.
28495. **Toast: shift handoff** — at shift change, a toast summarizes active hunts for the incoming analyst.
28496. **Tray: export hunt CSV** — export the selected hunt's findings to CSV from the menu.
28497. **Toast: duplicate suppressed** — quiet note when repeat findings are collapsed into one alert.
28498. **Tray: notification rules** — jump straight to notification rule settings from the tray.
28499. **Toast: hunt aborted by teammate** — immediate toast with reason when someone aborts a shared hunt.
28500. **Tray: about and diagnostics** — version, backend latency, and connection details in one submenu.
28501. **Toast: guest viewed report** — toast when a client opens your shared report link.
28502. **Tray: pin mini-dashboard** — keep the mini-dashboard always on top during critical hunts.
28503. **Toast: learning milestone** — toast when the learning engine crosses 100 recorded hunt outcomes.
28504. **Tray: quit with hunt handoff** — quitting offers to hand running hunts to the backend so they continue unattended.
28505. **Downloaded reports readable fully offline** — PDFs and markdown reports open with cached styling and images, no connection needed.
28506. **Offline finding annotation** — highlight and comment on findings offline, with annotations syncing when connectivity returns.
28507. **Offline hunt queue** — queue hunt requests offline that auto-start when the device reconnects.
28508. **Offline report library** — a dedicated library tab listing every downloaded report with size and download date.
28509. **Selective report download** — choose to download just the summary, full report, or report plus evidence to save space.
28510. **Offline finding search** — full-text search across downloaded reports and findings without a network.
28511. **Annotation conflict resolution** — if a finding changed while you annotated offline, show a side-by-side merge view.
28512. **Offline triage decisions** — acknowledge, escalate, or mark false positives offline, queued as sync actions.
28513. **Smart download on Wi-Fi** — auto-download new reports only on Wi-Fi to protect mobile data.
28514. **Report expiry for downloads** — auto-delete downloads older than 30 days unless starred, keeping storage lean.
28515. **Offline evidence viewer** — cached screenshots and PoC artifacts viewable offline with pinch zoom.
28516. **Offline hunt status snapshot** — last-known hunt state cached so you can review progress without connectivity.
28517. **Annotation sync indicator** — per-annotation badges showing synced, pending, or conflicted states.
28518. **Offline chat drafts** — draft questions for the hunting agent offline, sent automatically on reconnect.
28519. **Download report as ZIP** — bundle report, evidence, and raw logs into one offline ZIP archive.
28520. **Offline severity reassignment** — change severities offline with required reason notes, synced later.
28521. **Reading progress sync** — report reading position syncs across devices when back online.
28522. **Offline finding comparison** — compare two downloaded reports' findings side by side without a network.
28523. **Airplane-mode hunt briefing** — a pre-generated text briefing cached before flights for offline reading.
28524. **Offline template access** — hunt templates cached locally so hunts can be queued from templates offline.
28525. **Storage usage dashboard** — see how much space reports, evidence, and caches use, with one-tap cleanup.
28526. **Offline export to PDF** — generate a PDF from cached finding data entirely on-device.
28527. **Priority download queue** — star reports to download first when bandwidth is limited.
28528. **Offline Jira draft tickets** — draft Jira tickets from findings offline, created automatically on reconnect.
28529. **Delta sync for reports** — only changed sections re-download when a report updates, saving bandwidth.
28530. **Offline hunt notes** — markdown notes on hunts editable offline with full sync later.
28531. **Cached tech-stack fingerprints** — target technology profiles cached for offline reference during meetings.
28532. **Offline PoC step viewer** — proof-of-concept reproduction steps readable offline for field verification.
28533. **Download all criticals** — one tap downloads every report containing unacknowledged criticals.
28534. **Offline notification replay** — pushes received while offline replay in order with "delayed" markers.
28535. **Report password protection** — encrypt downloaded reports with a PIN so lost devices don't leak client data.
28536. **Offline finding assignment** — assign findings to teammates offline, delivered as actions on sync.
28537. **LAN sync between devices** — sync annotations directly between phone and laptop over local Wi-Fi without internet.
28538. **Offline glossary** — cached definitions of vulnerability classes and CWE entries for offline learning.
28539. **Pre-flight download checklist** — one screen to bulk-download everything needed before traveling.
28540. **Offline hunt duplication** — clone a cached hunt's config into the offline queue for later launch.
28541. **Report annotation export** — export your offline annotations as a standalone markdown file to share.
28542. **Offline SLA tracking** — SLA countdowns computed from cached timestamps, flagged as estimates until sync.
28543. **Cached agent transcripts** — mid-hunt chat histories cached for offline review of agent reasoning.
28544. **Offline finding bookmarking** — bookmarks work offline and sync across devices later.
28545. **Low-storage mode** — automatically keeps only report summaries, fetching evidence on demand.
28546. **Offline coverage maps** — cached crawl coverage visualizations viewable without connectivity.
28547. **Report diff offline** — diff a newly synced report against the cached version to see what changed.
28548. **Offline quick-triage inbox** — the triage queue works from cache, with decisions queued for sync.
28549. **Scheduled auto-download** — nightly auto-download of the day's reports when on Wi-Fi and charging.
28550. **Offline voice memos** — record hunt voice notes offline, transcribed and synced when online.
28551. **Cached CVE references** — CVE details referenced by findings cached for offline reading.
28552. **Offline team comments** — read cached comment threads and queue replies for later delivery.
28553. **Report integrity check** — verify downloaded reports against server hashes on reconnect to detect tampering.
28554. **Offline hunt abort** — abort commands queued offline execute the moment connectivity returns.
28555. **Offline finding filters** — severity, status, and tag filters all work against the local cache.
28556. **Download progress resume** — interrupted report downloads resume from the byte offset instead of restarting.
28557. **Offline hunt templates editor** — create and edit hunt templates offline, synced to the account later.
28558. **Cached dashboard widgets** — home-screen widgets show last-known data with a "stale" timestamp when offline.
28559. **Offline retarget suggestions** — cached "hunt deeper" suggestions from the last sync remain actionable offline.
28560. **Report sharing via nearby share** — send a downloaded report to a colleague's device over Bluetooth or Wi-Fi Direct.
28561. **Offline finding timeline** — the hunt event timeline renders from cached events with gap markers for missing data.
28562. **Annotation @mentions offline** — mention teammates in offline annotations, notified on sync.
28563. **Offline remediation checklists** — step-by-step fix guidance cached per finding for field work.
28564. **Smart cache eviction** — least-recently-viewed reports evicted first when storage runs low, never starred ones.
28565. **Offline hunt cost estimates** — estimated credit cost computed locally from cached hunt templates.
28566. **Report print from offline** — print downloaded reports directly to AirPrint or network printers without internet.
28567. **Offline deep links** — shared finding links open the cached version when offline, fresh when online.
28568. **Annotation version history** — every offline edit versioned so sync conflicts can be rolled back.
28569. **Offline guest report view** — guest links to downloaded reports open read-only without an account.
28570. **Cached learning insights** — the learning engine's tips cached for offline browsing.
28571. **Offline hunt pause reasons** — pause reasons picked offline attach to the audit log on sync.
28572. **Report table of contents** — tappable TOC in long offline reports for fast navigation.
28573. **Offline finding export CSV** — export cached findings to CSV entirely on-device.
28574. **Night-before briefing pack** — auto-generates a single offline pack with digest, criticals, and SLAs each evening.
28575. **Offline target profiles** — target metadata and history cached for reference during client calls.
28576. **Annotation drawing tools** — freehand drawing on cached screenshots with layers synced later.
28577. **Offline hunt health checks** — cached diagnostics explain what the hunt was doing when you lost connection.
28578. **Report language toggle offline** — switch cached reports between available languages without re-downloading.
28579. **Offline keyboard shortcuts** — full keyboard navigation of cached reports on tablets with keyboards.
28580. **Cached evidence chain view** — exploit chain visualizations render from cached finding relationships.
28581. **Offline finding merge review** — review auto-merged duplicates from cache with unmerge options queued.
28582. **Download report with redactions** — download a client-safe redacted version for sharing from the field.
28583. **Offline hunt watchdog** — when reconnecting, the app reconciles what the hunt did while you were away into a catch-up summary.
28584. **Annotation search offline** — search your own annotations across all cached reports.
28585. **Offline compliance checklist** — engagement checklists cached so field analysts track deliverables without signal.
28586. **Report signature capture** — collect client sign-off signatures on cached reports for delivery confirmation.
28587. **Offline finding severity trends** — severity distribution charts computed from cache for status meetings.
28588. **Cached API docs** — the Dark-Matter API reference cached for offline integration work.
28589. **Offline hunt screen recording** — record walkthroughs of cached reports with voiceover for async sharing.
28590. **Report watermarking offline** — apply "confidential" watermarks to cached PDFs before sharing.
28591. **Offline multi-report search** — one query searches across every downloaded report at once.
28592. **Annotation templates** — reusable annotation snippets like "verified on staging" for fast offline marking.
28593. **Offline hunt archive browser** — archived hunts browsable from cache with full findings.
28594. **Cached onboarding for offline** — the interactive tutorial works fully offline for new installs on planes.
28595. **Offline finding link copying** — copy deep links to cached findings to paste when back online.
28596. **Report compression options** — choose compact downloads that strip images for slow connections.
28597. **Offline audit log** — your own offline actions logged locally and merged into the audit trail on sync.
28598. **Cached team directory** — teammate list cached so offline assignments still resolve names.
28599. **Offline hunt start confirmation** — queued hunts show a pre-launch summary for review before they fire on reconnect.
28600. **Roaming data guard** — block all downloads and sync while roaming, with an explicit override.
28601. **Offline finding print styles** — printer-friendly stylesheets for clean hard copies of cached findings.
28602. **Report QR sharing** — generate a QR code for a cached report to share with nearby devices.
28603. **Offline dark-room mode** — extra-dim true-black reading mode for reviewing reports in dark environments.
28604. **Sync-now button** — one tap forces full sync of all queued offline work with a progress indicator.
28605. **"Hey Dark-Matter, what did the hunt find?"** — wake-word voice query returning a spoken summary of the latest hunt's findings.
28606. **Spoken finding summaries** — ask for any finding by name and hear its severity, endpoint, and impact read aloud.
28607. **Voice-driven hunt pause and resume** — "pause the hunt" and "resume the hunt" work hands-free via the phone or desktop mic.
28608. **CarPlay hunt briefings** — CarPlay reads a two-minute hunt briefing with criticals first when you start driving.
28609. **Android Auto hunt briefings** — the same spoken briefing experience through Android Auto with voice follow-up questions.
28610. **Voice hunt start** — "start a deep hunt on example.com" launches a hunt with confirmation spoken back.
28611. **Spoken severity breakdown** — "give me the severity breakdown" reads counts of critical, high, medium, and low findings.
28612. **Voice triage: acknowledge** — "acknowledge the SQL injection finding" marks it reviewed by voice.
28613. **Voice triage: escalate** — "escalate this to Priya" routes the current finding to a teammate by voice.
28614. **Voice note on finding** — dictate a note that attaches to the current finding with automatic transcription.
28615. **Spoken hunt ETA** — "when will the hunt finish?" returns the current estimated completion time.
28616. **Voice agent chat** — full spoken conversation with the hunting agent, asking "what are you doing now?" mid-hunt.
28617. **Car-mode critical alerts** — while driving, only critical findings interrupt with a short spoken alert and severity.
28618. **Voice finding search** — "find cross-site scripting findings from yesterday" pulls up matches by voice.
28619. **Spoken PoC steps** — have the proof-of-concept reproduction steps read aloud for hands-free verification.
28620. **Voice retest trigger** — "retest the login findings" launches a retest of a finding group by voice.
28621. **Multilingual voice queries** — ask in Hindi or Hinglish and get answers in the same language, matching the user's register.
28622. **Voice daily digest** — "read my morning digest" plays the full overnight summary aloud.
28623. **Voice weekly report** — "read the weekly report" narrates trends, top risks, and completed hunts.
28624. **Spoken SLA warnings** — "any SLAs at risk?" lists findings nearing breach with time remaining.
28625. **Voice hunt scheduling** — "schedule a hunt on example.com tonight at 2am" creates the schedule by voice.
28626. **Voice workspace switching** — "switch to Team Infinity workspace" changes context hands-free.
28627. **Spoken learning insights** — "what did the AI learn this week?" narrates learning-engine takeaways.
28628. **Voice-controlled avatar briefing** — the speaking avatar delivers the hunt summary with lip-sync on screen while narrating.
28629. **CarPlay: next/previous finding** — steering-wheel or dashboard controls step through findings while driving.
28630. **Android Auto: finding actions** — voice actions to acknowledge or escalate without touching the screen.
28631. **Voice quiet hours** — "enable quiet hours until 9am" silences non-critical alerts by voice.
28632. **Spoken hunt comparison** — "what's new since the last hunt on example.com?" reads the diff summary.
28633. **Voice evidence description** — the app describes evidence screenshots aloud using vision captioning for accessibility.
28634. **Voice-controlled report generation** — "generate the PDF report for this hunt" builds and announces the download link.
28635. **Spoken chain explanation** — exploit chains explained in plain spoken language, linking each step's role.
28636. **Voice Jira ticket creation** — "create a Jira ticket for this finding" files it with pre-filled fields by voice.
28637. **CarPlay: hunt progress bar audio** — periodic soft chimes mark 25%, 50%, and 75% progress on long drives.
28638. **Voice biometric confirmation** — sensitive voice commands like aborting hunts require a spoken passphrase or biometric.
28639. **Spoken notification history** — "read my missed alerts" plays back notifications received while away.
28640. **Voice team presence check** — "who's watching this hunt?" lists online teammates aloud.
28641. **Voice hunt templates** — "start a quick hunt" versus "start a deep hunt" selects templates by voice.
28642. **Spoken cost report** — "how much did today's hunts cost?" reads API credit consumption.
28643. **Voice finding bookmark** — "bookmark this finding" saves it to the review-later list.
28644. **CarPlay: hands-free escalation** — escalate a critical to the on-call chain entirely by voice while driving.
28645. **Voice-driven guest link** — "create a guest link for this hunt" generates and reads out the share link.
28646. **Spoken remediation guidance** — "how do I fix this?" reads the finding's remediation steps aloud.
28647. **Voice false-positive marking** — "mark this as a false positive" with a dictated reason updates the finding.
28648. **CarPlay: arrival summary** — when you arrive, a final spoken recap of anything that changed during the drive.
28649. **Voice-controlled widgets** — "show me the hunt widget" opens the desktop widget dashboard by voice.
28650. **Spoken brain status** — "is the brain connected?" reports Kaggle link health aloud.
28651. **Voice hunt abort** — "abort all hunts" with confirmation stops everything hands-free in emergencies.
28652. **Voice-driven retest verification** — "verify the fix for finding 12" runs a retest and speaks the result.
28653. **CarPlay: digest on ignition** — starting the car auto-plays the latest hunt digest if one is pending.
28654. **Voice assignment** — "assign this to Rahul with high priority" delegates by voice.
28655. **Spoken finding confidence** — "how sure is the AI?" reads the agent's confidence score and reasoning.
28656. **Voice-controlled report sharing** — "share this report with the client" generates a link and reads it aloud.
28657. **CarPlay: critical-only mode** — a driving mode where only criticals interrupt, everything else waits.
28658. **Voice hunt health check** — "is the hunt healthy?" reports errors, stalls, or smooth progress.
28659. **Spoken target list** — "list my targets" reads monitored targets with their status.
28660. **Voice-driven severity change** — "change severity to high" updates the current finding by voice.
28661. **CarPlay: repeat last finding** — "repeat that" replays the last spoken finding summary.
28662. **Voice note transcription review** — "read back my notes" plays your dictated hunt notes.
28663. **Spoken duplicate explanation** — "why was this marked duplicate?" explains the merge reasoning aloud.
28664. **Voice-controlled digest time** — "move my digest to 7am" reschedules by voice.
28665. **CarPlay: pause briefing** — "pause the briefing" and "continue" control playback hands-free.
28666. **Voice hunt duplication** — "run this hunt again" clones and launches the last hunt by voice.
28667. **Spoken coverage report** — "how much of the target was covered?" reads the coverage percentage.
28668. **Voice-driven export** — "export findings to CSV" creates the file and announces where it saved.
28669. **CarPlay: meeting-aware muting** — briefings auto-pause when a call comes in and resume after.
28670. **Voice learning feedback** — "that was a false positive, remember that" teaches the engine by voice.
28671. **Spoken shift handoff** — "give me the shift handoff" reads active hunts and unacknowledged criticals.
28672. **Voice-controlled timer** — "remind me about this finding in one hour" sets a spoken reminder.
28673. **CarPlay: speed-sensitive detail** — at highway speed, briefings shorten to headlines only for safety.
28674. **Voice-driven comment reply** — dictate a reply to a teammate's finding comment by voice.
28675. **Spoken chain risk** — "how bad is this exploit chain?" explains combined impact in plain words.
28676. **Voice hunt priority** — "make this hunt urgent" boosts its priority by voice.
28677. **CarPlay: weather-style hunt card** — the CarPlay dashboard shows a persistent hunt card like a weather widget.
28678. **Voice-controlled redaction** — "redact client names from this report" prepares a share-safe version by voice.
28679. **Spoken model status** — "is the model download finished?" reports download progress aloud.
28680. **Voice-driven Control task** — "open the calculator and take a screenshot" starts a desktop-automation task by voice.
28681. **CarPlay: end-of-drive report** — on engine stop, a spoken summary of what changed during the drive.
28682. **Voice hunt archive** — "archive hunts older than a month" tidies history by voice.
28683. **Spoken team leaderboard** — "who triaged the most this week?" reads gamified stats aloud.
28684. **Voice-driven template creation** — "save this hunt as a template called API deep scan" by voice.
28685. **CarPlay: emergency stop** — "emergency stop all hunts" works from CarPlay with voice confirmation.
28686. **Voice-controlled language switch** — "switch to Hindi" changes the spoken response language instantly.
28687. **Spoken evidence count** — "how much evidence is there?" reports screenshots and artifacts per finding.
28688. **Voice-driven screenshot review** — "describe the latest screenshot" uses vision to narrate what it shows.
28689. **CarPlay: passenger mode** — show full finding details on screen when a passenger is present and the car is parked.
28690. **Voice hunt notes summary** — "summarize my notes on this hunt" reads back your annotations.
28691. **Spoken compliance status** — "are we on track for the client deadline?" reports engagement progress.
28692. **Voice-driven mute target** — "mute example.com for a day" silences a noisy target by voice.
28693. **CarPlay: voice feedback** — "that briefing was too long" tunes future briefing length.
28694. **Voice-controlled watch handoff** — "send this to my watch" pushes the current finding to the smartwatch.
28695. **Spoken onboarding tour** — new users get a voice-guided tour of the app on first launch.
28696. **Voice-driven finding comparison** — "compare these two findings" reads a spoken diff.
28697. **CarPlay: offline briefing cache** — briefings pre-download so they play even in dead zones.
28698. **Voice-controlled notification rules** — "only notify me about criticals" updates rules by voice.
28699. **Spoken API credit balance** — "what's my credit balance?" reads remaining quota.
28700. **Voice-driven sign-out** — "sign me out" with confirmation for shared devices.
28701. **CarPlay: hunt start chime** — a distinct chime when a scheduled hunt begins mid-drive.
28702. **Voice-controlled reading speed** — "speak faster" or "speak slower" adjusts TTS rate on the fly.
28703. **Spoken weekly streak** — "how's my streak?" reports consecutive hunting days.
28704. **Voice assistant personality setting** — choose concise analyst mode or explanatory mentor mode for spoken answers.
28705. **iPad split-view: hunt plus findings** — run the live hunt timeline on one side and the findings list on the other simultaneously.
28706. **Apple Pencil annotation on reports** — handwrite notes, circle vulnerabilities, and sketch attack paths directly on report pages.
28707. **Drag-drop evidence organization** — drag screenshots into finding folders to build custom evidence collections.
28708. **Tablet three-pane layout** — hunts list, finding detail, and evidence viewer in three adaptive columns on large tablets.
28709. **Pencil pressure-sensitive markup** — varied stroke weight for emphasis when annotating screenshots.
28710. **Tablet kanban triage board** — drag findings between New, Reviewing, Verified, and Resolved columns with touch.
28711. **Slide-over agent chat** — the hunting agent chat floats as a slide-over panel while you review findings.
28712. **Tablet picture-in-picture hunt monitor** — a floating mini window keeps hunt progress visible while using other apps.
28713. **Drag URL from Safari to start hunt** — drag a link from the browser onto the app to instantly queue a hunt.
28714. **Pencil handwriting-to-text notes** — handwritten notes convert to searchable text attached to findings.
28715. **Tablet multi-window hunts** — open two hunts in separate windows side by side for comparison on iPadOS.
28716. **External display support** — full-screen hunt dashboard on an external monitor while triaging on the tablet.
28717. **Tablet keyboard shortcuts** — full keyboard shortcut map for power users with attached keyboards.
28718. **Drag findings to calendar** — drag a finding onto the calendar to schedule a retest or review reminder.
28719. **Pencil signature on reports** — sign off completed reports with a handwritten signature captured by Pencil.
28720. **Tablet evidence lightbox** — full-screen swipeable gallery of all evidence with metadata overlays.
28721. **Split keyboard-friendly chat** — the agent chat adapts to floating keyboards without covering findings.
28722. **Tablet hunt timeline scrubbing** — drag across the hunt timeline with a finger to replay agent actions.
28723. **Drag-drop file attach to Infinity AI** — drop files from Files app into Build mode for the coding agent.
28724. **Tablet stage manager layouts** — saved window arrangements for triage, reporting, and monitoring workflows.
28725. **Pencil shape recognition** — drawn circles and arrows snap to clean shapes on annotations.
28726. **Tablet reference mode colors** — accurate color rendering for reviewing evidence screenshots on iPad Pro.
28727. **Hover preview with Pencil** — hovering the Pencil over a finding shows a preview card without tapping.
28728. **Tablet two-finger finding compare** — select two findings with two fingers to open an instant diff.
28729. **Drag evidence to notes** — drop screenshots into hunt notes where they're embedded inline.
28730. **Tablet cursor support** — trackpad and mouse get hover states, right-click menus, and precise selection.
28731. **Pencil double-tap tool switch** — double-tap the Pencil to switch between pen, highlighter, and eraser.
28732. **Tablet offline-first design** — the tablet app caches aggressively since tablets often travel without signal.
28733. **Center-window finding quick view** — long-press a finding to peek at details in a centered floating card.
28734. **Tablet drag-to-share** — drag a finding to Mail, Messages, or Files to share it instantly.
28735. **Pencil markup sync** — handwritten annotations sync as vector layers editable on desktop later.
28736. **Tablet focus filters** — Focus modes filter the hunt list to work-only or personal targets.
28737. **Large-text dynamic type** — the tablet UI respects system text scaling for accessibility.
28738. **Tablet guided triage mode** — a step-by-step full-screen flow walking through each unreviewed finding.
28739. **Drag columns to customize** — rearrange finding list columns by dragging headers on wide tablets.
28740. **Tablet split-screen with docs** — run Dark-Matter beside a remediation runbook in split view.
28741. **Pencil lasso select evidence** — lasso part of a screenshot to crop and attach as focused evidence.
28742. **Tablet haptic touch feedback** — subtle haptics on drag-drop and triage gestures for confirmation.
28743. **External keyboard hunt control** — spacebar pauses, arrow keys navigate findings, Enter opens detail.
28744. **Tablet presentation mode** — full-screen finding slideshow with large text for client walkthroughs.
28745. **Drag hunt to share** — drag a hunt card to another app to generate a guest link automatically.
28746. **Tablet battery widget** — home-screen widget showing hunt status optimized for tablet sizes.
28747. **Pencil color-coded severity** — annotate with severity-colored inks that map to finding tags.
28748. **Tablet landscape dashboard** — a dedicated landscape home showing hunts, criticals, and SLAs at a glance.
28749. **Multi-touch evidence compare** — pinch two screenshots side by side to compare before-and-after states.
28750. **Tablet scribble target input** — handwrite a URL with Pencil and have it converted to a hunt target.
28751. **Drag teammates to assign** — drag a teammate avatar onto a finding to assign it.
28752. **Tablet quick-note margin** — a persistent margin column for hunt notes visible beside any screen.
28753. **Pencil ruler for screenshots** — straight-line annotations with an on-screen ruler for precise markup.
28754. **Tablet app library shortcuts** — home-screen quick actions for resume hunt, new hunt, and criticals inbox.
28755. **Tablet finding flashcards** — swipeable flashcard mode for learning vulnerability patterns from real findings.
28756. **Drag report to print** — drag a report onto the print icon for one-step printing from the tablet.
28757. **Tablet dark-room reading** — extra-dim reading mode for reviewing reports during night shifts.
28758. **Pencil erase by scribble** — scribble over an annotation to delete it, matching natural paper behavior.
28759. **Tablet voice-dictation notes** — dictate hunt notes with on-device transcription while reviewing findings.
28760. **Split-view: report plus evidence** — read the PDF on one side while swiping evidence on the other.
28761. **Tablet gesture: three-finger triage** — three-finger swipe left or right to reject or approve findings rapidly.
28762. **Drag timeline to share clip** — drag a segment of the hunt timeline to create a shareable highlight clip.
28763. **Tablet whiteboard attack paths** — a canvas to sketch attack chains with Pencil, linked to the underlying findings.
28764. **Pencil magnifier loupe** — a loupe tool for pixel-level inspection of evidence screenshots.
28765. **Tablet notification center widget** — large-format hunt widget in the tablet's notification center.
28766. **Drag evidence to Jira** — drop a screenshot into the Jira ticket composer to attach it.
28767. **Tablet reading list** — save reports to a reading list with progress tracking across devices.
28768. **Pencil tap finding to annotate** — double-tap a finding row with Pencil to jump straight into annotation mode.
28769. **Tablet multi-select actions** — select multiple findings to bulk acknowledge, assign, or export.
28770. **Drag URL onto widget** — drop a link onto the home-screen widget to queue a hunt.
28771. **Tablet cellular handoff** — start a hunt on Wi-Fi tablet, continue monitoring on the phone over cellular seamlessly.
28772. **Pencil-fillable checklists** — tap checkboxes with Pencil in verification checklists for field validation.
28773. **Tablet split keyboard shortcuts bar** — a shortcut bar above the keyboard with hunt actions like pause and acknowledge.
28774. **Drag findings to whiteboard** — drop findings onto the attack-path canvas as linked nodes.
28775. **Tablet ambient dashboard** — a low-brightness always-on dashboard for SOC tablets mounted on walls.
28776. **Pencil handwriting search** — search handwritten annotations by converting them to text on-device.
28777. **Tablet face-down DND** — placing the tablet face-down auto-enables quiet hours for meetings.
28778. **Drag hunt between workspaces** — move a hunt card to another workspace in the switcher to transfer ownership.
28779. **Tablet split-view with terminal** — view the agent's live log terminal beside findings in split view.
28780. **Pencil pressure eraser** — harder press erases wider strokes for fast cleanup.
28781. **Tablet guest presentation lock** — lock the tablet to the presentation so clients can't wander into other hunts.
28782. **Drag evidence to timeline** — attach screenshots to specific hunt timeline events for context.
28783. **Tablet large-format report export** — export reports formatted for large-format printing for war rooms.
28784. **Pencil tilt shading** — tilt the Pencil to shade regions of screenshots when redacting sensitive areas.
28785. **Tablet quick-switcher** — swipe from the edge to switch between recent hunts like app switching.
28786. **Drag note to finding** — drop a margin note onto a finding to attach it there.
28787. **Tablet accessibility: switch control** — full switch-control support for analysts with motor impairments.
28788. **Pencil annotation templates** — stamp templates like "verified", "false positive", or "needs retest" with one tap.
28789. **Tablet hunt briefing cards** — swipeable cards summarizing each active hunt for stand-up meetings.
28790. **Drag severity to filter** — drag a severity badge onto the list to filter by it instantly.
28791. **Tablet night-shift scheduler** — schedule hunts for overnight runs with a tablet-optimized time picker.
28792. **Pencil continuous annotation** — keep annotating across pages without reselecting the pen tool.
28793. **Tablet split-view with calculator** — risk-score calculator beside findings for impact estimation.
28794. **Drag report section to share** — drag a single report section to share just that part with a client.
28795. **Tablet stylus hover tooltips** — hover with any active stylus for rich tooltips on charts and graphs.
28796. **Pencil double-tap undo** — double-tap with two fingers to undo the last annotation stroke.
28797. **Tablet hunt map view** — geographic-style map of target infrastructure for visual thinkers.
28798. **Drag teammates to poll** — drop avatars onto a poll card to request votes on report readiness.
28799. **Tablet low-power triage** — a minimal text-only triage mode that sips battery on long flights.
28800. **Pencil signature verification** — signed reports embed a verifiable signature hash for authenticity.
28801. **Tablet drag-to-duplicate finding** — duplicate a finding as a template for documenting a similar issue.
28802. **Split-view: chat plus whiteboard** — discuss with the agent while sketching attack paths beside it.
28803. **Tablet auto-rotate dashboard** — the dashboard rearranges intelligently between portrait triage and landscape overview.
28804. **Pencil annotation export as layer** — export annotations as a separate transparent layer over the original screenshot.
28805. **Native desktop client (Tauri)** — a lightweight native app wrapping the hunt dashboard with OS-level integrations.
28806. **Global hotkey: start hunt from anywhere** — press Ctrl+Shift+H to pop a hunt launcher over any application.
28807. **Clipboard target detection** — copying a URL triggers a subtle "hunt this URL?" prompt from the tray.
28808. **Screenshot-to-hunt** — capture a screenshot of a page and start a hunt against its URL in one flow.
28809. **Global hotkey: pause/resume** — a system-wide hotkey toggling the active hunt without switching windows.
28810. **Native file-system evidence browser** — browse hunt evidence as real files in the app with Quick Look previews.
28811. **Desktop deep-link handling** — darkmatter:// links open findings directly in the desktop client from emails or docs.
28812. **Drag URL onto dock icon** — drop a link onto the dock or taskbar icon to queue a hunt.
28813. **Native notifications center integration** — findings appear in the OS notification center with full action support.
28814. **Global hotkey: quick triage** — hotkey opening a floating triage card for the latest unreviewed finding.
28815. **Clipboard history of targets** — the app remembers recently copied URLs as one-click hunt targets.
28816. **Screen-region hunt** — select a screen region and hunt the URLs visible within it via OCR.
28817. **Native menu bar extras** — full menu bar with Hunt, Findings, Reports, and Window menus following OS conventions.
28818. **Desktop offline mode** — the desktop client caches hunts and reports for offline review like mobile.
28819. **Multi-window findings** — pop any finding into its own window for multi-monitor analysis.
28820. **Native print pipeline** — print reports with OS print dialogs, headers, footers, and page numbers.
28821. **Global hotkey: voice query** — hold a hotkey and ask "what did the hunt find?" for a spoken answer.
28822. **Screenshot annotation built-in** — capture and annotate evidence without leaving the desktop app.
28823. **Native drag-drop to Infinity AI** — drop project folders into Build mode for the coding agent to work on.
28824. **Desktop widget host** — the desktop app hosts the widget system so widgets work even when the main window is closed.
28825. **System proxy integration** — route hunt traffic through the OS-configured proxy automatically.
28826. **VPN status awareness** — warn before hunting if the VPN is disconnected on sensitive engagements.
28827. **Global hotkey: emergency stop** — instantly halt all hunts and Control tasks from anywhere.
28828. **Native spellcheck in notes** — OS spellcheck and grammar in hunt notes and finding comments.
28829. **Desktop focus timer** — Pomodoro-style focus sessions that silence notifications during deep triage.
28830. **Touch Bar hunt controls** — MacBook Touch Bar with pause, phase indicator, and finding count (where available).
28831. **Windows jump lists** — right-click the taskbar icon for recent hunts, new hunt, and criticals inbox.
28832. **macOS Quick Actions** — Finder Quick Actions to hunt a URL from a bookmark file or text selection.
28833. **Native share extensions** — share findings to the desktop app from any macOS or Windows share sheet.
28834. **Desktop always-on-top mini mode** — a compact always-on-top window with hunt progress for monitoring while coding.
28835. **Global hotkey: screenshot evidence** — capture the current screen as evidence attached to the active hunt.
28836. **Native full-text search** — Spotlight-fast search across hunts, findings, notes, and reports via a local index.
28837. **Desktop backup to local disk** — scheduled local backups of hunt history, notes, and settings.
28838. **Native 1Password-style autofill** — fill target credentials for authenticated hunts from the OS keychain.
28839. **Keychain-stored API tokens** — credentials stored in macOS Keychain or Windows Credential Manager, never plain files.
28840. **Desktop idle auto-lock** — lock the app when the workstation idles, requiring biometric or password to reopen.
28841. **Global hotkey: dictate note** — dictate a hunt note from anywhere with system speech recognition.
28842. **Native PDF rendering** — fast native PDF viewer for reports with annotation tools built in.
28843. **Desktop command palette** — Ctrl+K palette for every action: hunts, findings, settings, and navigation.
28844. **Native tabs for hunts** — each hunt in its own tab like a browser for parallel monitoring.
28845. **Global hotkey: toggle mini mode** — switch between full and mini window from anywhere.
28846. **Screen recording of hunts** — record the agent's desktop-control session as video evidence.
28847. **Native accessibility APIs** — full screen-reader and keyboard navigation support on desktop.
28848. **Desktop low-power mode** — reduce background polling and animations when on battery.
28849. **Native window snapping** — hunt windows snap to halves and quadrants following OS conventions.
28850. **Global hotkey: copy finding link** — copy a deep link to the latest finding from anywhere.
28851. **Desktop hunt scheduler UI** — calendar-style scheduler for one-time and recurring hunts.
28852. **Native emoji reactions** — react to findings and agent messages with OS emoji pickers.
28853. **Desktop file watcher** — watch a folder and auto-start hunts when new target lists appear.
28854. **Global hotkey: open criticals inbox** — jump straight to unacknowledged criticals from any app.
28855. **Native context menus** — right-click findings for OS-native menus with copy, export, and assign actions.
28856. **Desktop hunt templates manager** — create, edit, and share hunt templates in a dedicated native window.
28857. **Global hotkey: quick finding search** — fuzzy-find any finding across all hunts from a floating search bar.
28858. **Native badge on dock icon** — macOS dock and Windows taskbar badges show open critical counts.
28859. **Desktop guest-mode window** — present hunts to clients in a locked guest window hiding other data.
28860. **Native screenshot OCR** — extract URLs and text from screenshots to create targets automatically.
28861. **Global hotkey: toggle do-not-disturb** — silence all hunt notifications instantly from anywhere.
28862. **Desktop energy impact monitor** — show the client's CPU and energy footprint in Activity Monitor-friendly terms.
28863. **Native auto-updater** — silent background updates with a "what's new" toast after restart.
28864. **Desktop multiple workspaces** — separate window groups per team workspace with independent layouts.
28865. **Global hotkey: start Control task** — type a desktop-automation instruction from a global prompt.
28866. **Native file export dialogs** — OS-native save dialogs with format options for reports and evidence.
28867. **Desktop hunt import** — import hunt ZIP archives shared by teammates via drag-drop.
28868. **Native menubar search** — search hunts and findings from the macOS menu bar without opening the window.
28869. **Global hotkey: read digest aloud** — play the daily digest through desktop speakers on demand.
28870. **Desktop session restore** — reopen windows, tabs, and scroll positions exactly after a restart.
28871. **Native window transparency** — adjustable window opacity for overlaying hunt status on other work.
28872. **Desktop hunt queue manager** — visual queue of scheduled and queued hunts with drag-to-reorder priority.
28873. **Global hotkey: bookmark finding** — bookmark the currently viewed finding from anywhere in the app.
28874. **Native color picker for tags** — OS color pickers for custom finding and target tags.
28875. **Desktop offline indicator** — a clear banner and tray state when the backend is unreachable.
28876. **Native dictation in chat** — OS dictation support in the agent chat input for hands-free questions.
28877. **Global hotkey: open terminal log** — pop the agent's live log in a floating terminal-style window.
28878. **Desktop hunt duplication** — clone hunts with all settings from the context menu.
28879. **Native recently-closed hunts** — reopen accidentally closed hunt tabs like browser tabs.
28880. **Desktop performance profiler** — built-in view of the client's memory and CPU usage with leak warnings.
28881. **Global hotkey: switch backend** — toggle between localhost and Vercel backends from anywhere.
28882. **Native login with passkeys** — sign in using OS passkeys instead of passwords.
28883. **Desktop kiosk mode** — full-screen locked dashboard for SOC wall displays.
28884. **Global hotkey: capture finding screenshot** — screenshot the current finding view for documentation.
28885. **Native archive extraction** — open hunt ZIP exports natively with a built-in archive viewer.
28886. **Desktop hunt notes sidebar** — persistent markdown notes panel docked beside any hunt view.
28887. **Global hotkey: open settings** — jump to any settings page from the command palette hotkey.
28888. **Native font rendering** — crisp OS-native text rendering with user-selectable UI font size.
28889. **Desktop hunt cost dashboard** — native charts of API spend per hunt, target, and team.
28890. **Global hotkey: mute target** — mute notifications for the current hunt's target instantly.
28891. **Native crash reporter** — one-click diagnostic bundle submission when the client crashes.
28892. **Desktop whiteboard for attack paths** — a native canvas to map exploit chains with findings as nodes.
28893. **Global hotkey: new note** — create a hunt note from anywhere without losing context.
28894. **Native time tracking** — track time spent per hunt automatically for client billing.
28895. **Desktop focus-follows-hunt** — optionally bring the hunt window forward when a critical lands.
28896. **Global hotkey: retest finding** — trigger a retest of the current finding from anywhere.
28897. **Native markdown editor** — full markdown editing with preview for notes and report sections.
28898. **Desktop hunt API console** — built-in console to call the Dark-Matter API for power users.
28899. **Global hotkey: share finding** — open the share sheet for the current finding from anywhere.
28900. **Native system theme sync** — instant light/dark switching following OS appearance changes.
28901. **Desktop hunt screen-saver** — an optional screen-saver showing live hunt stats on idle machines.
28902. **Global hotkey: open evidence folder** — jump to the hunt's evidence directory on disk instantly.
28903. **Native uninstall cleanup** — clean removal of caches and credentials when uninstalling.
28904. **Desktop first-run migration** — import hunts, settings, and templates from the web app on first launch.
28905. **Share-sheet "Hunt with Dark-Matter"** — iOS and Android share sheets offer hunting any shared URL directly.
28906. **Spotlight search integration** — iOS Spotlight finds hunts, findings, and reports from the system search.
28907. **Windows Start-menu search** — typing a target or finding title in Start opens it in the desktop client.
28908. **Calendar integration: hunt reminders** — scheduled hunts appear as calendar events with join links.
28909. **Contacts integration: assign findings** — pick teammates from OS contacts when assigning findings.
28910. **macOS Spotlight file search** — downloaded reports indexed by Spotlight for system-wide search.
28911. **Android App Shortcuts** — long-press actions for new hunt, criticals inbox, and resume last hunt.
28912. **iOS Shortcuts app actions** — "Start Hunt", "Get Hunt Status", and "Read Digest" as automatable Shortcut actions.
28913. **Calendar: SLA deadlines as events** — finding remediation deadlines sync to the calendar with alerts.
28914. **Contacts: client stakeholders** — link client contacts to engagements for one-tap report sharing.
28915. **Windows Timeline integration** — hunt activities appear in Windows Timeline for resuming past work.
28916. **macOS Handoff** — start triage on iPhone, continue instantly on Mac at the same scroll position.
28917. **Android Direct Share** — share findings directly to frequent teammates from the share sheet.
28918. **Calendar: shift handoff events** — on-call rotations create handoff events with the digest attached.
28919. **Spotlight: finding deep links** — each finding indexed so Spotlight opens it directly in the app.
28920. **Siri: "hunt this page"** — Siri Shortcut hunts the URL of the current Safari page.
28921. **Google Assistant: "ask Dark-Matter"** — Assistant integration for hunt status and finding summaries.
28922. **Windows Widgets board deep links** — widgets link into specific hunts and findings in the desktop client.
28923. **macOS Finder tags sync** — exported reports tagged in Finder with severity metadata.
28924. **Calendar: retest reminders** — scheduled retests create calendar events with the finding context.
28925. **Contacts: escalation chains** — on-call chains built from contact groups for automatic escalation.
28926. **Android notification channels** — per-severity channels so users tune sound and vibration in system settings.
28927. **iOS Focus mode integration** — hunt notifications respect and integrate with Focus modes automatically.
28928. **Windows Focus Sessions** — hunts integrate with Clock focus sessions, batching notifications until breaks.
28929. **macOS Notification grouping** — system-level grouping of hunt notifications by target.
28930. **Share-sheet: finding as image** — share a rendered finding card image to social or messaging apps.
28931. **Calendar: hunt completion events** — completed hunts logged to a "Security" calendar for audit trails.
28932. **Contacts: avatar sync** — teammate avatars from contacts appear in comments and presence indicators.
28933. **Spotlight: hunt templates** — saved templates searchable from Spotlight to start hunts fast.
28934. **Android widgets: lock screen** — hunt status widgets on the Android lock screen.
28935. **iOS Live Activities API** — third-party complications show hunt progress in the Dynamic Island.
28936. **Windows Snap Layouts** — the desktop client suggests snap layouts for hunt plus findings plus terminal.
28937. **macOS Share menu in Finder** — right-click a target list file to hunt every URL in it.
28938. **Calendar: client review meetings** — report-ready events auto-suggest scheduling a review with the client contact.
28939. **Contacts: recent collaborators** — frequently assigned teammates surface first in assignment pickers.
28940. **Android Auto: calendar-aware briefings** — briefings pause automatically when a calendar call starts.
28941. **iOS: hunt in Safari extension** — a Safari extension button hunts the current page's domain.
28942. **Edge/Chrome: hunt this tab** — browser extension context menu hunts the active tab's URL.
28943. **Windows: hunt from File Explorer** — right-click a .txt target list to queue hunts for each line.
28944. **macOS: hunt from Services menu** — selected URLs in any app can be hunted via the Services menu.
28945. **Calendar: quiet hours sync** — calendar "focus" events automatically enable notification quiet hours.
28946. **Contacts: do-not-disturb exceptions** — escalation calls from the on-call chain bypass DND via contact favorites.
28947. **Spotlight: offline reports** — downloaded reports searchable in Spotlight even in airplane mode.
28948. **Android: hunt via Assistant Routines** — bedtime routines trigger overnight hunts automatically.
28949. **iOS: Back Tap to triage** — double-tap the iPhone back to open the criticals inbox.
28950. **Windows: Power Automate connector** — hunt actions available as Power Automate steps for enterprise workflows.
28951. **macOS: Automator actions** — start hunts and export reports from Automator and AppleScript.
28952. **Calendar: digest as event notes** — the daily digest appended to today's calendar event notes.
28953. **Contacts: team directory sync** — the in-app team list syncs with a shared contacts group.
28954. **Share-sheet: evidence to Files** — save evidence screenshots straight to the Files app from the share sheet.
28955. **Android: work profile separation** — hunt data stays in the work profile, isolated from personal apps.
28956. **iOS: managed app config** — MDM-pushed backend URLs and policies for enterprise deployments.
28957. **Windows: Group Policy support** — enterprise admins configure the desktop client via Group Policy.
28958. **macOS: configuration profiles** — MDM profiles preset the backend mode and notification rules.
28959. **Calendar: hunt blackout windows** — change-freeze calendars block hunts against production during freezes.
28960. **Contacts: client approval contacts** — designated approvers get push-to-approve for production hunts.
28961. **Spotlight: agent chat history** — past agent conversations searchable from system search.
28962. **Android: notification history** — dismissed hunt alerts recoverable from Android's notification history.
28963. **iOS: App Clips for guest links** — guests open shared hunt views via lightweight App Clips without installing.
28964. **Windows: notification mirroring** — desktop toasts mirror to the paired phone via Phone Link.
28965. **macOS: Notification Center widgets** — interactive hunt widgets in the Mac notification center.
28966. **Share-sheet: report to Slack** — one-tap share of findings to configured Slack channels.
28967. **Calendar: recurring hunt series** — weekly hunts create recurring calendar events with results attached.
28968. **Contacts: birthday-style reminders** — annual retest reminders for yearly client engagements.
28969. **Android: bubbles for agent chat** — the hunting agent chat floats as a system bubble during active hunts.
28970. **iOS: picture-in-picture briefings** — avatar video briefings play picture-in-picture while multitasking.
28971. **Windows: taskbar progress** — hunt progress shown as a progress bar on the taskbar icon.
28972. **macOS: dock progress badge** — dock icon shows a mini progress pie for the active hunt.
28973. **Share-sheet: finding to Notes** — save findings to Apple Notes or Google Keep with formatting intact.
28974. **Calendar: travel-aware scheduling** — hunts auto-schedule around flights detected in the calendar.
28975. **Contacts: emergency escalation** — ICE contacts notified if a critical goes unacknowledged past the SLA.
28976. **Spotlight: learning insights** — saved learning-engine tips searchable from system search.
28977. **Android: digital wellbeing** — hunt notification stats appear in Digital Wellbeing dashboards.
28978. **iOS: Screen Time integration** — triage time tracked in Screen Time for personal productivity review.
28979. **Windows: Game Bar widget** — a Game Bar widget shows hunt status for analysts who keep it open.
28980. **macOS: Control Center toggle** — a Control Center toggle for hunt quiet hours on the Mac.
28981. **Share-sheet: hunt config as file** — share hunt configurations as files teammates can import.
28982. **Calendar: post-hunt retro events** — auto-create retrospective events after major engagements end.
28983. **Contacts: LinkedIn-style notes** — private notes on client contacts visible when sharing reports.
28984. **Android: edge panel plugin** — Samsung Edge panel with hunt quick actions.
28985. **iOS: lock-screen controls** — pause, resume, and acknowledge from iOS lock-screen widgets.
28986. **Windows: quick settings tile** — a quick-settings tile toggling hunt notifications.
28987. **macOS: menu bar calendar** — upcoming hunts shown in a menu-bar calendar dropdown.
28988. **Share-sheet: copy curl PoC** — share a finding's curl PoC as text to any app.
28989. **Calendar: on-call overlay** — overlay on-call rotations on the hunt calendar to see coverage gaps.
28990. **Contacts: smart groups** — auto-built groups like "frequent assignees" for faster delegation.
28991. **Spotlight: hunt costs** — search "hunt spend" to open the cost dashboard from Spotlight.
28992. **Android: conversation notifications** — agent chat uses conversation-style notifications with avatars.
28993. **iOS: communication notifications** — teammate mentions arrive as communication notifications with contact photos.
28994. **Windows: share to Teams** — native share target for Microsoft Teams with finding cards.
28995. **macOS: share to Mail** — formatted finding emails composed via the native share extension.
28996. **Share-sheet: redacted report** — generate and share a client-safe redacted report in one step.
28997. **Calendar: deadline countdown widget** — home-screen widget counting down to the next report deadline.
28998. **Contacts: vCard export of team** — export the hunt team as vCards for client distribution lists.
28999. **Android: predictive back** — proper predictive-back animations throughout the app's navigation.
29000. **iOS: TipKit onboarding** — contextual system tips teach gestures like swipe-to-triage on first use.
29001. **Windows: ARM64 native build** — a native ARM64 desktop client for Snapdragon laptops with full performance.
29002. **macOS: Apple Silicon optimized** — universal binary tuned for M-series chips with low idle power.
29003. **Share-sheet: hunt result summary** — share a plain-language hunt summary card to any messaging app.
29004. **OS-level hunt URL scheme docs** — documented darkmatter:// URL scheme so enterprises can deep-link from their own tools.
