77005. **Multi-ring severity donut** — Inner ring shows finding counts by severity while the outer ring splits each severity by exploitability status, with click-through drill-down to the underlying findings.
77006. **Center-metric severity donut** — Renders a large weighted risk score in the donut hole that updates live as filters change, with the ring showing severity proportions.
77007. **Drill-down severity sunburst-donut hybrid** — Clicking a severity segment expands it into a second ring of CWE categories for that severity, preserving breadcrumb navigation back.
77008. **Comparative dual severity donut** — Places current-hunt and previous-hunt donuts side by side with connecting ribbons showing how each severity segment migrated.
77009. **Threshold-arc severity donut** — Draws SLA breach threshold arcs over the severity ring so segments exceeding the allowed open-finding limit flash red.
77010. **Animated severity donut transitions** — Morphs segment sizes with eased animation when the user scrubs a time slider, showing severity mix evolution.
77011. **Endpoint drill-down severity donut** — Starts at severity level, drills to target host, then to endpoint path, each level added as a concentric ring on click.
77012. **Severity donut with legend mini-sparklines** — Each legend row pairs the severity label with a 7-day sparkline of that severity's discovery rate.
77013. **Weighted-score severity donut** — Sizes segments by summed CVSS-weighted scores instead of raw counts, with a toggle to switch back to count mode.
77014. **Severity donut export presets** — One click exports the current donut as SVG with embedded data labels or as a transparent-background PNG for slide decks.
77015. **Per-target severity donut grid** — Small-multiple donuts, one per in-scope target, each clickable to open that target's finding table.
77016. **Severity donut with false-positive halo** — A translucent outer halo on each segment shows the proportion later marked false positive.
77017. **Age-banded severity donut** — Segments are split radially by finding age buckets (0–7d, 8–30d, 30d+) so stale criticals stand out visually.
77018. **Severity donut keyboard navigation** — Full keyboard operability where arrow keys move between segments and Enter drills down, with screen-reader labels.
77019. **Hunt-phase severity donut** — One donut per hunt phase (recon, scanning, exploitation, reporting) showing which severities each phase surfaced.
77020. **Severity donut with remediation inner ring** — Inner ring shows the remediated-versus-open split inside each severity segment.
77021. **Donut-to-bar morph toggle** — Lets the user morph the severity donut into a horizontal bar chart with one animated transition for presentations.
77022. **Severity donut print stylesheet** — Print-optimized rendering with high-contrast patterns instead of color fills for black-and-white reports.
77023. **Severity donut annotation pins** — Analysts pin dated notes onto segments, shown as markers that expand on hover.
77024. **Normalized severity donut** — Normalizes segment sizes by endpoint count per target so small applications are not visually hidden.
77025. **Severity donut with delta badges** — Each segment carries a plus/minus badge showing the change versus the previous hunt.
77026. **Severity donut tooltip tables** — Hovering a segment shows a mini table of the top five findings in that severity with CVSS and age.
77027. **Severity donut URL state** — The current drill level and filters are encoded in the URL so a specific donut view is shareable by link.
77028. **Severity donut with confidence shading** — Segment opacity encodes the agent's confidence in the findings, fading low-confidence segments.
77029. **Quarterly severity donut carousel** — Auto-advancing carousel of one donut per quarter with pause and jump controls.
77030. **Severity donut data-table mirror** — An accessible data table below the donut stays in sync with drill-down and filter state.
77031. **Severity donut segment search** — A search box highlights matching segments, so typing "XSS" pulses the related CWE slice.
77032. **Severity donut with PoC coverage ring** — An extra ring marks which severity segments have attached proof-of-concept artifacts.
77033. **Severity donut benchmark overlay** — Overlays the industry-median severity mix as a dashed ring for instant comparison.
77034. **Severity donut scheduler** — Schedules a weekly email with the donut rendered as an inline image plus a delta summary.
77035. **OWASP-category sparkline strip** — A horizontal strip of one sparkline per OWASP Top 10 category showing weekly discovery counts, each linking to filtered findings.
77036. **Sparkline with anomaly dots** — Overlays red dots on sparklines at points where the count deviates more than two standard deviations from the rolling mean.
77037. **Win/loss discovery bars** — Tiny bar sparklines per vuln class where upward bars are new findings and downward bars are remediated ones.
77038. **Sparkline-embedded finding tables** — Every row in the findings table carries a 90-day sparkline of that vuln class's frequency.
77039. **Endpoint-level sparklines** — Sparklines attached to each endpoint path showing how often each vuln class appeared there over the hunt.
77040. **Sparkline band overlays** — Shaded bands on sparklines mark hunt phases so spikes can be attributed to a phase change.
77041. **Severity-weighted sparkline** — Sparkline values use CVSS-weighted counts so a critical spike dominates the visual.
77042. **Sparkline comparison mode** — Overlays the previous hunt's sparkline in gray behind the current one for each vuln class.
77043. **Sparkline strip SVG export** — Exports the whole sparkline strip as a single SVG for embedding in status reports.
77044. **Per-service sparkline matrix** — A grid where rows are services and columns are vuln classes, each cell a mini sparkline.
77045. **Sparkline hover scrubber** — Hovering a sparkline shows a crosshair with the exact date and count at that point.
77046. **Cumulative sparkline variant** — Toggle switches each sparkline from per-period counts to cumulative-open counts.
77047. **Sparkline threshold lines** — Dashed threshold lines on sparklines mark the SLA alert level per vuln class.
77048. **Real-time sparkline ticks** — Sparklines append new points live as the agent discovers findings during an active hunt.
77049. **Sparkline normalization toggle** — Normalizes each sparkline to its own maximum so quiet vuln classes remain visible.
77050. **Sparklines in PDF reports** — Report generator renders sparklines as vector graphics in the PDF with matching captions.
77051. **Vuln-class sparkline ranking** — Sorts the strip by total volume, volatility, or most-recent spike on demand.
77052. **Sparkline with remediation markers** — Green tick marks on sparklines show when bulk remediations landed.
77053. **Multi-target sparkline overlay** — Overlays up to four targets' sparklines for one vuln class in distinct colors.
77054. **Sparkline data-point click** — Clicking a point on a sparkline opens the findings discovered on that date.
77055. **Log-scale sparkline option** — Switches the sparkline y-axis to logarithmic to reveal low-volume vuln classes.
77056. **Sparkline digest email** — Weekly email embeds the sparkline strip as images with auto-generated spike callouts.
77057. **Enrichment-event sparklines** — Sparklines track enrichment activity (CVSS lookups, exploit checks) per vuln class.
77058. **Sparkline gap highlighting** — Gaps in data from agent downtime render as hatched regions instead of interpolated lines.
77059. **Sparkline annotations API** — Lets integrations pin events like deploys or config changes onto sparklines via API.
77060. **Sparkline grid CSV export** — Exports the underlying time-series data behind every sparkline as CSV.
77061. **Quarter-over-quarter sparkline deltas** — Each sparkline header shows the quarter-over-quarter percentage change badge.
77062. **Sparkline mini-legend** — A shared legend explains colors, dots, and bands once for the whole strip.
77063. **Sparkline focus mode** — Clicking a sparkline expands it to full width with axis labels and a data table.
77064. **Sparkline empty-state handling** — Vuln classes with zero findings render as flat dashed lines with a "no findings" label rather than disappearing.
77065. **Phase swimlane Gantt** — One horizontal lane per hunt phase (recon, scanning, exploitation, validation, reporting) with bars for each task's duration.
77066. **Agent swimlanes** — Lanes per sub-agent show when each was active, with overlapping bands revealing parallel execution.
77067. **Milestone marker lane** — A dedicated top lane pins milestones (first finding, first critical, hunt paused) as diamond markers.
77068. **Swimlane zoom controls** — Zoom from whole-hunt view down to minute-level task bars with a minimap navigator.
77069. **Dependency arrows between lanes** — Draws arrows showing which tasks in one lane blocked tasks in another.
77070. **Swimlane with finding dots** — Each lane plots dots at the moment findings were discovered during that phase.
77071. **Planned-vs-actual swimlanes** — Planned phase durations render as outlines behind the actual filled bars.
77072. **Swimlane SVG export** — Exports the full swimlane diagram as a vector graphic for the final report.
77073. **Critical-path highlighting (visualization)** — Highlights the longest dependency chain across lanes in a contrasting color.
77074. **Swimlane phase cost overlay** — Each lane header shows the compute and API cost accrued during that phase.
77075. **Collapsible swimlane groups** — Phases collapse into summary bars, expanding on click to reveal sub-tasks.
77076. **Swimlane event tooltips** — Hovering any bar shows start and end times, agent, tokens used, and findings produced.
77077. **Multi-hunt swimlane comparison** — Stacks two hunts' swimlanes vertically with aligned start times to compare pacing.
77078. **Swimlane idle-gap detection** — Idle gaps longer than a threshold are shaded and labeled with their duration.
77079. **Swimlane with error markers** — Red flags on lanes mark task failures and retries with counts.
77080. **Swimlane playback mode** — A play button animates a cursor across the timeline, revealing bars as the hunt progressed.
77081. **Swimlane filter by agent** — Checkboxes toggle individual agent lanes on and off.
77082. **Swimlane print layout** — Paginated print rendering splits long hunts across pages with repeated lane labels.
77083. **Swimlane duration statistics** — Each lane header shows median and p95 task durations for that phase.
77084. **Swimlane with checkpoint bands** — Shaded vertical bands mark scheduled checkpoint reviews across all lanes.
77085. **Swimlane task search** — Searching highlights matching task bars across all lanes and dims the rest.
77086. **Swimlane CSV export** — Exports every bar as a row with phase, task, agent, start, end, and duration.
77087. **Swimlane lane reordering** — Drag lanes into a custom order that persists per user.
77088. **Swimlane with token-burn line** — A cumulative token-consumption line runs across the top, scaled to the timeline.
77089. **Swimlane pause/resume markers** — Pause intervals render as hatched gaps with a resume arrow.
77090. **Swimlane per-target lanes** — Lanes represent targets instead of phases when a hunt covers multiple assets.
77091. **Swimlane annotation comments** — Analysts attach timestamped comments to any point on a lane.
77092. **Swimlane accessibility table** — A screen-reader-friendly table mirrors every bar with the same data.
77093. **Swimlane with SLA deadline line** — A vertical line marks the report deadline, and bars crossing it turn red.
77094. **Swimlane snapshot compare** — Saves a swimlane snapshot mid-hunt and diffs it against the final state.
77095. **Target choropleth map** — Colors countries by the number of in-scope targets hosted there, with click-through to target lists.
77096. **Origin-to-target arc map** — Draws arcs from the agent's scan origin to each target's geolocated data center.
77097. **Data-center pin map** — Pins each target's hosting data center with severity-colored markers sized by finding count.
77098. **Geographic severity bubbles** — Bubble map where bubble size is finding count and color is maximum severity per region.
77099. **Jurisdiction overlay map** — Overlays data-residency jurisdiction boundaries so targets in regulated regions are visually flagged.
77100. **Latency dot map** — Plots measured request latency per target region as colored dots on a world map.
77101. **Geographic map drill-down** — Zooms from world to country to city, each level listing the targets and findings at that granularity.
77102. **CDN edge-location map** — Plots detected CDN edge points of presence for each target to reveal geographic serving distribution.
77103. **Map with geolocation confidence** — Marker opacity encodes the confidence of the IP-to-location lookup.
77104. **Geographic map time scrubber** — Scrubs the map through hunt history, showing targets and findings appearing over time.
77105. **Compliance-zone map** — Highlights targets inside GDPR/CCPA-applicable zones with distinct boundary styling.
77106. **Map export for reports** — Exports the current map view as a high-resolution PNG with a legend and scale bar.
77107. **Geographic map clustering** — Nearby targets cluster into numbered markers that expand on zoom.
77108. **Target-density contour overlay** — Draws contour lines over dense target regions to show concentration without markers.
77109. **Geographic map with ASN labels** — Hovering a target pin shows its ASN, ISP, and hosting provider.
77110. **Multi-hunt geographic diff** — Compares target geography between two hunts, highlighting added and removed regions.
77111. **Geographic map dark/light tiles** — Switches map tile themes to match the dashboard theme.
77112. **Geographic finding-age coloring** — Colors pins by the age of the oldest open finding at that target.
77113. **Geographic map fullscreen mode** — Expands the map to fullscreen with a collapsible side panel of target details.
77114. **Geographic map keyboard pan/zoom** — Full keyboard navigation of the map for accessibility.
77115. **Geographic map with offline tiles** — Caches map tiles so the view works in air-gapped deployments.
77116. **Geographic map URL sharing** — Encodes center, zoom, and selected target in the URL for linkable map views.
77117. **Geographic map with scan-origin marker** — Marks the agent's egress location distinctly from target pins.
77118. **Geographic remediation progress rings** — Each target pin carries a progress ring showing its remediation completion.
77119. **Geographic map with timezone bands** — Overlays timezone bands so SLA deadlines can be read in local target time.
77120. **Geographic threat-origin overlay** — Plots the geographic origin of observed attack traffic against targets.
77121. **Cloud-region shading map** — Shades cloud provider regions to show which region each target resolves to, with per-region finding counts.
77122. **Geographic map CSV export** — Exports the visible pins as CSV with coordinates, target, findings, and severity.
77123. **Geographic map severity filter chips** — Filter chips above the map toggle severity levels, updating pins instantly.
77124. **Geographic map hunt-path replay** — Replays the agent's target-visitation order as an animated path across the map.
77125. **Framework-to-library sunburst** — Inner ring shows detected frameworks, outer rings show libraries and versions, sized by endpoint count.
77126. **EOL-highlighted sunburst** — Segments for end-of-life software versions render in a warning pattern with hover details.
77127. **Version-age sunburst rings** — Ring position encodes how many major versions behind the latest release each component is.
77128. **Sunburst with CVE overlays** — Segments with known CVEs carry a badge showing the highest CVSS, clickable to the CVE list.
77129. **Sunburst drill-to-endpoint** — Clicking a library segment lists every endpoint where that library was detected.
77130. **Multi-target sunburst compare** — Renders two sunbursts side by side to compare tech stacks across targets.
77131. **Sunburst with license coloring** — Colors segments by license type (permissive, copyleft, proprietary) for compliance review.
77132. **Sunburst zoom-to-segment** — Clicking a segment zooms the sunburst to make it the new center.
77133. **Sunburst with update-effort sizing** — Sizes segments by estimated upgrade effort instead of endpoint count.
77134. **Sunburst SVG export** — Exports the sunburst as a labeled vector graphic for architecture reviews.
77135. **Sunburst with detection-confidence shading** — Segment opacity reflects how confidently the technology was fingerprinted.
77136. **Sunburst time-lapse** — Animates the sunburst across hunts to show stack changes over time.
77137. **Sunburst with finding linkage** — Segments linked to findings get a dot, and clicking filters findings to that component.
77138. **Sunburst breadcrumb trail** — Shows the drill path (for example Target, framework, version) with one-click jumps.
77139. **Sunburst with deprecated-API flags** — Flags segments exposing deprecated APIs with a distinct icon.
77140. **Sunburst search highlight** — Searching for a term highlights all matching segments across the chart.
77141. **Sunburst per-hunt-phase** — Separate sunbursts show what the recon phase versus the exploitation phase each detected.
77142. **Sunburst with vendor consolidation** — Groups segments by vendor to reveal single-vendor concentration risk.
77143. **Sunburst with patch-lag bars** — Each segment's tooltip includes a bar showing days since the latest patch release.
77144. **Sunburst accessibility list** — A nested list mirrors the sunburst hierarchy for screen readers.
77145. **Sunburst with container-layer view** — Toggles the sunburst to show container image layers instead of libraries.
77146. **Sunburst with language runtime ring** — Adds a ring for detected language runtimes beneath frameworks.
77147. **Sunburst with header-based detection** — Marks segments detected from headers versus body content with different border styles.
77148. **Sunburst snapshot diff** — Diffs the current sunburst against a previous snapshot, highlighting added and removed components.
77149. **Sunburst with risk-score sizing** — Sizes segments by aggregated risk score of their linked findings.
77150. **Sunburst with CDN/provider ring** — Outer ring shows the CDN or hosting provider serving each branch.
77151. **Sunburst with duplicate-version warnings** — Warns when the same library appears in multiple versions across the stack.
77152. **Sunburst with SBOM export** — Exports the visible hierarchy as a CycloneDX SBOM file.
77153. **Sunburst with endpoint-count labels** — Labels show exact endpoint counts per segment on hover and in exports.
77154. **Sunburst with theme-aware palette** — Palettes adapt to light and dark mode with sufficient contrast ratios.
77155. **Open-findings burndown** — Plots open finding count daily against an ideal linear burndown to the SLA date.
77156. **Ideal-vs-actual burndown bands** — Shades the acceptable variance band around the ideal line, and actuals outside it trigger alerts.
77157. **Per-team burndown lanes** — Separate burndown lines per remediation team with a shared ideal line.
77158. **Severity-weighted burndown** — Burns down CVSS-weighted points instead of raw counts so criticals dominate.
77159. **Burndown with scope-change markers** — Vertical markers show when new targets or findings were added, adjusting the ideal line.
77160. **Cumulative-flow variant** — Stacked areas show findings in open, in-progress, and remediated states over time.
77161. **Burndown forecast cone** — Projects a completion-date cone from the current burn rate with best and worst cases.
77162. **Burndown per-vuln-class** — Small-multiple burndowns, one per OWASP category, with independent ideal lines.
77163. **Burndown with re-open spikes** — Re-opened findings render as upward spikes with a distinct color.
77164. **Burndown PNG export** — Exports the burndown with the forecast cone for status meetings.
77165. **Burndown with milestone diamonds** — Marks patch windows and release dates as diamonds on the timeline.
77166. **Burndown velocity readout** — Header shows findings closed per week and weeks remaining at current velocity.
77167. **Burndown with weekend shading** — Shades weekends to explain velocity dips in the actual line.
77168. **Burndown target-date slider** — Dragging the target date redraws the ideal line instantly.
77169. **Burndown with false-positive filtering** — Toggle excludes false positives from both actual and ideal lines.
77170. **Burndown per-target** — One burndown per in-scope target with a rollup total line.
77171. **Burndown with annotation events** — Analysts pin events such as WAF deployments that appear as labeled markers.
77172. **Burndown with confidence intervals** — The forecast cone shows 50 percent and 90 percent confidence bands.
77173. **Burndown data table** — A table under the chart lists daily open and closed counts with running totals.
77174. **Burndown with aging overlay** — Overlays the average age of open findings as a secondary-axis line.
77175. **Burndown with SLA breach projection** — Projects which severities will breach SLA at current velocity, listed beside the chart.
77176. **Burndown with team capacity input** — Lets managers set team capacity to redraw a realistic ideal line.
77177. **Burndown with holiday calendar** — Excludes configured holidays from the ideal-line calculation.
77178. **Burndown with verification lag** — Shows a second line for findings remediated but awaiting verification.
77179. **Burndown with drill-to-finding** — Clicking any point lists the findings open on that date.
77180. **Burndown CSV export** — Exports daily open, closed, and ideal values for spreadsheet analysis.
77181. **Burndown with sprint overlays** — Overlays sprint boundaries so agile teams read it in their cadence.
77182. **Burndown with risk-burn variant** — Burns down total risk score rather than count, with the same ideal-line mechanics.
77183. **Burndown with exception markers** — Risk-accepted findings render as hollow markers removed from the burn.
77184. **Burndown digest widget** — A compact burndown widget for the home screen showing only the actual line and forecast date.
77185. **SLA radial gauge** — A 270-degree gauge showing the percentage of findings remediated within SLA, with red, yellow, and green zones.
77186. **Per-severity SLA gauges** — Four gauges for critical, high, medium, and low, each with its own SLA target needle.
77187. **SLA breach countdown ring** — A ring that depletes as the oldest open critical approaches its SLA deadline.
77188. **Gauge with needle history** — The gauge needle leaves a fading trail of its last twelve positions.
77189. **SLA compliance dial with target band** — The target compliance band is shaded on the dial face.
77190. **Gauge with drill-to-breaches** — Clicking the red zone lists the findings currently breaching SLA.
77191. **SLA gauge with forecast needle** — A second ghosted needle shows the projected compliance at month end.
77192. **Per-team SLA gauges** — One gauge per remediation team with sortable ranking.
77193. **SLA gauge with exception toggle** — Toggle includes or excludes risk-accepted findings from the gauge.
77194. **Gauge with threshold alerts** — Crossing into the red zone triggers a configurable notification.
77195. **SLA gauge embed code** — Generates an iframe snippet to embed the live gauge in an intranet page.
77196. **Gauge with historical ticks** — Tick marks on the dial show compliance at the end of each prior quarter.
77197. **SLA gauge with severity weighting** — Weights each finding by severity so a critical breach moves the needle more.
77198. **Gauge with SLA-policy tooltip** — Hovering the gauge shows the exact SLA windows driving it.
77199. **Multi-policy gauge switcher** — Switches the gauge between different SLA policies (internal, contractual, regulatory).
77200. **SLA gauge PNG export** — Exports the gauge as a PNG with the current value stamped.
77201. **Gauge with real-time tick** — The needle moves live as remediations are verified during the day.
77202. **SLA gauge with timezone selector** — Recomputes deadlines in the selected timezone for global teams.
77203. **Gauge with breach-age histogram link** — Links to a histogram of how far past deadline breached findings are.
77204. **SLA gauge with audit trail** — Every needle movement is logged with the finding events that caused it.
77205. **Gauge with target-date input** — Lets the user set a custom evaluation date to preview compliance on that date.
77206. **SLA gauge with per-target drill** — Drills from the overall gauge to per-target gauges.
77207. **Gauge with contractual-penalty readout** — Shows the estimated penalty exposure implied by current breaches.
77208. **SLA gauge with dark-mode rendering** — Gauge face adapts to the dashboard theme without losing zone contrast.
77209. **Gauge with keyboard readout** — Screen readers announce the gauge value, zone, and trend on focus.
77210. **SLA gauge with weekly delta badge** — A badge shows the week-over-week change in compliance percentage.
77211. **Gauge with SLA-calendar link** — Jumps to a calendar view showing each finding's deadline day.
77212. **SLA gauge with noise filtering** — Excludes findings younger than 24 hours to avoid needle jitter.
77213. **Gauge with custom zones** — Lets admins define zone boundaries and colors per severity.
77214. **SLA gauge with PDF caption** — Report exports include an auto-generated caption explaining the gauge value.
77215. **Hunt-capability radar** — Plots a hunt across axes such as recon depth, scan coverage, exploitation breadth, validation rigor, and report quality.
77216. **Multi-hunt radar overlay** — Overlays up to five hunts' radars in translucent colors for direct comparison.
77217. **Radar with benchmark polygon** — Draws the fleet-median radar as a dashed polygon behind the hunt's own.
77218. **Vuln-class radar** — Axes are OWASP categories, and the polygon shows detection strength per category.
77219. **Radar axis drill-down** — Clicking an axis opens the underlying metrics and findings for that dimension.
77220. **Radar with target polygons** — One polygon per target within a hunt to compare target-level performance.
77221. **Radar animation across hunts** — Animates the polygon morphing from the oldest to the newest hunt.
77222. **Radar with ideal polygon** — Overlays the target-state polygon so gaps appear as concave dents.
77223. **Radar SVG export** — Exports the radar with axis labels and legend as a vector graphic.
77224. **Radar with confidence shading** — Axis points with low data confidence render as hollow dots.
77225. **Team-capability radar** — Compares remediation teams across response time, fix quality, and verification axes.
77226. **Radar with normalization toggle** — Toggles between raw scores and percentile ranks per axis.
77227. **Radar with axis weighting** — Lets users weight axes so the polygon area reflects their priorities.
77228. **Radar snapshot history** — Saves radar snapshots per hunt for a scrollable history strip.
77229. **Radar with data table** — A table beside the radar lists exact scores per axis with deltas.
77230. **Radar with threshold rings** — Concentric rings mark minimum-acceptable levels per axis.
77231. **Vendor-tool radar** — Compares scanner tools across detection rate, false-positive rate, speed, and cost axes.
77232. **Radar with quarter labels** — Each overlaid polygon is labeled with its hunt date for temporal reading.
77233. **Radar with accessibility text** — Generates a textual summary such as strongest in recon, weakest in validation for screen readers.
77234. **Radar with print layout** — Print stylesheet renders the radar with high-contrast fills.
77235. **Radar with axis tooltips** — Hovering an axis explains the metric and its calculation.
77236. **Radar with goal markers** — Marks per-axis goals as dots on the spokes.
77237. **Radar with small multiples** — A grid of mini radars, one per hunt, for portfolio review.
77238. **Radar CSV export** — Exports axis scores per hunt as CSV.
77239. **Radar with live updates** — The polygon grows live during an active hunt as phases complete.
77240. **Radar with phase breakdown** — Toggles the radar to show per-phase sub-polygons.
77241. **Radar with cost axis** — Includes cost-efficiency as an axis so expensive hunts show a visible dent.
77242. **Radar with peer comparison** — Overlays anonymized peer-program polygons for benchmarking.
77243. **Radar with annotation pins** — Pins notes to specific axes explaining score changes.
77244. **Radar with URL state** — Encodes selected hunts and axes in the URL for shareable comparisons.
77245. **Industry-benchmark grouped bars** — Groups bars as your program versus industry median versus top quartile per metric.
77246. **Bullet charts for SLA metrics** — Bullet bars show actual versus target with qualitative ranges behind.
77247. **Lollipop benchmark charts** — Lollipop stems compare your value against benchmark dots per metric.
77248. **Benchmark bars with confidence whiskers** — Error whiskers show the benchmark's interquartile range.
77249. **Per-metric benchmark cards** — Each metric gets a bar card with the benchmark line and delta badge.
77250. **Benchmark bar drill-down** — Clicking a bar reveals the anonymized peer distribution behind the median.
77251. **Benchmark bars with time toggle** — Switches benchmarks between trailing twelve months and current quarter.
77252. **Diverging benchmark bars** — Diverging bars show how far above or below benchmark each metric sits.
77253. **Benchmark bars with percentile labels** — Labels show your exact percentile rank per metric.
77254. **Benchmark export for slides** — Exports benchmark bars as presentation-ready PNGs with titles.
77255. **Benchmark bars with sector filter** — Filters benchmarks to your industry sector such as fintech or healthcare.
77256. **Benchmark bars with company-size filter** — Filters benchmarks to peer programs of similar size.
77257. **Benchmark bars with methodology tooltip** — Hovering explains how each benchmark was computed.
77258. **Benchmark bars with trend arrows** — Arrows show whether the gap to benchmark is widening or closing.
77259. **Stacked benchmark bars** — Stacked bars split your value into components such as severity against the benchmark total.
77260. **Benchmark bars with goal lines** — Dashed goal lines show where leadership wants each metric.
77261. **Benchmark bars with data freshness** — Labels show the benchmark dataset's last-updated date.
77262. **Benchmark bars CSV export** — Exports your values and benchmark values side by side.
77263. **Benchmark bars with anonymized peers** — Optional overlay of individual anonymized peer dots.
77264. **Benchmark bars with drill-to-actions** — Clicking an underperforming bar suggests linked remediation actions.
77265. **Benchmark bars with quarterly animation** — Animates bars across quarters to show progress.
77266. **Benchmark bars with colorblind palette** — Uses a verified colorblind-safe palette for the groupings.
77267. **Benchmark bars with print mode** — High-contrast print rendering with pattern fills.
77268. **Benchmark bars with threshold shading** — Shades the region below minimum-acceptable performance.
77269. **Benchmark bars with metric definitions** — An expandable glossary defines each benchmarked metric.
77270. **Benchmark bars with weighting control** — Lets users weight metrics into a composite benchmark score bar.
77271. **Benchmark bars with live refresh** — Refreshes your values live during active hunts while benchmarks stay fixed.
77272. **Benchmark bars with commentary** — Auto-generates one-line commentary per metric such as 2.3 times faster than median.
77273. **Benchmark bars with share link** — Shareable URL preserves sector and size filters plus selected metrics.
77274. **Benchmark bars with PDF caption** — Auto-caption explains the comparison in the exported report.
77275. **CVSS-vs-exploitability scatter** — Plots each finding with CVSS on the x-axis and exploitability score on the y-axis, sized by business impact.
77276. **Age-vs-severity scatter** — Plots finding age against severity to surface stale criticals in the top-right.
77277. **Anomaly-outlier highlighting** — Points beyond two standard deviations get halos and a side-panel list.
77278. **Scatter with quadrant labels** — Quadrants are labeled for prioritization, such as fix first or monitor.
77279. **Scatter with lasso selection** — Lasso-select points to bulk-assign them to a remediation ticket.
77280. **Scatter with jitter control** — Adds jitter to overlapping points to reveal density.
77281. **Scatter with density contours** — Draws contour lines over dense point clusters.
77282. **Scatter with trend line** — Fits a regression line with confidence band across the points.
77283. **Scatter with point tooltips** — Hovering shows finding title, CVSS, endpoint, and age.
77284. **Scatter with color-by-dimension** — Colors points by severity, target, or vuln class on demand.
77285. **Scatter with size-by-dimension** — Sizes points by exploitability or business impact.
77286. **Scatter with animation over time** — Animates points appearing in discovery order with a time scrubber.
77287. **Scatter with zoom-to-cluster** — Double-clicking a cluster zooms into it with a breadcrumb to zoom out.
77288. **Scatter with export of selection** — Exports lasso-selected points as CSV.
77289. **Scatter with marginal histograms** — Histograms on the top and right margins show each axis's distribution.
77290. **Scatter with log-axis toggles** — Toggles either axis to logarithmic scale.
77291. **Scatter with reference lines** — Dashed lines mark SLA thresholds such as age equals 30 days.
77292. **Scatter with point search** — Searching highlights matching findings and dims the rest.
77293. **Scatter with multi-hunt overlay** — Overlays two hunts' points in different shapes to compare.
77294. **Scatter with brushing** — Brushing a region filters the findings table to those points.
77295. **Scatter with outlier export** — One click exports the outlier list for triage review.
77296. **Scatter with axis swapping** — Swaps x and y axes with one click for alternate readings.
77297. **Scatter with facet grids** — Small-multiple scatters faceted by target or vuln class.
77298. **Scatter with point labels on hover** — Shows finding IDs next to hovered points.
77299. **Scatter with keyboard navigation** — Arrow keys move between points with screen-reader announcements.
77300. **Scatter with print export** — Exports the scatter as a high-DPI PNG for reports.
77301. **Scatter with correlation readout** — Header shows the Pearson correlation between the axes.
77302. **Scatter with time-decay fading** — Older findings fade so recent anomalies stand out.
77303. **Scatter with cluster auto-labels** — Labels the largest clusters with their dominant vuln class.
77304. **Scatter with saved views** — Saves axis, color, and size configurations as named views.
77305. **Enrichment ring meters** — One ring per enrichment type (CVE mapping, exploit check, asset tagging) showing coverage percentage.
77306. **Meter with drill-to-unenriched** — Clicking a meter lists the findings missing that enrichment.
77307. **Coverage meter with target bands** — Target bands such as 95 percent are shaded on each meter face.
77308. **Per-target enrichment meters** — Meter grids per target to spot enrichment gaps by asset.
77309. **Enrichment meter with trend arrows** — Arrows show whether coverage is rising or falling week over week.
77310. **Meter with enrichment latency** — Secondary readout shows median enrichment latency per type.
77311. **Enrichment meter with failure breakdown** — Segments the uncovered portion by failure reason (timeout, no data, skipped).
77312. **Meter with bulk-enrich action** — A button on each meter re-runs enrichment for the uncovered findings.
77313. **Enrichment meter CSV export** — Exports coverage percentages per type and target as CSV.
77314. **Meter with SLA linkage** — Shows how many SLA-relevant findings lack enrichment.
77315. **Enrichment meter with historical sparkline** — Each meter includes a sparkline of its coverage over 30 days.
77316. **Meter with provider status** — Indicates whether the enrichment provider such as the CVE feed is healthy.
77317. **Enrichment meter with cost readout** — Shows the API cost spent on enrichment per type.
77318. **Meter with per-severity split** — Splits each meter's coverage by severity to prioritize critical gaps.
77319. **Enrichment meter with alerting** — Alerts when any meter drops below its target band.
77320. **Meter with enrichment queue depth** — Shows pending enrichment jobs as a secondary gauge.
77321. **Enrichment meter with retry controls** — Lets operators retry failed enrichments from the meter panel.
77322. **Meter with coverage-by-age** — Shows enrichment coverage segmented by finding age.
77323. **Enrichment meter with comparison mode** — Compares coverage between two hunts side by side.
77324. **Meter with enrichment audit log** — Logs every enrichment run with timestamp and outcome.
77325. **Enrichment meter with white-label styling** — Meters adopt the white-label theme in client reports.
77326. **Meter with API-driven updates** — Coverage values update via webhook as enrichments complete.
77327. **Enrichment meter with drill-to-provider** — Clicking a failure segment shows the provider error details.
77328. **Meter with scheduled reports** — Weekly email includes the meter panel as an image.
77329. **Enrichment meter with per-agent split** — Shows which sub-agent produced findings lacking enrichment.
77330. **Meter with coverage goals** — Lets managers set per-type coverage goals rendered as target arcs.
77331. **Enrichment meter PNG export** — Exports the meter panel as a PNG for status decks.
77332. **Meter with low-coverage callouts** — Auto-generates callout text for the lowest-coverage enrichment types.
77333. **Enrichment meter with timezone-aware timestamps** — Last-enriched times render in the viewer's timezone.
77334. **Meter with enrichment prioritization** — Ranks unenriched findings by severity so operators enrich what matters first.
77335. **Triage kanban board** — Columns for New, Triaging, Validated, Assigned, In Fix, and Verified with drag-and-drop cards.
77336. **Kanban with WIP limits** — Columns show work-in-progress limits and highlight over-limit columns in red.
77337. **Kanban card aging badges** — Cards show age badges that change color as they approach SLA.
77338. **Cumulative-flow diagram** — Stacked areas show card counts per column over time to reveal bottlenecks.
77339. **Triage aging histogram** — Histogram of days findings spend in triage, with a marker for the median.
77340. **Kanban with swimlanes by severity** — Rows per severity keep criticals visually separated from lows.
77341. **Column-transition chord** — Chord diagram showing volumes moving between triage states.
77342. **Triage cycle-time scatter** — Scatter of cycle time versus severity with a median line per severity.
77343. **Kanban with bulk actions** — Multi-select cards to bulk-assign, bulk-label, or bulk-transition.
77344. **Triage throughput line** — Line chart of findings triaged per day with a 7-day moving average.
77345. **Kanban with filter chips** — Chips filter cards by target, vuln class, or assignee without leaving the board.
77346. **Blocked-cards indicator** — Cards waiting on external input get a striped pattern and a blocked-reason tag.
77347. **Triage state-duration bars** — Horizontal bars show average hours spent in each state.
77348. **Kanban with assignee avatars** — Cards show assignee avatars with workload counts on hover.
77349. **Triage backlog burndown** — Burndown of the untriaged backlog specifically.
77350. **Kanban with SLA countdown** — Each card shows a live countdown to its SLA deadline.
77351. **Triage velocity by analyst** — Bar chart of triage decisions per analyst per week.
77352. **Kanban with comment threads** — Cards expand to show per-finding discussion threads.
77353. **Triage decision pie** — Pie of triage outcomes such as confirmed, false positive, duplicate, and risk-accepted.
77354. **Kanban with keyboard shortcuts** — Full keyboard triage for moving, assigning, and labeling for power users.
77355. **Triage re-open tracking** — Marks cards that were re-opened with a distinct badge and history.
77356. **Kanban with export** — Exports the board state as CSV or PNG.
77357. **Triage queue by source** — Groups incoming cards by discovery source such as agent scan, manual, or retest.
77358. **Kanban with due-date sorting** — Sorts cards within columns by SLA deadline.
77359. **Triage aging alerts** — Alerts when a card sits in one column beyond its threshold.
77360. **Kanban with linked tickets** — Cards show linked Jira or Linear ticket status inline.
77361. **Triage batch view** — Groups similar findings into batches for one-click batch triage.
77362. **Kanban with activity feed** — Side feed shows every card move with actor and timestamp.
77363. **Triage accuracy tracking** — Tracks how often triage decisions are later overturned, shown per analyst.
77364. **Kanban with saved filters** — Saves filter combinations as named views for different roles.
77365. **Cost-per-finding waterfall** — Waterfall from total hunt cost through compute, API, and labor to cost per validated finding.
77366. **Waterfall with phase breakdown** — Each phase (recon, scan, exploit, report) is a waterfall step with its cost.
77367. **Waterfall with benchmark line** — Overlays the industry-median cost per finding as a reference line.
77368. **Budget-variance waterfall** — Waterfall from budgeted to actual cost with variance drivers as floating bars.
77369. **Waterfall with drill-to-line-items** — Clicking a step expands the underlying cost line items.
77370. **Waterfall per-target** — One waterfall per target showing where each target's cost concentrates.
77371. **Waterfall with cost drivers** — Annotates each step with its top cost driver such as model tokens.
77372. **Waterfall export for finance** — Exports the waterfall as a spreadsheet-ready table plus chart image.
77373. **Waterfall with forecast** — Extends the waterfall with projected costs to hunt completion.
77374. **Waterfall with severity weighting** — Recomputes cost per finding weighted by severity, such as cost per critical.
77375. **Waterfall with time scrubber** — Scrubs through the hunt to see the waterfall build up over time.
77376. **Waterfall with currency toggle** — Switches between USD, EUR, and INR with live conversion.
77377. **Waterfall with anomaly flags** — Flags steps whose cost deviates from the fleet median.
77378. **Waterfall with per-agent costs** — Splits compute cost by sub-agent.
77379. **Waterfall with API-provider split** — Splits API cost by provider such as model APIs and enrichment feeds.
77380. **Waterfall with labor-rate input** — Lets finance set analyst hourly rates to recompute labor steps.
77381. **Waterfall with savings levers** — Highlights steps with the biggest savings opportunity.
77382. **Waterfall with historical compare** — Overlays the previous hunt's waterfall in gray.
77383. **Waterfall with cost caps** — Draws cap lines per step, and overruns render in red.
77384. **Waterfall CSV export** — Exports every step with amounts and drivers.
77385. **Waterfall with real-time updates** — Steps grow live during an active hunt.
77386. **Waterfall with per-finding table** — A table under the chart lists each finding with its attributed cost.
77387. **Waterfall with discount modeling** — Models how reserved-capacity discounts would change each step.
77388. **Waterfall with carbon estimate** — Adds an estimated compute-carbon step for ESG reporting.
77389. **Waterfall with approval thresholds** — Marks steps requiring finance approval above a threshold.
77390. **Waterfall with multi-hunt rollup** — Rolls up waterfalls across a quarter into one view.
77391. **Waterfall with print layout** — Print-optimized rendering with exact figures labeled.
77392. **Waterfall with commentary** — Auto-generates plain-English commentary per step.
77393. **Waterfall with alerting** — Alerts when projected cost per finding exceeds the budget.
77394. **Waterfall with white-label theme** — Adopts client branding in exported versions.
77395. **One-click SVG export** — Every chart has an export button producing a self-contained SVG with embedded fonts.
77396. **PDF chart embedding** — Report builder embeds charts as vector objects in the PDF, not rasterized images.
77397. **Theme-aware exports** — Exports honor the current light or dark theme, or force a chosen one.
77398. **Export with data labels** — Toggle includes exact values as labels on exported charts.
77399. **Batch chart export** — Exports all charts on a dashboard as a ZIP of SVGs in one click.
77400. **Export with captions** — Exports include auto-generated captions describing the chart.
77401. **High-DPI PNG export** — Exports raster versions at 300 DPI for print publications.
77402. **Export with source footers** — Exports stamp the generator name with timestamp and hunt ID.
77403. **SVG with accessible titles** — Exported SVGs include title and description elements for screen readers.
77404. **Export presets** — Saved presets for slide, report, and social set size, theme, and format per use case.
77405. **Export with transparent background** — PNG and SVG exports support transparency for overlaying on slides.
77406. **Export with custom dimensions** — Lets users set exact pixel dimensions before exporting.
77407. **Export queue** — Queues large exports and notifies when the ZIP is ready.
77408. **Export with watermark** — Optional watermark for draft or confidential exports.
77409. **Vector PDF page sizing** — Exports charts to PDF pages sized A4, Letter, or custom.
77410. **Export with font embedding** — Embeds the dashboard font in SVGs and PDFs so rendering is consistent.
77411. **Export history** — Logs every export with chart, format, and user for audit.
77412. **Export with redaction** — Redacts target names in exports for sharing with third parties.
77413. **Scheduled chart exports** — Schedules recurring exports such as a weekly burndown PNG to email or object storage.
77414. **Export with locale formatting** — Numbers and dates in exports follow the selected locale.
77415. **Export with colorblind-safe check** — Warns if the export palette fails colorblind-safety checks.
77416. **Export API** — REST endpoint renders any chart to SVG or PDF server-side for automation.
77417. **Export with interactive PDF** — PDFs include clickable chart elements linking to the live dashboard.
77418. **Export with multi-language captions** — Captions render in the selected report language.
77419. **Export with version stamp** — Exports include the data snapshot version for reproducibility.
77420. **Export with approval workflow** — Sensitive exports require approval before download.
77421. **Export with compression options** — Balances SVG file size versus fidelity for email attachments.
77422. **Export with chart linking** — Exported dashboard PDFs link charts to their live URLs.
77423. **Export with annotation layers** — Includes or excludes analyst annotations as a toggle.
77424. **Export with print bleed** — Adds print bleed and crop marks for professional printing.
77425. **Iframe widget snippets** — Every chart generates a copy-paste iframe snippet for intranet embedding.
77426. **Signed embed URLs** — Embeds use signed, expiring URLs so no login is required but access is controlled.
77427. **Widget refresh intervals** — Embeds auto-refresh at configurable intervals of 1, 5, or 15 minutes.
77428. **Widget with theme parameter** — URL parameter forces light or dark theme in the embed.
77429. **Widget with filter parameters** — URL parameters preset target, severity, and date filters in the embed.
77430. **Embeddable severity donut widget** — Standalone donut widget with drill-down working inside the iframe.
77431. **Embeddable burndown widget** — Standalone burndown widget for status pages.
77432. **Embeddable SLA gauge widget** — Standalone gauge widget for operations-style displays.
77433. **Widget with size presets** — Small, medium, and large responsive sizes for embeds.
77434. **Embed access logs** — Logs every embed view with referrer for audit.
77435. **Widget with no-JS fallback** — Embeds render a static image when JavaScript is disabled.
77436. **Widget revocation** — Revoking a signed URL instantly disables all its embeds.
77437. **Widget with SSO passthrough** — Embeds respect the viewer's SSO session for personalized data.
77438. **Embeddable sparkline strip widget** — Standalone sparkline strip for weekly status pages.
77439. **Widget with custom CSS hooks** — Documented CSS classes let hosts restyle embeds.
77440. **Widget performance budgets** — Embeds lazy-load and stay under a documented kilobyte budget.
77441. **Embeddable kanban widget** — Read-only kanban embed for stakeholder pages.
77442. **Widget with language parameter** — URL parameter localizes embed labels.
77443. **Embeddable radar widget** — Standalone radar comparison widget.
77444. **Widget with click-through** — Clicking an embed element deep-links to the full dashboard.
77445. **Embeddable map widget** — Standalone geographic target map embed.
77446. **Widget with height auto-resize** — Embeds postMessage their height to the host page.
77447. **Embeddable waterfall widget** — Standalone cost waterfall embed for finance pages.
77448. **Widget with data-only mode** — Returns JSON instead of rendering for custom front ends.
77449. **Embeddable sunburst widget** — Standalone tech-stack sunburst embed.
77450. **Widget with offline snapshot** — Embeds can pin to a data snapshot instead of live data.
77451. **Embeddable scatter widget** — Standalone scatter plot embed with tooltips.
77452. **Widget with domain allowlist** — Embeds only render on allowlisted domains.
77453. **Embeddable meter panel widget** — Standalone enrichment-coverage meter panel.
77454. **Widget gallery (visualization)** — A gallery page previews every embeddable widget with its snippet.
77455. **Logo injection for charts** — White-label settings inject the client logo into every exported chart header.
77456. **Custom palette per client** — Each client profile stores a brand palette applied to all their report charts.
77457. **Font control for exports** — Clients set the typeface used in their exported charts and PDFs.
77458. **White-label chart footers** — Footers show the client's name and confidentiality notice instead of product branding.
77459. **Per-client chart templates** — Saved chart arrangements per client reused across their reports.
77460. **White-label color-contrast check** — Validates client palettes against WCAG contrast before applying.
77461. **Client-specific severity colors** — Lets clients remap severity colors to their internal standards.
77462. **White-label embed themes** — Embedded widgets adopt the client's theme automatically.
77463. **White-label PDF covers** — Report PDFs get client-branded cover pages with matching chart styles.
77464. **White-label watermark options** — Per-client watermark text and opacity for draft exports.
77465. **White-label chart titles** — Title templates use client terminology such as observations versus findings.
77466. **White-label locale defaults** — Per-client default language and date formats for charts.
77467. **White-label export presets** — Per-client saved export presets for size, format, and theme.
77468. **White-label redaction rules** — Per-client rules for which fields are redacted in shared charts.
77469. **White-label dashboard skins** — Full dashboard skin per client including chart chrome.
77470. **White-label email charts** — Scheduled emails render charts in the client's branding.
77471. **White-label gauge zones** — Per-client SLA gauge zone colors and thresholds.
77472. **White-label map styling** — Geographic maps use client brand colors for pins and regions.
77473. **White-label annotation styles** — Annotation pins and callouts match client branding.
77474. **White-label chart disclaimers** — Per-client disclaimer text appended under exported charts.
77475. **White-label multi-brand switcher** — Consultants switch brands per report with one dropdown.
77476. **White-label chart QA preview** — Previews every chart in client branding before report generation.
77477. **White-label SVG metadata** — Exported SVGs carry the client name in metadata, not the product's.
77478. **White-label print styles** — Print stylesheets use client branding for black-and-white reports.
77479. **White-label widget chrome** — Embed frames show client branding instead of product branding.
77480. **White-label sparkline colors** — Sparkline palettes follow the client brand.
77481. **White-label burndown styling** — Burndown ideal and actual lines use client brand colors.
77482. **White-label radar styling** — Radar polygons use client brand colors with legend in client terms.
77483. **White-label export filenames** — Exported files use client naming conventions automatically.
77484. **White-label brand audit** — Scans a report for any remaining product branding before delivery.
77485. **Live finding ticker** — A scrolling ticker shows findings the moment the agent validates them.
77486. **WebSocket chart updates** — Charts subscribe to hunt events and update without page refresh.
77487. **Streaming severity donut** — The donut animates segment growth as new findings arrive.
77488. **Live scan-progress bars** — Per-target progress bars stream completion percentages during scanning.
77489. **Real-time token-burn meter** — A meter streams cumulative token consumption with a projected total.
77490. **Streaming sparkline ticks** — Sparklines append live points as findings are discovered.
77491. **Live agent-activity feed** — A feed chart shows each sub-agent's current task with elapsed time.
77492. **Streaming map pins** — New target pins drop onto the geographic map as recon discovers them.
77493. **Live throughput graph** — Graphs requests per second from the agent with a 60-second rolling window.
77494. **Streaming burndown** — The burndown's actual line extends live during remediation sprints.
77495. **Live error-rate chart** — Charts task failure rate per agent in real time with alert thresholds.
77496. **Streaming cost ticker** — Shows live spend with per-phase breakdown updating each minute.
77497. **Live queue-depth gauge** — Gauges pending tasks, enrichment jobs, and verification queues.
77498. **Streaming phase timeline** — The swimlane diagram grows live as phases start and finish.
77499. **Live validation pipeline bars** — Bars show findings moving through validation stages in real time.
77500. **Streaming anomaly alerts** — Anomalies detected in live metrics pop as annotated markers on charts.
77501. **Live coverage dial** — Dial streams endpoint coverage percentage as the scan progresses.
77502. **Streaming log-volume chart** — Charts agent log volume per minute to spot runaway loops.
77503. **Live PoC-generation tracker** — Tracks PoC artifacts generated per finding in real time.
77504. **Streaming enrichment meter** — Enrichment coverage meters fill live as enrichments complete.
77505. **Live hunt-health score** — A composite health score streams with contributing factor bars.
77506. **Streaming duplicate-detection** — Shows duplicates merged per hour as a live bar series.
77507. **Live false-positive rate** — Streams the triage false-positive rate with a target band.
77508. **Streaming API-latency chart** — Charts model-API latency percentiles (p50 and p95) live.
77509. **Live checkpoint countdown** — Countdown widgets to the next scheduled checkpoint with progress rings.
77510. **Streaming finding-age histogram** — Histogram of open-finding ages updates as time passes.
77511. **Live multi-hunt wall** — A wall of mini live charts, one per active hunt.
77512. **Streaming export snapshots** — One click captures the current live state as a static PNG.
77513. **Live chart pause** — Pauses streaming on any chart to inspect a moment, with resume.
77514. **Streaming backpressure indicator** — Indicates when the event stream is throttled, with dropped-event counts.
77515. **Breadcrumb drill navigation** — Every drill-down chart shows breadcrumbs (program, hunt, target, endpoint) with one-click jumps.
77516. **Cross-chart filtering** — Selecting a segment in one chart filters all other charts on the dashboard.
77517. **Drill-to-finding drawer** — Drilling to the lowest level opens a side drawer with the full finding details.
77518. **Drill path history** — Back and forward buttons walk through the user's drill history.
77519. **Multi-level donut drilling** — Donuts support unlimited drill levels with a reset control.
77520. **Drill-down with preserved filters** — Global filters persist as the user drills deeper.
77521. **Chart-to-table drill** — Clicking any chart element opens the filtered findings table.
77522. **Drill-down URL encoding** — The full drill path is encoded in the URL for sharing exact views.
77523. **Contextual drill menus** — Right-clicking a chart element offers drill options by target, CWE, or endpoint.
77524. **Drill-down animations** — Smooth zoom transitions between drill levels orient the user.
77525. **Drill-to-timeline** — From a chart segment, jumps to the swimlane filtered to that segment's events.
77526. **Drill-to-map** — From a chart segment, jumps to the geographic map filtered to matching targets.
77527. **Drill comparison** — Pins the current drill level while opening a second for side-by-side comparison.
77528. **Drill-down with counts** — Every drill option shows the finding count it would reveal.
77529. **Keyboard drill navigation** — Enter drills in and Backspace drills out, with focus management.
77530. **Drill-down on touch devices** — Tap-and-hold opens drill menus optimized for touch.
77531. **Drill-to-diff** — Drills into a comparison of the segment across two hunts.
77532. **Drill-down with export** — Exports the data at the current drill level as CSV.
77533. **Drill-level bookmarks** — Bookmarks a specific drill depth for one-click return.
77534. **Drill-down with annotation context** — Annotations made at deeper levels surface when drilling back up.
77535. **Drill-to-enrichment** — From a finding segment, jumps to its enrichment coverage detail.
77536. **Drill-down performance** — Drill queries use pre-aggregated cubes to stay under 200 milliseconds.
77537. **Drill-to-cost** — From any segment, jumps to the cost waterfall filtered to that scope.
77538. **Drill-down with search** — A search box within drilled views filters without losing drill context.
77539. **Drill-to-SLA** — From a severity segment, jumps to the SLA gauges for those findings.
77540. **Drill-down empty states** — Empty drill levels explain why, such as no criticals on this target.
77541. **Drill-to-remediation** — From a finding segment, jumps to its burndown and ticket status.
77542. **Drill-down with multi-select** — Select multiple segments to drill into their union.
77543. **Drill-path sharing** — Shares a drill path as a link that replays the drill steps.
77544. **Drill-down audit trail** — Logs drill navigation for usage analytics on chart design.
77545. **Hunt-to-hunt diff bars** — Diverging bars show finding-count changes per vuln class between two hunts.
77546. **Before/after remediation diff** — Compares the severity mix before and after a remediation sprint.
77547. **Diff with added/removed lists** — Lists findings added and resolved between hunts beside the chart.
77548. **Target-to-target diff** — Compares two targets' severity profiles with a mirrored bar layout.
77549. **Diff donut overlay** — Overlays the previous hunt's donut outline on the current donut.
77550. **Diff with significance flags** — Flags changes exceeding a statistical significance threshold.
77551. **Time-window diff** — Compares any two arbitrary date ranges with the same chart set.
77552. **Diff with drill-down** — Clicking a changed bar drills into the specific findings behind the delta.
77553. **Config-change diff** — Diffs scan configuration between hunts alongside result diffs.
77554. **Diff export for reviews** — Exports the diff view as a one-page PDF for change reviews.
77555. **Scope-change aware diff** — Normalizes diffs when scope changed between hunts, with a scope-change banner.
77556. **Diff with waterfall layout** — Waterfall shows how the previous total bridges to the current total.
77557. **Diff with severity migration** — Shows findings that changed severity between hunts as flow ribbons.
77558. **Diff with false-positive adjustment** — Toggle excludes false positives from both sides of the diff.
77559. **Diff with annotation** — Analysts annotate diffs with explanations such as WAF deployed.
77560. **Diff with per-endpoint detail** — Endpoint-level diff table shows added and removed endpoints.
77561. **Diff with tech-stack changes** — Pairs finding diffs with detected stack changes.
77562. **Diff with cost comparison** — Compares cost per finding between the two hunts.
77563. **Diff with SLA impact** — Shows how the diff affected SLA compliance.
77564. **Diff with trend context** — Embeds the diff in a longer trend line for context.
77565. **Diff with share link** — Shareable URL preserves the two compared hunts and filters.
77566. **Diff with regression alerts** — Alerts when a previously fixed vuln class reappears.
77567. **Diff with new-surface callout** — Calls out findings on endpoints that did not exist before.
77568. **Diff with confidence weighting** — Weights diffs by finding confidence to avoid noise.
77569. **Diff CSV export** — Exports added, removed, and changed findings as CSV.
77570. **Diff with visual regression** — Highlights chart regions with the largest visual change.
77571. **Diff with hunt-notes comparison** — Side-by-side hunt notes explain methodological differences.
77572. **Diff with benchmark context** — Shows whether the change moved the program toward or away from benchmark.
77573. **Diff with scheduled generation** — Auto-generates the diff when a hunt completes against the previous one.
77574. **Diff with approval sign-off** — Diffs require reviewer sign-off before the new baseline is set.
77575. **CVSS score histogram** — Histogram of findings across 0.1-wide CVSS bins with severity zone shading.
77576. **Finding-age histogram** — Histogram of open-finding ages with an SLA-deadline marker line.
77577. **Dwell-time histogram** — Histogram of time from discovery to remediation per finding.
77578. **Histogram with bin-size control** — Slider adjusts bin width with live re-rendering.
77579. **Endpoint finding-count histogram** — Histogram of findings per endpoint to reveal concentration.
77580. **Histogram with overlay curve** — Overlays a fitted distribution curve with goodness-of-fit readout.
77581. **Histogram with brush selection** — Brushing bins filters the findings table to that range.
77582. **Histogram with comparison overlay** — Overlays the previous hunt's histogram in outline form.
77583. **Response-time histogram** — Histogram of triage response times with percentile markers.
77584. **Histogram with log-y toggle** — Switches the count axis to logarithmic for long tails.
77585. **Token-usage histogram** — Histogram of tokens consumed per sub-agent task.
77586. **Histogram with outlier bins** — Bins beyond three standard deviations are colored distinctly and listed on click.
77587. **Exploitability histogram** — Histogram of exploitability scores with a likely-exploitable threshold line.
77588. **Histogram with cumulative line** — Secondary axis shows the cumulative percentage curve.
77589. **Histogram with drill-to-bin** — Clicking a bin lists the findings in that range.
77590. **Histogram CSV export** — Exports bin edges and counts as CSV.
77591. **Confidence-score histogram** — Histogram of agent confidence scores to calibrate trust.
77592. **Histogram with faceting** — Small-multiple histograms faceted by severity or target.
77593. **Histogram with annotation** — Analysts annotate bins such as bulk import.
77594. **Histogram with kernel-density toggle** — Switches bars to a smoothed density estimate.
77595. **Cost-per-finding histogram** — Histogram of attributed cost per finding.
77596. **Histogram with target bands** — Shades the acceptable range such as response time under 24 hours.
77597. **Histogram with print export** — High-DPI export with labeled bins.
77598. **Histogram with time animation** — Animates the histogram building up over the hunt.
77599. **Re-open count histogram** — Histogram of how many times findings were re-opened.
77600. **Histogram with statistical summary** — Header shows mean, median, standard deviation, and skew.
77601. **Histogram with comparison stats** — Shows the statistical distance to the previous hunt's distribution.
77602. **Histogram with saved bin presets** — Saves bin configurations as named presets.
77603. **Scan-duration histogram** — Histogram of per-target scan durations to spot outliers.
77604. **Histogram with accessibility table** — Data table mirrors bins for screen readers.
77605. **CWE hierarchy tree** — Expandable tree of CWE categories to weaknesses to findings with counts.
77606. **Dependency tree view** — Tree of application dependencies with vulnerability badges on nodes.
77607. **Endpoint path tree** — Tree of URL paths with finding counts aggregated at each branch.
77608. **Tree with search-and-expand** — Searching auto-expands the tree to matching nodes.
77609. **Tree with severity badges** — Each node shows the worst severity in its subtree as a badge.
77610. **Tree with lazy loading** — Large trees load children on expand to stay responsive.
77611. **Decision tree for triage** — Visual decision tree guiding analysts through triage questions.
77612. **Tree with diff highlighting** — Nodes added or removed since the last hunt are highlighted.
77613. **Tree with export** — Exports the tree as an indented text or CSV outline.
77614. **Tree with multi-select** — Select multiple nodes to bulk-filter findings.
77615. **Tree with node tooltips** — Hovering shows node metadata such as counts, severities, and ages.
77616. **Tree with collapse-all** — One click collapses to top level, and remembers expanded state.
77617. **Tree with finding preview** — Clicking a leaf node previews its findings in a side panel.
77618. **Tree with risk aggregation** — Parent nodes show summed risk scores of their children.
77619. **Tree with icon coding** — Node icons encode type such as framework, library, or endpoint.
77620. **Tree with keyboard navigation** — Arrow-key navigation with type-ahead search.
77621. **Tree with print rendering** — Print stylesheet renders the full expanded tree.
77622. **Tree with depth control** — Slider limits visible depth for huge trees.
77623. **Tree with node pinning** — Pins important nodes to the top regardless of hierarchy.
77624. **Tree with change log** — Each node shows when it was added or last changed.
77625. **Tree with density stripes** — Subtle stripes on nodes encode finding density without a separate chart.
77626. **Tree with linked sunburst** — Selecting a tree node highlights the matching sunburst segment.
77627. **Tree with bulk actions** — Right-click menus offer bulk triage actions per subtree.
77628. **Tree with URL deep-links** — Each node has a shareable URL.
77629. **Tree with confidence shading** — Low-confidence detections render with dashed borders.
77630. **Tree with version comparison** — Shows version changes per node between hunts.
77631. **Tree SVG export** — Renders the tree as a vector diagram.
77632. **Tree with annotation** — Analysts pin notes to nodes.
77633. **Tree with filter chips** — Chips filter nodes by severity or vuln class.
77634. **Tree with summary bar** — A bar above the tree summarizes visible versus total nodes.
77635. **Hunt calendar** — Month view showing scheduled, active, and completed hunts as colored blocks.
77636. **SLA deadline calendar** — Each day shows findings due that day, colored by severity.
77637. **Calendar with drill-down** — Clicking a day lists the hunts or findings for that date.
77638. **Remediation calendar** — Shows planned patch windows and releases as calendar events.
77639. **Calendar with density dots** — Dots under each day encode finding volume discovered that day.
77640. **Calendar with drag-to-reschedule** — Drags hunt blocks to reschedule with conflict warnings.
77641. **Calendar with team overlays** — Overlays team availability and on-call rotations.
77642. **Calendar ICS export** — Exports SLA deadlines and hunt schedules as calendar feeds.
77643. **Calendar with week/day views** — Switches between month, week, and day granularities.
77644. **Calendar with search** — Searching highlights matching events across months.
77645. **Checkpoint calendar** — Marks scheduled agent checkpoints as calendar events.
77646. **Calendar with timezone support** — Renders events in the viewer's timezone with conversions.
77647. **Calendar with recurrence** — Supports recurring hunts such as weekly or monthly with series editing.
77648. **Calendar with conflict detection** — Warns when hunts overlap on the same targets.
77649. **Calendar with print layout** — Print-optimized month view for pinning on walls.
77650. **Calendar with filtering** — Filters events by hunt, team, or severity.
77651. **Calendar with aging view** — Colors days by the oldest open finding's age.
77652. **Calendar with milestone markers** — Marks program milestones such as audits and releases distinctly.
77653. **Calendar with API sync** — Two-way sync with Google Calendar for hunt schedules.
77654. **Calendar with notifications** — Reminds owners of upcoming SLA deadlines.
77655. **Calendar with capacity view** — Shows scheduled scan load per day to avoid overloading targets.
77656. **Calendar with historical scrub** — Scrubs back through months of hunt history.
77657. **Calendar with keyboard navigation** — Arrow keys move between days and events.
77658. **Calendar with event details drawer** — Clicking an event opens details without leaving the calendar.
77659. **Calendar with bulk scheduling** — Schedules multiple hunts across targets in one flow.
77660. **Calendar with blackout dates** — Marks freeze periods where no scanning may run.
77661. **Calendar PNG export** — Exports the month view as an image for slides.
77662. **Calendar with shared links** — Shares a read-only calendar view via signed URL.
77663. **Calendar with SLA risk shading** — Days shade redder as more deadlines cluster on them.
77664. **Calendar with audit trail** — Logs every schedule change with actor and reason.
77665. **Budget-flow Sankey** — Flows budget from program to hunts to phases to cost categories as band widths.
77666. **Token-flow Sankey** — Flows token consumption from hunt to sub-agent to model with proportional bands.
77667. **Enrichment-flow Sankey** — Flows findings through enrichment stages showing drop-off at each stage.
77668. **Request-flow Sankey** — Flows agent HTTP requests by target to endpoint category to response class.
77669. **Time-allocation Sankey** — Flows total hunt time into phases and sub-tasks proportionally.
77670. **Finding-state Sankey** — Flows findings between triage states over a selected period.
77671. **Sankey with hover values** — Hovering a band shows exact values and percentages.
77672. **Sankey with node drill-down** — Clicking a node filters the findings behind that flow.
77673. **Sankey with time scrubber** — Scrubs the Sankey through the hunt to watch flows evolve.
77674. **Sankey SVG export** — Exports the diagram as a vector graphic.
77675. **Sankey with threshold pruning** — Hides flows below a configurable threshold to reduce clutter.
77676. **Sankey with comparison mode** — Overlays two hunts' flows with delta coloring.
77677. **Data-flow Sankey** — Flows discovered data types such as PII, credentials, and tokens from endpoints to storage.
77678. **Sankey with band labels** — Labels show values on major bands without hover.
77679. **Sankey with node search** — Searching highlights matching nodes and their flows.
77680. **Sankey with print layout** — Print-optimized rendering with labeled bands.
77681. **Sankey with cycle detection** — Highlights findings that looped back to earlier states.
77682. **Sankey with cost coloring** — Colors bands by cost efficiency such as findings per dollar.
77683. **Sankey with stage timing** — Annotates bands with median time spent in each transition.
77684. **Sankey CSV export** — Exports node-to-node flow values as CSV.
77685. **Sankey with anomaly bands** — Bands with anomalous volume render with a warning pattern.
77686. **Sankey with multi-period view** — Small multiples of the Sankey per quarter.
77687. **Sankey with accessibility table** — Data table mirrors flows for screen readers.
77688. **Sankey with node pinning** — Pins key nodes to fixed positions across renders.
77689. **Sankey with filter chips** — Chips filter flows by severity or target.
77690. **Sankey with share link** — Shareable URL preserves node selection and filters.
77691. **Sankey with white-label theme** — Adopts client branding in exports.
77692. **Sankey with real-time updates** — Bands resize live during active hunts.
77693. **Sankey with drill-to-table** — Clicking a band opens the underlying records table.
77694. **Sankey with annotation** — Analysts annotate bands with explanations.
77695. **CWE tag cloud** — Sizes CWE labels by finding count, colored by maximum severity, clickable to filter.
77696. **Parameter-name cloud** — Sizes parameter names by how often they appear in findings.
77697. **Cloud with stop-word control** — Excludes noise terms from clouds via a managed list.
77698. **Endpoint-token cloud** — Sizes URL path tokens by finding frequency to spot weak areas.
77699. **Cloud with severity coloring** — Each term colored by its worst linked severity.
77700. **Cloud with click-to-filter** — Clicking a term filters the findings table instantly.
77701. **Cloud with time scrubber** — Scrubs the cloud through hunt history watching terms grow.
77702. **Cloud with comparison mode** — Two clouds side by side compare term frequency across hunts.
77703. **Header-name cloud** — Sizes HTTP header names by finding association.
77704. **Cloud PNG export** — Exports the cloud as an image for reports.
77705. **Cloud with max-terms slider** — Controls how many terms render to avoid clutter.
77706. **Cloud with tooltip counts** — Hovering shows exact counts and example findings.
77707. **Technology-term cloud** — Sizes detected technology terms by endpoint coverage.
77708. **Cloud with stemming** — Groups morphological variants such as auth and authn into one term.
77709. **Cloud with exclusion list** — Per-user exclusion lists hide irrelevant terms.
77710. **Cloud with drill-to-findings** — Clicking opens the findings containing that term.
77711. **Cloud with trend arrows** — Arrows show whether each term is rising or falling.
77712. **Cloud with print layout** — High-contrast print rendering of the cloud.
77713. **Error-message cloud** — Sizes distinctive error strings by occurrence to spot information leaks.
77714. **Cloud with language filter** — Filters terms by detected language for internationalization issues.
77715. **Cloud with accessibility list** — Ranked term list mirrors the cloud for screen readers.
77716. **Cloud with saved views** — Saves term-set and filter combinations as named views.
77717. **Cookie-name cloud** — Sizes cookie names by finding association for session issues.
77718. **Cloud with co-occurrence** — Hovering a term highlights terms that co-occur in the same findings.
77719. **Cloud CSV export** — Exports term frequencies as CSV.
77720. **Cloud with white-label fonts** — Cloud typeface follows client branding.
77721. **Cloud with rotation control** — Toggles term rotation for denser layouts.
77722. **Cloud with search highlight** — Searching highlights matching terms.
77723. **Cloud with share link** — Shareable URL preserves term set and filters.
77724. **Attack-pattern chip strip** — Visualizes observed attack-pattern categories as sized chips with severity coloring, clickable to filter findings.
77725. **Per-target mini-donut grid** — A grid of mini severity donuts, one per target, with a shared legend.
77726. **Per-hunt mini-burndown grid** — Mini burndowns for every hunt in the program on one screen.
77727. **Trellis with shared axes** — All small multiples share axis scales for honest comparison.
77728. **Trellis with independent axes** — Toggle lets each multiple use its own scale.
77729. **Per-vuln-class mini-sparkline grid** — Grid of sparklines faceted by vuln class.
77730. **Trellis sorting** — Sorts multiples by total, trend, or worst metric.
77731. **Trellis with sparklines in headers** — Each multiple's header carries its own sparkline.
77732. **Per-team mini-gauge grid** — Mini SLA gauges per team in a sortable grid.
77733. **Trellis with click-to-expand** — Clicking a multiple expands it to full size with details.
77734. **Trellis with pagination** — Paginates large grids of 100-plus targets with page controls.
77735. **Per-endpoint mini-histogram grid** — Mini histograms of finding counts per endpoint group.
77736. **Trellis with filter chips** — Chips filter which multiples are shown.
77737. **Trellis with export** — Exports the whole grid as one PNG or PDF page.
77738. **Per-quarter mini-radar grid** — Mini radars per quarter showing capability evolution.
77739. **Trellis with anomaly badges** — Multiples with anomalies get a badge in their corner.
77740. **Trellis with consistent coloring** — Shared color scale across all multiples.
77741. **Per-service mini-scatter grid** — Mini scatters of age versus severity per service.
77742. **Trellis with drill-down** — Drilling inside one multiple keeps the grid context.
77743. **Trellis with comparison overlay** — Each multiple overlays the program average in gray.
77744. **Per-agent mini-timeline grid** — Mini swimlanes per sub-agent.
77745. **Trellis with empty-state cards** — Targets with no findings show informative empty cards.
77746. **Trellis with search** — Searching highlights matching multiples.
77747. **Per-region mini-chart grid** — Mini bar charts of severity mix per geographic region.
77748. **Trellis with URL state** — Grid sort, filter, and selection encoded in the URL.
77749. **Trellis with print layout** — Paginated print rendering of the grid.
77750. **Per-sprint mini-burndown grid** — Mini burndowns per remediation sprint.
77751. **Trellis with live updates** — Multiples update live during active hunts.
77752. **Trellis with white-label theme** — Grid adopts client branding.
77753. **Trellis with keyboard navigation** — Arrow keys move between multiples.
77754. **Trellis with summary row** — A summary multiple aggregates the whole grid.
77755. **Drag-and-drop dashboard grid** — Users arrange chart widgets on a responsive grid with drag and resize.
77756. **Dashboard presets (visualization)** — One-click presets for triage focus, remediation focus, and cost focus arrange curated widgets.
77757. **Dashboard snapshotting** — Saves the full dashboard state including layout, filters, and drill as a named snapshot.
77758. **Dashboard version history (visualization)** — Tracks layout changes with restore points.
77759. **Widget library (visualization)** — A searchable library of every chart widget for adding to dashboards.
77760. **Dashboard templates** — Shareable templates let teams start from proven layouts.
77761. **Dashboard permissions (visualization)** — Per-dashboard view and edit permissions for teams.
77762. **Dashboard with global filters** — Date, target, and severity filters apply to every widget at once.
77763. **Dashboard auto-refresh (visualization)** — Configurable refresh intervals per dashboard.
77764. **Dashboard with TV mode** — Fullscreen, auto-rotating dashboard for wall displays.
77765. **Dashboard cloning** — Duplicates a dashboard with its layout and filters.
77766. **Dashboard with annotations layer** — Dashboard-wide annotations visible across widgets.
77767. **Dashboard export to PDF (visualization)** — Renders the whole dashboard as a paginated PDF.
77768. **Dashboard with widget linking** — Clicking a widget can navigate to another dashboard with context.
77769. **Dashboard search (visualization)** — Searches widget titles and data across dashboards.
77770. **Dashboard with dark mode** — Per-dashboard theme override.
77771. **Dashboard activity log** — Logs who viewed or edited each dashboard.
77772. **Dashboard with scheduled email** — Emails a rendered dashboard image on schedule.
77773. **Dashboard with mobile layout** — Separate simplified layout for phones.
77774. **Dashboard with widget refresh indicators** — Spinners show which widgets are loading.
77775. **Dashboard with data freshness** — Header shows when each widget's data was last updated.
77776. **Dashboard with fullscreen widgets** — Any widget expands to fullscreen with one click.
77777. **Dashboard with keyboard shortcuts** — Shortcuts for refresh, fullscreen, and filter focus.
77778. **Dashboard with public links** — Signed public links share read-only dashboards externally.
77779. **Dashboard with embedded filters UI** — Filter controls can be embedded alongside widgets.
77780. **Dashboard with widget-level permissions** — Sensitive widgets hide for unauthorized viewers.
77781. **Dashboard with usage analytics** — Shows which widgets get viewed and clicked.
77782. **Dashboard with alert rules** — Widget thresholds trigger alerts such as criticals above five.
77783. **Dashboard with comparison mode** — Duplicates the dashboard to compare two time ranges side by side.
77784. **Dashboard with guided tours** — Step-by-step tours explain each widget to new users.
77785. **Chart annotation pins** — Analysts pin timestamped notes directly onto any chart.
77786. **Annotation threads (visualization)** — Pins support reply threads for discussion.
77787. **Annotation with mentions** — At-mentions notify teammates from an annotation.
77788. **Annotation visibility controls** — Annotations can be private, team-visible, or client-visible.
77789. **Guided chart stories** — Authors build step-by-step narratives that highlight chart regions in sequence.
77790. **Story playback** — Stories play as an animated walkthrough with captions.
77791. **Annotation search** — Searches annotation text across all charts.
77792. **Annotation export** — Exports include or exclude annotations per a toggle.
77793. **Callout boxes** — Drag-and-drop callouts highlight chart areas with text.
77794. **Annotation with attachments** — Pins accept screenshots and file attachments.
77795. **Annotation versioning (visualization)** — Edits to annotations keep a version history.
77796. **Annotation notifications** — Subscribers get notified of new annotations on watched charts.
77797. **Story templates** — Templates for common narratives such as hunt recap and incident review.
77798. **Annotation with severity tags** — Pins carry severity tags for filtering.
77799. **Chart highlight regions** — Shaded regions with labels mark areas of interest.
77800. **Annotation moderation** — Client-visible annotations require approval.
77801. **Story sharing** — Stories share via link with playback controls.
77802. **Annotation with timestamps** — Pins anchor to data timestamps, surviving data refreshes.
77803. **Annotation bulk actions** — Bulk-resolve or bulk-export annotations.
77804. **Story export to video** — Exports the story walkthrough as an MP4.
77805. **Annotation with emoji reactions** — Quick reactions on pins for lightweight agreement.
77806. **Annotation count badges** — Charts with many annotations show a badge count.
77807. **Story with branching** — Stories branch based on viewer choices such as seeing cost detail.
77808. **Annotation with due dates** — Pins can carry follow-up due dates with reminders.
77809. **Chart watermark notes** — Draft-state watermarks on charts pending review.
77810. **Annotation with linked findings** — Pins link directly to related findings.
77811. **Story analytics** — Tracks which story steps viewers watch.
77812. **Annotation with translation** — Annotations auto-translate for multilingual teams.
77813. **Chart caption generator** — Auto-generates plain-English captions describing each chart.
77814. **Annotation with audit log** — Every annotation action is logged for compliance.
77815. **Colorblind-safe palettes (visualization)** — All charts default to palettes verified for deuteranopia, protanopia, and tritanopia.
77816. **Pattern-fill mode** — Replaces color coding with hatch patterns for monochrome-safe charts.
77817. **High-contrast theme (visualization)** — A theme meeting WCAG AAA contrast for all chart text and elements.
77818. **Reduced-motion mode (visualization)** — Disables chart animations for users with motion sensitivity.
77819. **Screen-reader chart summaries** — Every chart exposes an auto-generated textual summary.
77820. **Keyboard-operable charts** — All chart interactions such as drill, filter, and hover work via keyboard.
77821. **Chart data tables (visualization)** — Every chart has a toggleable data-table view.
77822. **Focus indicators (visualization)** — Visible focus rings on all interactive chart elements.
77823. **Text scaling support** — Charts reflow correctly at 200 percent browser text scaling.
77824. **Dark-mode chart theme** — Full dark theme with re-tuned palettes, not just inverted colors.
77825. **Light-mode chart theme** — Optimized light theme with print-friendly defaults.
77826. **Custom theme builder (visualization)** — Builds and previews custom chart themes with live preview.
77827. **Theme per dashboard** — Each dashboard stores its own theme override.
77828. **Accessible tooltips** — Tooltips are focusable and announced by screen readers.
77829. **Chart alt-text editor** — Lets authors write custom alt text per chart.
77830. **Sonification toggle** — Renders chart data as audio tones for non-visual exploration.
77831. **Accessible color legends** — Legends include shapes and labels, not color alone.
77832. **Chart with dyslexia-friendly font** — Optional dyslexia-friendly typeface for chart labels.
77833. **Motion-duration controls** — Lets users set animation speed or disable it per chart.
77834. **Accessible export** — Exported SVGs include titles, descriptions, and data tables.
77835. **Chart with minimum target sizes** — Interactive elements meet 44-pixel touch-target minimums.
77836. **Screen-reader live regions** — Live charts announce updates via polite live regions.
77837. **Chart with text-only mode** — Renders any chart as a structured text summary.
77838. **Accessible gauge readouts** — Gauges expose value, minimum, maximum, and zone as text.
77839. **Chart with language direction** — Right-to-left layout support for chart labels and legends.
77840. **Accessible map alternatives** — Geographic maps include a list view of all pins.
77841. **Chart with zoom controls** — On-chart zoom buttons for low-vision users.
77842. **Accessible timeline** — Swimlanes include a linear event-list alternative.
77843. **Chart with contrast checker** — Built-in checker validates custom palettes against WCAG.
77844. **Accessibility conformance report** — Generates a VPAT-style report of chart accessibility features.
77845. **Responsive chart breakpoints** — Charts reflow through defined breakpoints from desktop to phone.
77846. **Touch-optimized tooltips** — Tap shows tooltips sized for fingers with easy dismissal.
77847. **Mobile chart carousel** — Dashboard widgets become a swipeable carousel on phones.
77848. **Touch drill-down** — Tap drills in, with a persistent back button for navigation.
77849. **Mobile-first gauge layout** — Gauges stack vertically with large readouts on small screens.
77850. **Responsive legend collapsing** — Legends collapse into a scrollable sheet on narrow screens.
77851. **Touch lasso selection** — Finger-drawn lasso selects scatter points on touch devices.
77852. **Mobile sparkline strip** — Sparkline strips scroll horizontally with snap points.
77853. **Responsive table-to-card** — Chart data tables become cards on phones.
77854. **Pinch-zoom charts** — Pinch gestures zoom time-series and scatter charts.
77855. **Mobile map gestures** — Geographic maps support native-feel pan, pinch, and double-tap zoom.
77856. **Mobile burndown simplification** — Burndowns show only actual versus ideal lines on small screens.
77857. **Responsive donut labels** — Donut labels move outside with leader lines on narrow screens.
77858. **Touch-friendly kanban** — Kanban cards drag with long-press on touch devices.
77859. **Mobile chart performance** — Charts render with reduced point counts on low-power devices.
77860. **Offline mobile charts** — Cached chart snapshots viewable without connectivity.
77861. **Mobile push-chart alerts** — Threshold breaches push a chart snapshot to the phone.
77862. **Responsive axis labels** — Axis labels thin out automatically to avoid overlap.
77863. **Mobile landscape mode (visualization)** — Rotating to landscape expands the active chart fullscreen.
77864. **Touch histogram brushing** — Two-finger brush selects histogram bins on touch.
77865. **Mobile widget reordering** — Drag handles reorder widgets in the mobile layout.
77866. **Responsive font scaling** — Chart fonts scale with viewport while staying legible.
77867. **Mobile chart sharing** — Native share sheet shares chart images from the phone.
77868. **Touch radar interaction** — Tap axes on radars to see exact values.
77869. **Mobile calendar swipe** — Swipe between months in the hunt calendar.
77870. **Responsive waterfall** — Waterfall charts switch to vertical layout on narrow screens.
77871. **Mobile tree navigation** — Trees become drill-down lists on phones.
77872. **Touch sunburst zoom** — Double-tap zooms sunburst segments on touch.
77873. **Mobile data saver (visualization)** — Data-saver mode loads static chart images instead of interactive ones.
77874. **Responsive embed sizing** — Embeds report their ideal height per breakpoint to hosts.
77875. **Pagination-aware charts** — Wide charts split across report pages with repeated headers.
77876. **Print DPI control** — Sets raster export resolution at 150, 300, or 600 DPI per report.
77877. **Black-and-white chart mode** — Converts all charts to pattern-and-grayscale for monochrome printing.
77878. **Print page-break controls** — Authors set preferred page breaks between report charts.
77879. **Chart footnotes in print** — Footnotes with data sources print beneath each chart.
77880. **Print table of charts** — Auto-generated list of charts with page numbers.
77881. **Print with repeated legends** — Legends repeat on each page of a split chart.
77882. **Print margin controls** — Sets chart margins to match report page margins.
77883. **Print with chart numbering** — Auto-numbers charts as Figure 1, Figure 2 with cross-references.
77884. **Print-safe color mode** — Verifies colors survive grayscale conversion before printing.
77885. **Print with data appendices** — Appends the underlying data tables after the chart section.
77886. **Print header/footer templates** — Report headers and footers wrap every chart page.
77887. **Print with confidentiality banners** — Classification banners print on every chart page.
77888. **Print with signature blocks** — Sign-off blocks print after the chart section.
77889. **Print with summary chart page** — A one-page chart summary leads the printed report.
77890. **Print with chart scaling** — Charts scale to fit page width without distortion.
77891. **Print with vector fidelity** — All charts print as vectors, never rasterized.
77892. **Print with duplex awareness** — Blank-page insertion keeps chapters on odd pages.
77893. **Print with paper-size presets** — A4, Letter, and Legal presets resize charts accordingly.
77894. **Print with ink-saving mode** — Reduces heavy fills for draft printing.
77895. **Print with chart alt-text** — Alt text prints as captions for accessibility in tagged PDF.
77896. **Print with revision history** — Revision table prints with the report charts.
77897. **Print with distribution list** — Distribution list page prints with the report.
77898. **Print with glossary** — Chart-term glossary prints as an appendix.
77899. **Print with QR codes** — QR codes under charts link to the live dashboard.
77900. **Print with watermark control** — Draft and confidential watermarks per print job.
77901. **Print with binding margins** — Extra inner margin for bound reports.
77902. **Print with chart bookmarks** — PDF bookmarks mirror the chart hierarchy.
77903. **Print with metadata** — PDF metadata such as title, author, and classification set per report.
77904. **Print with archival PDF/A** — Exports reports as PDF/A for long-term archiving.
77905. **Parallel-coordinates plot** — Plots each finding across parallel axes (CVSS, age, exploitability, cost) with brushing.
77906. **Chord diagram of CWE co-occurrence** — Chords show which CWE categories co-occur on the same endpoints.
77907. **Horizon charts for metrics** — Mirrored horizon bands show metric deviations compactly.
77908. **Streamgraph of vuln classes** — Stacked stream areas show vuln-class mix evolving over time.
77909. **Beeswarm plot of findings** — Beeswarm positions findings by CVSS with severity coloring, avoiding overlap.
77910. **Dendrogram of endpoints** — Clusters endpoints by finding similarity as a dendrogram.
77911. **Icicle chart of tech stack** — Rectangular icicle alternative to the sunburst for stack breakdown.
77912. **Marimekko chart** — Two-dimensional bars show severity mix by width and target share by height.
77913. **Box plots per vuln class** — Box plots show CVSS distribution per vuln class with outlier points.
77914. **Violin plots of remediation time** — Violins show remediation-time distribution per severity.
77915. **Gantt of remediation tasks** — Gantt bars per remediation ticket with dependencies.
77916. **Polar-area chart of phases** — Polar areas show time spent per hunt phase.
77917. **Nightingale rose of severities** — Rose chart shows severity counts with radius encoding.
77918. **Hexbin density plot** — Hexbins show finding density across age-versus-CVSS space.
77919. **Contour plot of risk** — Contours show risk-score density across the target portfolio.
77920. **Ridgeline plot of scan times** — Ridgelines show per-target scan-duration distributions.
77921. **Slope chart of hunt diffs** — Slope lines connect metric values between two hunts.
77922. **Dumbbell chart of SLA** — Dumbbells connect actual versus SLA-target remediation times per severity.
77923. **Arc diagram of shared components** — Arcs show which endpoints share vulnerable components.
77924. **Dot-matrix chart of findings** — Dot matrix shows findings as individual dots with severity coloring.
77925. **Waffle chart of severity mix** — Ten-by-ten grid where each square is one percent of findings.
77926. **Bullet chart of enrichment coverage** — Bullet bars show enrichment coverage versus targets.
77927. **Span chart of finding lifespans** — Horizontal spans show each finding's open duration.
77928. **Fan chart of forecasts** — Fan shows the burndown forecast widening over time.
77929. **Barcode chart of discoveries** — Barcode-like ticks show discovery events on a timeline.
77930. **Layered area of states** — Layered areas show finding-state populations over time.
77931. **Dot plot of benchmark gaps** — Dot plots show the gap to benchmark per metric with connecting lines.
77932. **Isotype pictogram charts** — Pictograms with one icon per N findings for non-technical audiences.
77933. **Span-bar of SLA windows** — Floating bars show each severity's SLA window against actuals.
77934. **Ternary plot of triage outcomes** — Ternary positions hunts by confirmed, false-positive, and duplicate mix.
77935. **Rollup aggregation engine** — Pre-computed rollups (hour, day, week by target by severity) power sub-second charts.
77936. **Pivot-chart builder** — Drag dimensions onto rows, columns, and values to build pivot charts.
77937. **Window-function time series** — Moving averages, cumulative sums, and period-over-period computed in-chart.
77938. **Hierarchical aggregation** — Aggregates respect the program, hunt, target, and endpoint hierarchy.
77939. **Distinct-count metrics** — Charts can count distinct endpoints, CWEs, or targets instead of findings.
77940. **Weighted aggregations** — Aggregates weight by CVSS, business impact, or custom weights.
77941. **Aggregation with confidence intervals** — Charts show confidence intervals on aggregated estimates.
77942. **Top-N with other bucket** — Top-N charts group the tail into an other segment automatically.
77943. **Aggregation caching** — Chart queries hit a cache with staleness indicators.
77944. **Real-time aggregation** — Streaming aggregations update charts as events arrive.
77945. **Aggregation with filters** — Global filters push down into aggregation queries.
77946. **Percent-of-total mode** — Any count chart toggles to percent-of-total.
77947. **Aggregation with time zones** — Daily buckets align to the viewer's timezone.
77948. **Fiscal-period aggregation** — Aggregates align to fiscal quarters for finance reporting.
77949. **Aggregation with sampling** — Huge datasets use deterministic sampling with sample-size labels.
77950. **Cohort aggregation** — Groups findings by discovery cohort such as week discovered for aging analysis.
77951. **Aggregation with exclusions** — Exclusions for false positives and duplicates apply consistently across charts.
77952. **Multi-metric aggregation** — Charts combine count, sum, and average in one view.
77953. **Aggregation with drill-through** — Aggregated cells drill through to raw records.
77954. **Scheduled aggregation jobs** — Nightly jobs rebuild rollups with run-status visibility.
77955. **Aggregation with data-quality flags** — Flags buckets with incomplete data.
77956. **Cross-program aggregation** — Aggregates across programs for portfolio charts.
77957. **Aggregation with currency conversion** — Cost aggregations convert at daily rates.
77958. **Aggregation with SLA bucketing** — Buckets findings by SLA status such as on-track, at-risk, and breached.
77959. **Aggregation with custom calendars** — Supports 4-4-5 retail calendars for reporting.
77960. **Aggregation explainability** — A why button shows the query behind any aggregated value.
77961. **Aggregation with versioning** — Rollup schema versions let charts pin to a definition.
77962. **Aggregation with backfill** — Backfills historical buckets when definitions change.
77963. **Aggregation with anomaly flags** — Flags aggregated buckets that deviate from expected.
77964. **Aggregation API** — REST and GraphQL API exposes every aggregation for custom charts.
77965. **Threshold-band charts** — Shaded bands mark acceptable ranges on any metric chart.
77966. **Traffic-light status tiles** — Red, amber, and green tiles summarize metric health at a glance.
77967. **Threshold-breach markers** — Markers pinpoint exactly when a metric crossed its threshold.
77968. **Alert-rule builder** — Visual builder creates threshold rules without code.
77969. **Threshold with hysteresis** — Alerts clear only when the metric recovers past a second threshold, shown on charts.
77970. **Multi-threshold gauges** — Gauges support warning and critical thresholds distinctly.
77971. **Threshold with snooze** — Snoozed alerts show a muted state on charts with resume time.
77972. **Alert timeline** — Timeline of all alert firings with linked charts.
77973. **Threshold with forecast** — Projects when a rising metric will breach its threshold.
77974. **Traffic-light rollup** — Rolls up tile states hierarchically from target to hunt to program.
77975. **Threshold with annotations** — Threshold changes are annotated on charts with actor and reason.
77976. **Alert with chart snapshot** — Alert notifications include a rendered chart snapshot.
77977. **Threshold with seasonality** — Thresholds adjust for known seasonal patterns, shown as wavy bands.
77978. **Alert acknowledgement** — Acknowledged alerts show an acknowledged state on charts.
77979. **Threshold with peer comparison** — Shows where your threshold sits versus peer programs.
77980. **Alert with drill-down** — Clicking an alert opens the chart filtered to the breach period.
77981. **Threshold with testing mode** — Simulates a threshold against history before activating.
77982. **Alert digest charts** — Daily digest includes mini charts of each alerted metric.
77983. **Threshold with escalation** — Escalation levels render as concentric zones on gauges.
77984. **Alert with correlation** — Shows other alerts firing at the same time for context.
77985. **Threshold with audit trail** — Logs every threshold change with before and after values.
77986. **Alert with mute windows** — Maintenance windows mute alerts, shown as shaded regions.
77987. **Threshold with machine-learning bands** — Machine-learning-derived dynamic bands replace static thresholds.
77988. **Alert with runbook link** — Alerts link to the relevant runbook from the chart.
77989. **Threshold with unit labels** — Thresholds always show units to prevent misreading.
77990. **Alert with severity mapping** — Alert severity maps to chart marker styles.
77991. **Threshold with bulk edit** — Bulk-edits thresholds across similar metrics.
77992. **Alert with trend context** — Alert cards include a 30-day trend sparkline.
77993. **Threshold with approval** — Production threshold changes require approval.
77994. **Alert with resolution tracking** — Tracks time-to-acknowledge and time-to-resolve per alert rule.
77995. **Faceted filter panel (visualization)** — Checkbox facets for severity, target, CWE, and state show live counts and filter all charts.
77996. **Visual query builder** — Builds complex filters with AND/OR blocks and previews matching finding counts.
77997. **Filter with chart preview** — Hovering a filter option previews its effect on charts before applying.
77998. **Saved filter sets** — Saves filter combinations as named sets shareable across the team.
77999. **Filter with URL encoding** — The full filter state lives in the URL for shareable filtered views.
78000. **Cross-filter brushing** — Brushing one chart applies a range filter to all others.
78001. **Filter with exclusion mode** — Alt-click excludes a value instead of including it.
78002. **Smart filter suggestions** — Suggests filters based on current chart anomalies such as filtering to stale criticals.
78003. **Filter with impact preview** — Shows how many findings each filter change adds or removes.
78004. **Filter reset with history** — One click resets filters, and a history dropdown restores previous states.
