## J. Business-logic flaws
0001. **Currency-switch price arbitrage** — switch checkout currency mid-session to exploit stale exchange-rate caches and pay less in a weaker currency.
0002. **Negative-quantity cart injection** — submit negative quantities so line-item math subtracts value and shrinks the order total.
0003. **Fractional-quantity rounding exploit** — add 0.5 or 0.1 quantities where the backend truncates decimals, underpaying per unit.
0004. **Client-side total override** — tamper the `total` field in the checkout POST because the server trusts client-calculated amounts.
0005. **Unit-price field tampering** — replay the add-to-cart request with a modified `price` parameter the server never re-validates.
0006. **Decimal-truncation at capture** — authorize $10.99 but capture $10.9 by exploiting float truncation between authorize and capture calls.
0007. **Price parameter in redirect URL** — alter the price embedded in payment-gateway redirect URLs that lack server-side verification.
0008. **Zero-price variant selection** — select a product variant whose price resolves to null or 0 when the variant ID is forged.
0009. **Currency-mismatch refund arbitrage** — pay in one currency and refund in another, profiting from rate drift between the two operations.
0010. **Discount-then-currency flip** — apply a percentage coupon in a high-value currency then switch locale so the absolute discount converts wrongly.
0011. **Tax-inclusive versus exclusive confusion** — toggle region so tax is treated as included then excluded, shaving the tax amount off the total.
0012. **Shipping-included price leak** — buy items priced with bundled shipping then switch to in-store pickup to pocket the shipping margin.
0013. **Bulk-tier boundary gaming** — add N+1 items so tier pricing recalculates the whole cart cheaper, then remove the extra item.
0014. **Price-freeze via stale cart** — keep an old cart session alive across a price increase so checkout honors the cached lower price.
0015. **Sale-plus-membership stacking** — combine a sale price with a member-tier discount that were never meant to compose.
0016. **Gift-wrap fee nullification** — set gift-wrap quantity high while its price field is tamperable, driving the total negative.
0017. **Add-on SKU price replay** — capture a $0 promotional add-on SKU and replay it on later orders after the promo ends.
0018. **Multi-currency wallet debit** — pay with a wallet denominated in currency A while the order is priced in B, exploiting the internal conversion rate.
0019. **Display-versus-charge drift** — the frontend shows a rounded price while the backend charges the unrounded value across currencies.
0020. **Pre-tax versus post-tax coupon** — reorder the calculation pipeline via parameter flags so discounts apply to the tax-inclusive base.
0021. **Negative discount injection** — pass a negative discount value that the backend adds instead of subtracting.
0022. **Free-shipping threshold manipulation** — inflate the cart with removable items to cross the free-shipping threshold, then remove them post-lock.
0023. **Localized price-list confusion** — request a region with lower list prices via header spoofing while shipping to a high-price region.
0024. **Price-match guarantee abuse** — submit a forged competitor price for an inflated item and collect the match plus loyalty points.
0025. **Introductory pricing retrigger** — cycle through plan changes that each re-trigger first-month introductory pricing.
0026. **Metered-usage under-reporting** — tamper the client-side usage beacon so metered billing counts fewer API calls or seats.
0027. **Overage rounding-down** — consume 1.9 overage units where the billing job floors to 1, systematically underpaying overages.
0028. **Price-drop adjustment looping** — buy before a sale, then trigger the price-adjustment policy repeatedly across overlapping windows.
0029. **Flash-sale cache lag** — hit the CDN-cached sale price after the sale ends because cache invalidation lags the price change.
0030. **Bundle component substitution** — swap a bundle's expensive component for a cheap one via the customize endpoint while keeping the bundle price.
0031. **Cross-border tax exemption fraud** — set a VAT-exempt business flag with an unvalidated VAT ID to strip tax from consumer orders.
0032. **Employee-discount code sharing** — brute-force or share single-use employee discount codes that lack per-user binding.
0033. **Student-discount verification bypass** — complete verification with disposable credentials then reuse the discount indefinitely.
0034. **Quote-to-order price lock** — modify the cart between the price-quote and order-commit steps to lock a lower quoted price.
0035. **Donation-amount perk unlock** — enter negative or zero donations tied to donor perks, unlocking perks without paying.
0036. **Dynamic-pricing context probing** — query the pricing engine with crafted contexts (location, device, time) to discover the minimum-price combination and replay it at checkout.
0037. **Coupon stacking via multiple fields** — apply one code in `coupon` and another in `promo_code` fields that validate independently.
0038. **Coupon reuse via case mutation** — redeem the same single-use code with different casing when comparison is case-sensitive but redemption is not.
0039. **Coupon reuse across accounts** — redeem a one-per-customer code on multiple accounts sharing one email alias.
0040. **Expired-coupon timezone replay** — use a code past expiry by hitting a region server still inside the valid window.
0041. **Coupon brute-force with prefix** — enumerate predictable coupon formats (e.g., SUMMER-XXXX) using the known prefix and checksum pattern.
0042. **Referral-code as coupon** — enter another user's referral code in the coupon field where both draw from the same validation table.
0043. **Gift-card code as coupon** — submit gift-card codes to the coupon endpoint that accepts any stored-value code type.
0044. **Coupon applied to gift cards** — buy gift cards with a coupon where terms forbid it, because cart-level discounts don't exclude stored-value SKUs.
0045. **Minimum-spend bypass** — add a gift card to reach the coupon's minimum spend, then the discount applies to the whole cart.
0046. **Shipping coupon on digital goods** — apply shipping coupons to digital-only carts to trigger fallback discounts that zero the total.
0047. **Over-value coupon credit** — use a fixed-amount coupon exceeding the cart total where no zero-floor turns the remainder into store credit.
0048. **Coupon reactivation after cancel** — cancel an order that consumed a single-use coupon and get the coupon reissued without invalidation.
0049. **Draft-order coupon cloning** — create multiple draft orders each locking the same single-use coupon before any converts.
0050. **Coupon on renewal invoices** — apply a first-order-only coupon to recurring renewals that reuse the initial order's discount snapshot.
0051. **Affiliate coupon self-attribution** — apply your own affiliate coupon to earn both the discount and the affiliate commission.
0052. **Coupon leakage via errors** — the validation endpoint reveals whether a code exists versus is expired, enabling oracle-based enumeration.
0053. **Timing-based coupon validation** — response-time differences between valid, invalid, and expired codes enable enumeration without rate limits.
0054. **Coupon region-lock bypass** — redeem a region-locked code by spoofing the billing country at redemption time.
0055. **BOGO on single item** — trigger buy-one-get-one logic with quantity 1 where the free item grants without the paid-counterpart check.
0056. **Percentage coupon on fees** — apply percentage coupons to non-discountable fees via line-item targeting parameters.
0057. **Coupon inheritance via share-link** — the share-cart link embeds the coupon so anyone opening it inherits a single-use discount.
0058. **Employee coupon reverse-engineering** — reverse the coupon-generation algorithm from observed codes to mint valid new ones.
0059. **Post-payment coupon injection** — inject a coupon into the post-payment adjustment endpoint that recalculates and refunds the difference.
0060. **Split-order coupon multiplication** — split one cart into N orders to apply a per-order coupon N times on the same items.
0061. **Price-match plus coupon dip** — combine an approved price-match adjustment with a coupon that should have been voided.
0062. **Points-to-coupon conversion loop** — convert points to coupons at a favorable rate, then refund the points-earning order while keeping the coupon.
0063. **Coupon on pre-order deposit** — apply full-value coupons to a small pre-order deposit, shrinking the balance due disproportionately.
0064. **Abandoned-cart coupon farming** — repeatedly abandon carts with throwaway emails to harvest unique retargeting coupons.
0065. **Welcome-coupon rotation** — re-register with email aliases to collect unlimited new-customer coupons.
0066. **Locale-switched coupon eligibility** — switch storefront locale to one where the coupon's terms render incorrectly, bypassing client-side eligibility checks.
0067. **Minimum-quantity bypass** — meet "buy 3 get 20% off" with 3 items then remove 2 in the same request batch the validator misses.
0068. **Cross-platform coupon stacking** — apply a mobile-only and a web-only coupon to the same synced account cart.
0069. **Tax-base coupon toggle** — force the discount onto the pre-tax versus post-tax subtotal by toggling the tax-display setting mid-checkout.
0070. **Self-referral discount use** — use your own referral link's discount on your own account when attribution checks only the code.
0071. **Coupon resurrection after refund** — refund an order and the coupon returns to the pool because the redemption record is deleted, not flagged.
0072. **Flash-coupon cache window** — redeem a limited-quantity coupon in the gap between campaign end and cache refresh.
0073. **Self-referral loop** — refer yourself with a second account and collect both the referrer reward and the referee bonus.
0074. **Referral cookie stuffing** — plant referral cookies via hidden iframes so organic signups attribute to your affiliate account.
0075. **Multi-account referral farming** — script account creation behind rotating emails to harvest per-referral payouts at scale.
0076. **Referral on existing users** — trigger the referral reward on pre-existing accounts by backdating the attribution event.
0077. **Affiliate self-purchase commission** — route your own purchases through your affiliate link where self-purchase isn't excluded.
0078. **Fake conversion injection** — fire the affiliate postback pixel directly with forged order IDs to mint commissions.
0079. **Attribution window extension** — modify the referral cookie expiry client-side where the server trusts the cookie's timestamp.
0080. **Last-click attribution theft** — overwrite a legitimate affiliate's cookie at checkout with your own via a link shortener.
0081. **Referral tier escalation** — game tiered affiliate payouts by cycling fake volume to reach higher commission brackets.
0082. **Sub-affiliate pyramid cut** — register fake sub-affiliates to siphon override commissions without real downstream sales.
0083. **Referral credit cashout** — convert non-cash referral credits into cash-equivalent gift cards through the rewards catalog.
0084. **Chargeback-proof referral** — earn referral payouts on orders you later charge back, where clawback logic doesn't cover referrals.
0085. **Referral campaign tampering** — alter the campaign ID in your referral link to attribute sales to a higher-paying campaign.
0086. **Deep-link referral hijack** — share deep links carrying your referral code into in-app purchases the merchant thought unattributable.
0087. **QR-code referral swap** — replace a merchant's in-store referral QR with your own to harvest walk-in attributions.
0088. **Disposable-domain referee farming** — use catch-all email domains to mass-create referee accounts that pass verification.
0089. **Payout-threshold gaming** — split earnings across accounts to stay under manual-review payout thresholds.
0090. **Fake install attribution** — spoof mobile attribution SDK events to claim install bounties for installs that never happened.
0091. **Trial-signup referral payout** — collect referral payouts for trial signups that never convert, where payout fires at signup.
0092. **Cross-device double attribution** — exploit broken cross-device attribution to double-count one conversion under two affiliates.
0093. **Coupon-site affiliate farming** — publish your affiliate link disguised as a coupon so discount-seekers generate commissions.
0094. **Referral-plus-welcome stacking** — combine a referral bonus with a welcome coupon on the same first order where both should be exclusive.
0095. **Dormancy-purge evasion** — keep farmed referee accounts active with scripted logins to dodge dormancy purges.
0096. **Leaderboard prize manipulation** — inflate referral counts with fake accounts to win leaderboard prizes and bonus tiers.
0097. **Checkout-step skipping** — jump directly to the payment step URL, bypassing shipping and tax calculation steps.
0098. **Shipping-step bypass** — submit an order with no shipping method selected where the backend defaults to a $0 option.
0099. **Tax-step omission** — complete checkout via the express API that never invokes the tax service, producing tax-free orders.
0100. **Address-validation bypass** — pass an unverified freight-forwarder address through the API that the web UI would reject.
0101. **Payment-method downgrade** — start checkout with a card then switch to cash-on-delivery at confirm while keeping card-only discounts.
0102. **Gift-flow item injection** — abuse the gift-message flow to add SKUs that the gift service fulfills without charging.
0103. **Order-notes charge instruction** — write "charge $1" in order notes where a downstream manual system honors the note.
0104. **Split-tender cashout** — pay 99% with a gift card and 1% with a card, then refund the card portion to extract cash from gift-card value.
0105. **Partial-payment ship abuse** — make a partial payment, then cancel the remaining balance invoice while the order ships as paid.
0106. **COD limit bypass** — place cash-on-delivery orders above the limit by splitting into multiple orders under the threshold.
0107. **Pickup-to-delivery swap** — check out as in-store pickup with no shipping fee, then change fulfillment to delivery post-payment.
0108. **Delivery-slot repricing dodge** — book a cheap off-peak delivery slot then reschedule to peak without repricing.
0109. **Guest-checkout limit dodge** — use guest checkout to bypass per-account purchase limits on high-demand items.
0110. **Express-wallet stale address** — use express wallets with a stale shipping address the merchant can't revalidate.
0111. **Multi-address fraud split** — ship line items to different addresses to fragment per-address fraud screening.
0112. **Billing-country mismatch** — set billing country to a low-fraud-score region while shipping elsewhere to dodge risk rules.
0113. **Phone-verification skip** — complete phone-gated checkout via the API endpoint that doesn't enforce the verification step.
0114. **Age-gate bypass at checkout** — buy age-restricted items through the mobile API that omits the age-verification screen.
0115. **Terms-acceptance forgery** — submit the order without accepting terms by calling the submit endpoint directly, then dispute the sale.
0116. **Locale-downgrade validation** — switch locale mid-checkout to one with weaker validation (e.g., no postal-code check) to push through fraud.
0117. **Cart-to-order desync** — modify the cart after the order total is locked but before payment capture, shipping extra items free.
0118. **Payment-retry downgrade** — fail the first payment attempt then retry with a cheaper payment method that keeps the original discount.
0119. **Edit-order price lock** — swap cheap items for expensive ones through the post-payment self-service edit flow while the original total stays locked.
0120. **Deprecated checkout API** — call a deprecated checkout API version that lacks current fraud checks or step enforcement.
0121. **One-click reorder abuse** — replay the one-click reorder endpoint for a discounted first-order to get the discount repeatedly.
0122. **Saved-cart price lock** — restore a months-old saved cart whose prices predate an increase, then check out at the old prices.
0123. **Wishlist-to-cart conversion** — move wishlist items to cart where wishlist pricing is stale and not revalidated at checkout.
0124. **Invoice-address VAT fraud** — set the invoice to a business entity to strip VAT, then use the goods personally.
0125. **Paid-refunded-reshipped cycle** — refund an order then use the "reship missing item" flow to get the goods again without paying.
0126. **Cancel-then-uncancel** — cancel for a refund, then uncancel through support flows or API states that restore the order without recharging.
0127. **Return-then-chargeback** — return an item for a refund and also file a chargeback on the original charge for a double refund.
0128. **Refund-method double dip** — choose refund-to-gift-card for bonus credit, then charge back the original payment too.
0129. **Order-state webhook replay** — replay the "payment succeeded" webhook to flip an unpaid order to paid without real payment.
0130. **Pause-resume billing gap** — pause a subscription to stop billing while the grace period keeps features active, then resume cyclically.
0131. **Trial-to-paid state confusion** — cancel during trial but keep the paid entitlement because the state machine leaves the grant active.
0132. **Dispute-plus-refund** — open a payment dispute and simultaneously request a merchant refund, collecting both.
0133. **Shipment-state manipulation** — mark an order "delivered" via the tracking API to trigger early release of escrowed funds.
0134. **Escrow auto-release timing** — exploit the auto-release timer by delaying dispute filing until funds release to the seller.
0135. **Digital-delivery revocation gap** — consume a digital good fully then refund within the window where revocation doesn't run.
0136. **License deactivation bypass** — refund a software license but keep it activated because deactivation is a separate async job that fails silently.
0137. **Booking cancel-rebook** — cancel a booking for a full refund inside the free window, then rebook the same slot at a lower price.
0138. **Transfer-then-refund** — transfer an event ticket to another account, then refund the original purchase where the transfer isn't reconciled.
0139. **Pre-order cancel after ship** — cancel a pre-order in the fulfillment lag window after it ships but before the state flips to shipped.
0140. **Backorder billing skip** — exploit backorder states to get partial shipments billed as complete, then dispute the missing items.
0141. **Warranty-claim serial loop** — file a warranty claim, receive a replacement, then file again on the replacement's serial as if new.
0142. **Dual-channel claim filing** — file the same claim through app and phone channels where case IDs don't dedupe.
0143. **Loan-application state abuse** — progress a loan through approval states, withdraw, and reapply to reset risk scoring.
0144. **KYC-approved flag persistence** — complete KYC once, then change identity details while the "verified" flag persists.
0145. **Account-closure payout** — close an account with pending cashback and get it paid out as cash instead of forfeiting it.
0146. **Dormancy-fee avoidance** — toggle account states to reset the inactivity timer and dodge dormancy fees.
0147. **Negative wallet balance** — drive a stored-value wallet negative via refund timing, then spend the negative balance before reconciliation.
0148. **Order-split refund** — split a shipped order so one part shows "returned" and triggers a full-order refund.
0149. **Gift-receipt double dip** — return a gifted item for store credit while the giver also refunds the original purchase.
0150. **Price-adjustment window stacking** — request price adjustments for overlapping promotion windows on the same order.
0151. **Tier-downgrade perk retention** — earn top-tier perks, get downgraded, but keep the granted perks because revocation only runs on upgrade.
0152. **Beta-access persistence** — keep beta feature access after the program ends because the entitlement flag is never cleared.
0153. **Points minting via returns** — earn points on purchase, return the item, keep the points because the reversal job lags.
0154. **Points transfer loop** — transfer points between two accounts where each transfer grants a bonus, compounding the balance.
0155. **Points expiry reset** — make a tiny earn or redeem transaction to reset the expiry clock on the entire points balance.
0156. **Tier-qualification gaming** — buy and refund high-value items to hit tier spend thresholds without net spend.
0157. **Points-to-cash arbitrage** — convert points to gift cards at a promo rate, then spend above the points' earn cost.
0158. **Double-dip earn** — earn points from both the store program and a linked card program on one transaction by linking twice.
0159. **Referral points farming** — self-refer to earn the referrer points bonus repeatedly with disposable accounts.
0160. **Review-for-points abuse** — post fake reviews to earn per-review points at scale with templated text.
0161. **Points on tax and fees** — earn points on the tax and shipping portion where terms exclude them, via bundled SKUs.
0162. **Points advance overdraft** — redeem points you haven't earned yet through the "points advance" feature, then never earn them back.
0163. **Status-match fraud** — submit a forged elite-status screenshot from a competitor to get matched into top tier.
0164. **Points pooling exploit** — pool family points where the pooling itself grants a bonus per member added.
0165. **Birthday-bonus rotation** — change the birthdate repeatedly to retrigger annual birthday bonus points.
0166. **Points on gift-card purchase** — earn points buying gift cards, then spend the gift cards to earn points again in a double-earn loop.
0167. **Cancelled-booking points** — earn travel-style points on bookings cancelled after the points post.
0168. **Expiry grace redemption** — redeem points in the grace window after expiry where the redemption API still accepts them.
0169. **Soft-landing abuse** — get downgraded with a soft landing that preserves perks, then requalify cheaply the next year.
0170. **Points-auction shilling** — use secondary accounts to bid up points auctions you intend to lose, forcing rivals to overpay.
0171. **Survey-for-points automation** — script the points-earning surveys with random answers that still pass validation.
0172. **Check-in points spoofing** — spoof GPS check-ins at partner locations to earn location-based points without visiting.
0173. **Points on failed payments** — earn points on orders whose payments later fail, because points post at order creation.
0174. **Linked-account double count** — link the same external account to two loyalty profiles to earn twice on shared activity.
0175. **Points gifting fee bypass** — gift points to another account to dodge expiry or account-closure forfeiture.
0176. **Elite-qualifying loophole** — repeat the cheapest qualifying activity (e.g., a $1 partner transaction counting as a "stay") to earn status.
0177. **Trial rotation with aliases** — cycle plus-addressed emails to get unlimited free trials of the same service.
0178. **Trial card cycling** — reuse trials by rotating virtual cards that pass the $0 authorization check.
0179. **Plan-parameter unlock** — tamper the plan ID in API calls to unlock paid features on a free account.
0180. **Trial grace-period abuse** — keep using the service during the post-trial grace period by repeatedly starting new trials.
0181. **Freemium quota reset** — reset usage quotas by re-authenticating OAuth where the quota keys off the token, not the user.
0182. **Cross-region trial stacking** — sign up for trials in multiple regional instances that don't share trial history.
0183. **Educational-discount fraud** — claim student pricing with a forged or borrowed .edu email that isn't verified.
0184. **Nonprofit-discount abuse** — register as a nonprofit with minimal documentation to get discounted SaaS tiers.
0185. **Trial API-key persistence** — keep using API keys issued during a trial after expiry because revocation lags.
0186. **Sandbox-to-production leak** — use sandbox credentials that accidentally work against production endpoints with real data.
0187. **Free-tier resource hoarding** — create many free-tier accounts to aggregate storage and compute beyond intended limits.
0188. **Trial referral chaining** — chain trials where each new trial grants the referrer extra trial days, compounding indefinitely.
0189. **Client-side feature flags** — toggle client-side feature flags to reveal paid features the backend doesn't gate per-request.
0190. **Trial export before paywall** — bulk-export data during the trial, cancel, and keep the exported dataset without subscribing.
0191. **Cancel-and-winback looping** — cancel to trigger winback discounts, resubscribe cheap, repeat each billing cycle.
0192. **Device-fingerprint reset** — clear or rotate device fingerprints to appear as a new device for device-limited trials.
0193. **Freemium seat sharing** — share one paid seat's credentials across a team where concurrent-session checks are absent.
0194. **Trial chargeback retention** — complete a trial, get charged, then charge back while keeping provisioned resources through the dispute.
0195. **Promo trial-code harvesting** — scrape publicly posted trial promo codes and redeem them across farmed accounts.
0196. **Lifetime-deal stacking** — stack multiple lifetime-deal codes on one account where the system adds entitlements instead of replacing.
0197. **Gift-card balance enumeration** — brute-force balance-check endpoints with sequential card numbers to find funded cards.
0198. **Gift-card PIN prediction** — exploit weak PIN generation (e.g., derived from card number) to activate cards without purchase.
0199. **Partial-redemption residue** — redeem most of a gift card across merchants, aggregating dust balances into real value.
0200. **Gift-card currency arbitrage** — buy gift cards in a weak-currency region and redeem in a strong one where conversion favors you.
0201. **Promo gift-card double spend** — spend a promotional gift card, then get it reissued via "didn't receive" support flows.
0202. **Gift-card merge exploit** — merge multiple cards where the merge logic adds a rounding bonus per card merged.
0203. **Gift-card refund to cash** — buy gift cards with a credit card, then refund them as cash through receipt-less return flows.
0204. **Digital gift-card interception** — predict delivery-email timing and claim cards sent to mistyped addresses via support.
0205. **Gift-card reload loop** — reload a gift card with a credit card to earn card rewards, then liquidate the gift card.
0206. **Empty-card return fraud** — buy a gift card, drain it, then return the physical card claiming it was never loaded.
0207. **Gift-card code reuse** — reuse a digital gift-card code where the redemption check is eventually consistent.
0208. **Balance-transfer expiry dodge** — transfer gift-card balances between accounts to dodge expiry, where each transfer extends validity.
0209. **Gift-card as coupon** — enter gift-card codes in the coupon field on sites that validate both from one table.
0210. **Corporate bulk-code leak** — harvest bulk-purchased gift-card codes from exposed spreadsheets or email threads.
0211. **Gift-card activation bypass** — activate cards at the POS API without payment by replaying the activation request.
0212. **Denomination mismatch** — buy a $100 card while the activation request specifies $10 but the card encodes $100.
0213. **Gift-card splitting for limits** — split a large balance across cards to stay under per-transaction redemption limits.
0214. **Expired-card redemption** — redeem expired gift cards through the mobile API that doesn't check expiry.
0215. **Balance-check oracle** — the balance-check API's error messages distinguish valid, invalid, and empty cards, enabling enumeration.
0216. **Charity gift-card diversion** — donate via gift cards to get the tax receipt, then refund the gift card through the issuer.
0217. **Freight-forwarder address** — ship to a forwarder in a cheap zone, then forward internationally, dodging international rates.
0218. **Weight under-declaration** — enter a lower package weight in the shipping calculator where the merchant doesn't reweigh.
0219. **Dimensional-weight gaming** — split an order into small parcels to dodge dimensional-weight surcharges on one large box.
0220. **Zone-boundary address** — use an address just inside a cheaper shipping zone for a location actually outside it.
0221. **Pickup-then-delivery swap** — select free in-store pickup at checkout, then request delivery post-purchase without the fee.
0222. **Threshold-padding return** — add a cheap filler item to cross the free-shipping threshold, then return only the filler.
0223. **Express-downgrade refund** — pay for express shipping, then downgrade to standard post-purchase and pocket the difference.
0224. **Shipping-insurance fraud** — declare inflated values on lost-package claims for items never in the parcel.
0225. **Multi-warehouse split** — force fulfillment from a distant warehouse to trigger shipping-refund policies on late delivery.
0226. **Mid-transit address reroute** — change the delivery address mid-transit to a farther location without repricing.
0227. **PO-box rate qualification** — use a PO box to qualify for cheaper postal rates on items needing courier delivery.
0228. **Return-label reuse** — reuse a prepaid return label's tracking to ship a different, heavier parcel.
0229. **Customs-value under-declaration** — declare low customs values on cross-border orders to dodge duties the merchant absorbs.
0230. **Delivery-slot hoarding** — book all same-day delivery slots to deny competitors, then release them after the cutoff.
0231. **Refund-to-different-method** — get a refund sent to a different card than the one charged, breaking the cardholder link.
0232. **Double refund via channels** — request a refund in-app and by phone where agents don't see each other's cases.
0233. **Chargeback-after-refund** — receive a merchant refund, then file a chargeback on the original charge for a double payout.
0234. **Partial-refund stacking** — get multiple partial refunds (damaged item, late delivery) that sum beyond the order value.
0235. **Return-empty-box** — return an empty box with valid tracking; the refund auto-issues on delivery scan without inspection.
0236. **Wardrobing** — buy, use, then return within the return window for a full refund.
0237. **Refund on digital consumption** — consume a digital product fully, then claim "not as described" for a refund.
0238. **Subscription refund window** — subscribe annually, use heavily for 11 months, then refund within a loose money-back window.
0239. **Price-drop refund loop** — repeatedly claim price adjustments as prices fluctuate, netting below the lowest price.
0240. **Damaged-item photo fraud** — submit stock photos of damage for items received intact to get keep-and-refund outcomes.
0241. **Late-delivery refund farming** — order during known delay periods to trigger automatic late-delivery refunds while keeping goods.
0242. **Refund currency arbitrage** — buy in a strong currency, refund after it weakens, profiting on the exchange difference.
0243. **Store-credit bonus compounding** — repeatedly choose "refund as store credit +10% bonus," compounding credit.
0244. **Gift-return double dip** — return a gift for store credit while the giver refunds the original purchase.
0245. **Warranty-as-refund** — use warranty claims as a backdoor refund channel after the return window closes.
0246. **Trial-conversion chargeback** — let a trial convert, then charge back claiming no authorization, keeping the service through the dispute.
0247. **Restocking-fee avoidance** — structure returns to dodge restocking fees (e.g., claiming defective instead of remorse).
0248. **Cross-border refund float** — exploit slow cross-border refund settlement to double-spend the pending refund amount.
0249. **Refund-method confusion** — select refund-to-store-credit for the bonus during checkout, then dispute the original charge.
0250. **Invoice refund fraud** — submit a forged invoice for a business purchase refund on items bought at consumer prices.
0251. **Service-not-rendered claim** — claim a service wasn't rendered for a fully delivered digital service with no delivery proof.
0252. **Refund-API amount tampering** — call the refund API directly with an inflated amount the agent UI would cap.
0253. **Ballot stuffing via accounts** — create fake accounts to vote repeatedly in polls with weak identity checks.
0254. **Review velocity gaming** — flood positive reviews in a short window to trigger "trending" boosts before moderation.
0255. **Rating manipulation via returns** — buy, leave 5 stars, return: keep the review while refunding the purchase.
0256. **Competitor review bombing** — coordinate 1-star reviews on rivals from farmed accounts.
0257. **Helpful-vote farming** — upvote your own reviews' "helpful" counts to pin them atop listings.
0258. **Poll option injection** — add write-in poll options via the API that the UI doesn't expose, skewing results.
0259. **Vote-weight exploit** — find account attributes (age, tier) that weight votes and farm accounts with the highest weight.
0260. **CAPTCHA-gated vote bypass** — vote through the API endpoint that records the vote before validating the CAPTCHA token.
0261. **Contest leaderboard gaming** — inflate leaderboard scores with scripted entries just under detection thresholds.
0262. **Contest multi-entry** — enter a "one per person" contest many times via email aliases the dedupe misses.
0263. **Winner-selection bias** — exploit predictable winner selection (e.g., every 1000th entry) by timing submissions.
0264. **Star-rating rounding** — exploit rounding so 3.5 displays as 4 stars, then nudge with a few fake 5-star reviews.
0265. **Verified-badge fraud** — get the verified-purchase badge via cancelled orders where the badge isn't revoked.
0266. **Q&A manipulation** — post fake questions and answers to bury legitimate complaints on product pages.
0267. **Shill bidding** — bid on your own auction via a second account to inflate the price without intent to buy.
0268. **Bid shielding** — place a high fake bid to scare off buyers, then retract it so a low accomplice bid wins.
0269. **Last-second sniping** — automate bids in the final seconds where the platform lacks anti-snipe extensions.
0270. **Reserve-price probing** — incrementally bid to discover the hidden reserve price, then buy exactly at reserve.
0271. **Bid-retraction abuse** — retract winning bids repeatedly to test seller flexibility, then re-bid lower.
0272. **Proxy-bid increment gaming** — place odd-amount bids that break the proxy auto-increment logic in your favor.
0273. **Auction-end timezone** — list auctions ending at times displayed wrong across timezones to reduce competition.
0274. **Fake-bidder default** — win with a fake account, default, and let the second-chance offer go to your real account cheaper.
0275. **Buy-it-now suppression** — bid just enough to disable the buy-it-now option, then win the auction below that price.
0276. **Cross-auction arbitrage** — win an underpriced auction and immediately relist the item at market price on the same platform.
0277. **Bid-history spoofing** — sellers inject fake bid history to create false demand signals.
0278. **Payment-terms switch** — win an auction, then insist on payment terms the seller didn't offer, forcing cancellation and relisting.
0279. **Auction-fee avoidance** — complete the sale off-platform after connecting via the auction's messaging.
0280. **Charity-auction deduction inflation** — overbid on charity auctions to claim inflated tax deductions on the premium paid.
0281. **Upgrade-downgrade proration** — upgrade mid-cycle for full features, then downgrade; the proration refund exceeds the value used.
0282. **Plan-change timing** — change plans hours before renewal so the new plan bills against the old plan's remaining credit.
0283. **Pause-billing loophole** — pause a subscription where pausing stops billing but the service stays active through the pause.
0284. **Seat-count manipulation** — add seats then immediately remove them, getting a full-month credit for minutes of use.
0285. **Metered-plan underreporting** — tamper client-side usage events so the metered bill undercounts actual consumption.
0286. **Annual-to-monthly flip** — switch annual to monthly mid-term, take the annual refund, then rebuy annual at a promo rate.
0287. **Trial stacking on upgrades** — each plan upgrade re-triggers a trial period on the new plan's premium features.
0288. **Family-plan slot selling** — resell spare family-plan slots to strangers, violating terms but profiting.
0289. **Subscription gifting loop** — gift a subscription to yourself via a second account to harvest new-subscriber promos.
0290. **Renewal-date manipulation** — change timezone or billing date to push renewal past a price increase.
0291. **Add-on proration gap** — add expensive add-ons mid-cycle where proration isn't charged until renewal, then remove them.
0292. **Overage-cap bypass** — exceed usage caps where the overage invoice never generates due to a billing-job bug.
0293. **Downgrade during grace** — downgrade during the payment-retry grace period to keep premium features while paying less.
0294. **Multi-currency subscription** — subscribe in a cheap-currency region via VPN, then use the service globally.
0295. **Grandfathered-plan transfer** — transfer a grandfathered cheap plan to another account via account-merge features.
0296. **Cancel-effective-date gaming** — cancel "end of term" but keep using through a grace period that should have ended access.
0297. **Reactivation promo loop** — cancel and wait for the winback offer, resubscribe, repeat every cycle.
0298. **Enterprise-trial abuse** — request enterprise trials with fake company domains to get premium features free.
0299. **Per-seat billing evasion** — share logins across a team on per-seat plans where concurrent detection is absent.
0300. **Usage-tier boundary shaping** — stay just under the next usage tier by shaping traffic, paying the lower tier while consuming near the higher.
0301. **Invoice-dispute stalling** — dispute invoices to delay payment while continuing to consume the service.
0302. **Legacy-plan API downgrade** — call the subscription API directly to set an unlisted legacy plan price.
0303. **Client-side paywall bypass** — the paywall checks a localStorage flag, so setting it unlocks premium content.
0304. **Feature-flag tampering** — flip feature flags in the client config response to enable unreleased paid features.
0305. **Entitlement-cache staleness** — keep a cached entitlement token after downgrade; the client honors it until refresh.
0306. **Free-tier API overreach** — free-tier API keys call premium endpoints that check the key's existence, not its plan.
0307. **Plan-parameter tampering** — pass `plan=enterprise` during signup where the backend trusts the client-supplied plan.
0308. **Offline license tampering** — modify the offline license file's expiry because the signature check is client-side only.
0309. **Concurrent-stream limit** — share streaming credentials beyond the device limit where the limit counts sessions loosely.
0310. **Download-quota reset** — reset download quotas by clearing client state where the server doesn't track usage.
0311. **Premium-support abuse** — file premium-support tickets on a free account through the unauthenticated ticket API.
0312. **White-label entitlement** — enable white-labeling via a hidden setting the UI hides but the API honors.
0313. **SSO-requirement bypass** — enforce SSO only in the UI; the API still accepts password logins for SSO-mandated orgs.
0314. **Audit-log export** — free plans pull audit logs through the export API that lacks plan checks.
0315. **Retention-policy carryover** — deleted-data retention follows the paid plan's policy even after downgrade.
0316. **Seat-license reuse** — deactivate a seat and immediately reactivate a different user without consuming a new license.
0317. **Invite-link privilege escalation** — sign up via an admin invite link where the role is encoded in the URL and not revalidated.
0318. **Seat-license rotation** — rotate users through one seat license faster than the license server's heartbeat detects.
0319. **Wallet integer overflow** — top up a wallet with a huge amount that overflows the balance field into a larger value.
0320. **Wallet rounding accumulation** — exploit per-transaction rounding to siphon fractions of a cent into your wallet over many transactions.
0321. **Discount-code algorithm reverse** — derive the code-generation algorithm from samples and mint valid discount codes.
0322. **Cart-merge duplication** — merge a guest cart into an account cart twice, duplicating the items but charging once.
0323. **Cart-split for thresholds** — split a cart so each part independently qualifies for a per-order promotion.
0324. **Pre-order deposit lock** — exploit refundable deposit rules to lock limited inventory with deposits, then release strategically.
0325. **Crowdfunding threshold gaming** — pledge and withdraw strategically to manipulate "funded" status and stretch-goal unlocks.
0326. **Dual-insurer claim** — file the same insured event with two insurers where neither checks the other's registry.
0327. **KYC-step skipping** — jump past document verification via deep links to later onboarding steps the router doesn't guard.
0328. **CAPTCHA-token replay** — capture a solved CAPTCHA token and replay it for multiple gated actions where tokens aren't single-use.
0329. **Marketplace fee avoidance** — structure transactions as "services" not "goods" to pay lower platform fees.
0330. **Seller-payout timing** — withdraw seller payouts before buyer refunds settle, leaving the platform with the loss.
0331. **Listing-fee evasion** — keep listings in "draft" state where they're visible but not billed.
0332. **Return-label fraud** — generate prepaid return labels and use them to ship unrelated parcels.
0333. **Warranty-transfer abuse** — transfer warranties to resold items where the warranty should have been voided.
0334. **Appointment-slot denial** — book free consultations at scale to deny competitors availability, then sell the slots.
## K. Race conditions & concurrency attacks
0335. **Coupon double-redeem** — fire parallel coupon-redemption requests so both pass the single-use check before either commits.
0336. **Balance double-debit** — send concurrent withdrawal requests that each see the pre-debit balance and both succeed.
0337. **Credit-spend race** — spend the same store credit on two checkouts simultaneously before the ledger updates.
0338. **OTP single-use bypass** — submit the same OTP in parallel requests before the first consumes it.
0339. **Password-reset token reuse** — use a reset token twice concurrently before invalidation commits.
0340. **Invite-code multi-redeem** — redeem a single-use invite link from parallel sessions.
0341. **Promo-claim race** — claim a limited-quantity promo concurrently to exceed the stock cap.
0342. **Seat-hold race** — hold the same seat from two sessions where the hold check isn't atomic.
0343. **Voucher redemption race** — redeem the same voucher code twice in the same millisecond window.
0344. **Points-redeem race** — redeem loyalty points for rewards twice before the balance decrements.
0345. **Withdrawal-limit race** — exceed daily withdrawal limits with parallel requests that each check the limit independently.
0346. **Ticket-purchase race** — buy more tickets than the per-user cap via concurrent purchases.
0347. **Refund-request race** — submit duplicate refund requests that each pass the "not yet refunded" check.
0348. **Top-up webhook race** — exploit top-up webhooks arriving twice to credit the wallet twice.
0349. **API-quota race** — exceed rate limits by bursting requests that increment the counter non-atomically.
0350. **Email-swap verification dodge** — change the account email concurrently to bypass verification of the new address.
0351. **Username-claim race** — register the same username simultaneously where uniqueness is checked before insert.
0352. **Auction-bid increment race** — place concurrent bids that both pass the minimum-increment check against the same base price.
0353. **Poll-vote race** — vote twice before the has-voted flag persists.
0354. **File-upload quota race** — upload files concurrently to exceed storage quotas checked per-request.
0355. **Subscription-cancel race** — cancel and resubscribe concurrently to land in an inconsistent billing state.
0356. **Gift-card redeem race** — redeem the same gift card on two orders before the balance updates.
0357. **Deposit-bonus race** — trigger a deposit bonus twice with concurrent deposits where the bonus check isn't locked.
0358. **Cashback-claim race** — claim cashback on the same order from two sessions.
0359. **Leaderboard-score race** — submit scores concurrently to double-count a single achievement.
0360. **Check-in race** — check in to the same location twice for double rewards before the cooldown writes.
0361. **Referral-claim race** — two accounts claim the same referral reward concurrently.
0362. **Trial-activation race** — activate a trial twice to stack trial periods.
0363. **Discount-lock race** — lock a time-limited discount in two carts simultaneously.
0364. **Inventory-decrement race** — buy the last item twice where stock goes negative instead of blocking.
0365. **Payment-capture race** — capture the same authorization twice before it's marked captured.
0366. **Webhook-delivery race** — process the same payment webhook twice, crediting the account twice.
0367. **Session-creation race** — create two sessions that both inherit elevated state from a single upgrade event.
0368. **Password-change race** — change the password while a reset is in flight, leaving both credentials valid.
0369. **Login-paired 2FA disable** — disable 2FA concurrently with a login that already passed the 2FA check.
0370. **Account-deletion race** — withdraw funds while account deletion is processing, after the balance check.
0371. **KYC-approval race** — pass KYC-gated actions during the window between approval and flag propagation.
0372. **Payout-request race** — request two payouts that each pass the available-balance check.
0373. **Escrow-release race** — release escrowed funds twice via concurrent release calls.
0374. **Chargeback-response race** — submit both "accept" and "dispute" responses to a chargeback, confusing the state machine.
0375. **Redeem-plus-transfer** — redeem a coupon and transfer the resulting credit concurrently before either settles.
0376. **Debit-plus-withdraw** — debit the wallet via purchase while withdrawing the same funds to a bank.
0377. **Order-plus-cancel** — place an order and cancel it simultaneously to keep both the goods and the refund.
0378. **Upgrade-plus-downgrade** — upgrade and downgrade a subscription concurrently to land on premium at the basic price.
0379. **Add-seat-plus-remove** — add and remove seats in parallel to confuse per-seat billing.
0380. **Top-up-plus-spend** — top up a wallet and spend the top-up before the payment clears.
0381. **Claim-plus-expire** — claim a reward while its expiry job runs, keeping it past expiry.
0382. **Transfer-plus-close** — transfer funds out while closing the account, bypassing the closure balance check.
0383. **Vote-plus-delete** — vote in a poll then delete the account before the vote is scrubbed.
0384. **Bid-plus-retract** — place and retract an auction bid concurrently to manipulate the visible price.
0385. **Apply-coupon-plus-checkout** — apply a coupon while checkout totals compute, getting the discount without the coupon committing.
0386. **Invite-plus-register** — redeem an invite while registering, creating two accounts from one invite.
0387. **Reset-plus-login** — log in with the old password while a reset completes, keeping both valid.
0388. **Enable-2FA-plus-disable** — toggle 2FA rapidly to leave it logically enabled but unenforced.
0389. **Change-email-plus-verify** — verify the old email while changing to a new one, keeping both verified.
0390. **Upload-plus-publish** — publish a file while the upload is still streaming, serving a partial file as complete.
0391. **Scan-plus-serve** — serve a file from the CDN while the malware scan is still running.
0392. **Approve-plus-revoke** — approve a transaction while revoking the approval, leaving it approved.
0393. **Lock-plus-transfer** — transfer an asset while a compliance lock is being applied.
0394. **Hold-plus-purchase** — purchase inventory while the hold expires, double-selling the same unit.
0395. **Refund-plus-reship** — request a reshipment while the refund processes, getting both.
0396. **Dispute-plus-withdraw** — withdraw funds while a dispute hold is being placed.
0397. **Mint-plus-burn** — mint reward tokens while burning them, inflating the supply count.
0398. **Stake-plus-unstake** — stake and unstake crypto concurrently to earn rewards on both states.
0399. **Swap-plus-cancel** — cancel a token swap after it executed but before the ledger reconciled.
0400. **Borrow-plus-repay** — borrow against collateral while repaying, double-counting the collateral.
0401. **Liquidate-plus-deposit** — deposit collateral during liquidation to dodge the liquidation.
0402. **Vote-plus-delegate** — vote and delegate governance tokens concurrently to double-count voting power.
0403. **Airdrop-claim-plus-transfer** — claim an airdrop and transfer the eligibility NFT before the claim records.
0404. **Presale-plus-refund** — get a presale refund while keeping the allocated tokens.
0405. **Publish-before-scan** — publish a file in the gap between upload completion and scan verdict.
0406. **Scan-verdict swap** — swap the file contents after the scanner reads it but before the publish step hashes it.
0407. **Thumbnail-before-scan** — the thumbnail generator renders an unscanned file, leaking its contents via the thumbnail.
0408. **Preview-link early** — the shareable preview URL works before moderation approves the file.
0409. **Transcode-before-scan** — the video transcoder processes a malicious file before the scan completes.
0410. **External-scan callback lag** — rely on the external scanner's async callback while serving the file immediately.
0411. **Chunked-upload swap** — replace later chunks of a chunked upload after earlier chunks passed scanning.
0412. **Metadata-scan gap** — the scanner checks file content but the served file includes unscanned metadata.
0413. **Re-upload overwrite** — overwrite a scanned-clean file with a malicious one at the same path before publish.
0414. **CDN-cache pre-scan** — the CDN caches the file on first upload request, before the origin's scan finishes.
0415. **Extension rename post-scan** — rename an approved file's extension after scanning to change how it's served.
0416. **Symlink swap** — replace the scanned file with a symlink to a malicious file between scan and serve.
0417. **Partial-upload serve** — the server serves a partially uploaded file the scanner hasn't seen fully.
0418. **Concurrent-version publish** — upload two versions; the scanner clears v1 while v2 gets published.
0419. **Scan-timeout default-allow** — files publish when the scanner times out, so upload scan-crashing files.
0420. **Quarantine escape** — move a file out of quarantine via the rename API before the scan verdict lands.
0421. **Watermark-before-scan** — the watermarking step embeds the file publicly before scanning completes.
0422. **OCR-before-scan** — the OCR pipeline exposes file text before the scan verdict.
0423. **Backup-before-scan** — backup jobs copy unscanned uploads to publicly listable buckets.
0424. **Replication race** — multi-region replication copies the file before the primary's scan finishes.
0425. **Delete-during-scan** — delete the original mid-scan so the scan passes on a stub while the CDN serves cached malicious bytes.
0426. **Re-scan bypass** — modify a file after its initial clean scan; the platform only scans on first upload.
0427. **Version rollback** — roll back to a pre-scan version via the versioning API after a malicious version is blocked.
0428. **Shared-folder propagation** — share a folder before its contents finish scanning, exposing unscanned files to recipients.
0429. **Comment-attachment gap** — attachments on comments render before the async scan, unlike main uploads.
0430. **Wallet double-spend** — spend the same wallet balance on two merchants concurrently.
0431. **Credit-line race** — draw down a credit line from two endpoints before utilization updates.
0432. **Overdraft-timing** — time withdrawals against the nightly batch overdraft check to overdraw intraday.
0433. **Pending-balance spend** — spend funds still in "pending" state from an uncleared deposit.
0434. **Authorization-hold race** — make purchases against the same pre-authorization from multiple concurrent checkouts.
0435. **Settlement-lag arbitrage** — exploit the lag between authorization and settlement to spend the same funds twice.
0436. **Multi-currency balance** — hold balances in two currencies; spend from both against a shared credit limit.
0437. **Ledger-replication lag** — spend at two terminals where the ledger replicates with delay.
0438. **Micro-deposit race** — verify bank micro-deposits concurrently to link the same account twice for double payouts.
0439. **Payout-queue race** — queue two payouts that together exceed the balance before the queue drains.
0440. **Interest-accrual race** — withdraw principal while interest posts, earning interest on withdrawn funds.
0441. **Fee-assessment race** — transact during the fee-assessment window to dodge fees calculated on stale balances.
0442. **Margin-call delay** — trade on margin during the delay before the margin call liquidates positions.
0443. **Chargeback-credit race** — spend the provisional credit from a chargeback before it's reversed.
0444. **Refund-credit race** — spend a refund credit before the original charge's reversal settles.
0445. **Cashback-posting race** — redeem cashback in the window between posting and the clawback job.
0446. **Bonus-credit race** — spend signup bonus credits before eligibility verification completes.
0447. **Escrow-balance race** — the buyer and seller both withdraw the same escrowed amount during release.
0448. **Float-account race** — exploit the float account's end-of-day reconciliation to double-spend intraday.
0449. **Prepaid-card race** — spend a prepaid card online and in-store concurrently before the network syncs.
0450. **Gift-card balance race** — redeem a gift card at two merchants before either captures.
0451. **Loyalty-point race** — convert points to cash twice before the points ledger updates.
0452. **Credit-memo race** — apply the same credit memo to two invoices concurrently.
0453. **Discount-accrual race** — accrue volume discounts on overlapping orders counted twice.
0454. **Rebate-claim race** — claim the same rebate through web and mobile before dedupe.
0455. **Dividend-record race** — claim dividend-equivalent payouts on shares sold between record and pay dates.
0456. **Staking-reward race** — unstake while rewards calculate, earning rewards on the unstaked amount.
0457. **Airdrop-snapshot race** — transfer tokens between wallets during the airdrop snapshot to multiply eligibility.
0458. **Liquidity-pool race** — deposit and withdraw from a pool concurrently to inflate share accounting.
0459. **Flash-loan callback race** — exploit the callback ordering in flash loans to keep the loaned funds.
0460. **Role-check race** — escalate privileges between the role check and the action execution.
0461. **Ownership-check race** — transfer resource ownership between the ownership check and the delete action.
0462. **Permission-cache race** — act on cached permissions after revocation but before the cache expires.
0463. **Group-membership race** — perform admin actions in the window after removal from the admin group propagates.
0464. **Token-scope race** — use a token after its scopes were narrowed but before the gateway reloads the policy.
0465. **API-key revocation race** — call the API with a revoked key during the revocation propagation delay.
0466. **Session-privilege race** — privilege level is checked at login; escalate mid-session before revalidation.
0467. **Impersonation race** — start an impersonation session just as it's revoked, keeping the impersonated context.
0468. **Approval-workflow race** — execute a transaction between approval grant and approval revocation.
0469. **Dual-control race** — the second approver revokes approval after the first approval already triggered execution.
0470. **Time-boxed access race** — use temporary access after expiry where the check happens at request start, not completion.
0471. **IP-allowlist race** — connect from an allowlisted IP, then the allowlist updates mid-session without revalidation.
0472. **Geo-fence race** — start a session in an allowed country, then roam to a blocked one mid-session.
0473. **Device-trust race** — act from a device whose trust was revoked between the check and the sensitive action.
0474. **Step-up-auth race** — complete a sensitive action after step-up auth expires but before the timeout is enforced.
0475. **Consent-withdrawal race** — withdraw consent while a data export runs, exporting data post-withdrawal.
0476. **Deletion-request race** — act on user data after a deletion request but before the deletion job runs.
0477. **Legal-hold race** — delete records after the hold check but before the hold is applied.
0478. **Quota-check race** — exceed quotas where the check reads a cached usage value.
0479. **License-check race** — use software after the license check passed but the license expired mid-session.
0480. **Entitlement-check race** — access premium features between plan downgrade and entitlement cache refresh.
0481. **Rate-limit-check race** — burst past limits where the counter increments after the request is served.
0482. **Fraud-score race** — the fraud score is computed at order start; swap in risky items before capture.
0483. **Sanctions-check race** — transact during the sanctions-list update window with stale screening data.
0484. **Age-verification race** — verify age, then change the birthdate before the restricted purchase completes.
0485. **Reset-token reuse race** — use a reset token twice concurrently before the first use invalidates it.
0486. **Reset-while-logged-in** — reset the password while the victim's session stays active, keeping the old session valid.
0487. **Multi-token race** — request two reset tokens; use the older one after the newer was issued where only the newest should work.
0488. **Token-invalidation lag** — the reset token stays valid briefly after use due to async invalidation.
0489. **Email-change race** — change the account email while a reset to the old email is in flight.
0490. **Reset-enumeration race** — request resets for many accounts concurrently and harvest timing differences.
0491. **Concurrent-reset confusion** — two simultaneous resets for one account leave both tokens valid.
0492. **Reset-plus-2FA-disable** — disable 2FA while a password reset is in flight to fully take over.
0493. **Admin-reset race** — an admin resets a password while the user resets it, leaving an unknown valid password.
0494. **Token-TTL race** — use the token in the final seconds where the expiry check and the use aren't atomic.
0495. **Case-sensitivity race** — the token check is case-insensitive but invalidation is case-sensitive, leaving variants valid.
0496. **Reset-via-old-email** — the reset goes to the old email during the email-change propagation window.
0497. **Session-survival race** — reset the password but the "log out all sessions" job lags, keeping attacker sessions.
0498. **Remember-me race** — the remember-me cookie survives the password reset due to separate invalidation.
0499. **API-token survival** — API tokens issued before the reset remain valid because only web sessions are killed.
0500. **OAuth-grant survival** — connected OAuth apps keep access after a password reset doesn't revoke grants.
0501. **Magic-link overlap** — request a magic link and a password reset together; both stay valid.
0502. **Support-reset race** — a support agent resets the password while the automated reset is in flight.
0503. **Bulk-reset race** — reset many accounts concurrently to exploit a shared invalidation bottleneck.
0504. **Token-log race** — the reset token is logged before invalidation, and log access happens in the window.
0505. **Region-balance race** — spend the same balance in two regions before cross-region replication syncs.
0506. **CDN-edge race** — redeem a coupon at two edge PoPs where the origin hasn't propagated the redemption.
0507. **Edge-cache auth** — an edge node serves a cached authorized response after the user's access was revoked.
0508. **Multi-region inventory** — buy the last item in two regions where inventory sync lags.
0509. **DNS-failover race** — during failover, both primary and standby accept writes, duplicating records.
0510. **Active-active conflict** — two active databases accept conflicting writes; last-write-wins silently drops one.
0511. **Read-replica lag** — act on stale replica data to bypass a just-set restriction.
0512. **Eventual-consistency exploit** — exploit the consistency window to double-spend across services.
0513. **Queue-duplication** — a message queue delivers the same job twice during a partition, double-processing payments.
0514. **Partition brain-split** — during a network partition, both sides issue the same sequential IDs, colliding on heal.
0515. **Clock-skew race** — exploit clock skew between servers to use an expired token or beat an expiry.
0516. **Cron overlap** — overlapping cron runs process the same batch twice, double-crediting accounts.
0517. **Deploy race** — during a rolling deploy, old and new code enforce different rules; hit both versions.
0518. **Config-propagation race** — act under the old rate limit while the new stricter config propagates.
0519. **Flag-rollout race** — a feature flag is on in one region and off in another; arbitrage the difference.
0520. **Blue-green session** — sessions valid in blue are replayed against green during the cutover.
0521. **Cache-invalidation race** — read stale cached prices after a price update but before invalidation.
0522. **Session-store replication** — a session killed in one region stays alive in another until replication.
0523. **Webhook-retry duplication** — retry storms from a provider deliver the same event multiple times.
0524. **Idempotency sharding** — idempotency keys checked per-shard let the same key execute on two shards.
0525. **Webhook-versus-job race** — the payment webhook and the order job both credit the account, double-crediting.
0526. **Refund-webhook race** — the refund webhook arrives while the manual refund is processing, doubling the refund.
0527. **Email-verification race** — verify the email after the account was flagged, slipping past the flag.
0528. **Provisioning race** — the provisioning job runs twice for one order, creating duplicate resources.
0529. **Deprovisioning race** — cancel while provisioning runs, leaving orphaned active resources.
0530. **Billing-job race** — the billing job and a manual invoice both charge the customer.
0531. **Dunning race** — the dunning email offers a discount while the account is being cancelled, stacking outcomes.
0532. **Trial-expiry race** — use premium features during the trial-expiry job's run window.
0533. **Subscription-renewal race** — renew manually while auto-renewal runs, getting charged twice for double the term.
0534. **Chargeback-job race** — the chargeback job reverses a payment while a refund is issued, double-returning funds.
0535. **Payout-job race** — the payout job runs concurrently with a manual payout, doubling the payout.
0536. **Interest-job race** — withdraw during the interest-posting job to earn interest on withdrawn principal.
0537. **Report-job race** — generate a report while data is being deleted, leaking deleted data.
0538. **Export-job race** — export user data while the deletion request processes, keeping a copy.
0539. **Migration-job race** — migrate accounts while users transact, duplicating or losing transactions.
0540. **Backfill-job race** — a backfill replays old events that were already processed, double-applying them.
0541. **Retry-queue race** — a failed job retries while the manual fix already resolved it, applying the fix twice.
0542. **Dead-letter race** — replay dead-letter messages that were already handled manually.
0543. **Scheduled-publish race** — publish a post while its scheduled update runs, creating duplicate versions.
0544. **Notification race** — the notification job fires before the transaction commits, leaking uncommitted data.
0545. **Analytics race** — analytics jobs count events that are later rolled back.
0546. **ML-feature race** — the fraud model scores on features computed before the transaction's final state.
0547. **Cache-warm race** — cache warming serves stale entitlements during a plan change.
0548. **Search-index race** — search indexes expose records that were just deleted.
0549. **Audit-log race** — actions taken during the audit-log rotation window go unlogged.
0550. **Cache stampede** — trigger a stampede on an expensive endpoint to exhaust backend resources or bypass throttles.
0551. **Poisoned-cache race** — race the cache fill to plant a poisoned response served to other users.
0552. **Cache-key collision** — craft requests that collide on cache keys, serving one user's data to another.
0553. **Stale-price race** — buy at a cached stale price after the real price increased.
0554. **Stale-entitlement race** — access premium content from cache after the subscription lapsed.
0555. **Stale-auth race** — a cached "authorized" response is replayed after access revocation.
0556. **Error-page poisoning** — poison the cache with an error page to selectively deny service.
0557. **Vary-header race** — exploit inconsistent Vary handling to get one user's cached response served cross-user.
0558. **Query-param cache** — the cache ignores a price-determining query param, serving the cheapest variant's price.
0559. **Cookie-based cache** — the cache keys on a cookie you can set, letting you choose which cached tier you get.
0560. **Web-cache timing gap** — exploit the gap between cache validation and origin fetch to serve mixed content.
0561. **Cache-purge race** — access the resource in the window between purge request and purge completion.
0562. **TTL-boundary race** — use a resource exactly at TTL expiry where some edges serve stale and some fetch fresh.
0563. **Negative-cache race** — poison the negative cache so valid resources appear missing.
0564. **Cache-lock race** — bypass the cache lock to trigger duplicate expensive computations or duplicate side effects.
0565. **Edge-include race** — edge-side includes assemble a page from cached fragments of different users.
0566. **Cache-tag race** — purge by tag while a request is being cached, leaving stale tagged content.
0567. **Surrogate-key race** — race surrogate-key invalidation to keep serving revoked content.
0568. **Cache-bypass comparison** — alternate bypass headers to compare cached versus fresh responses and detect logic flaws.
0569. **Prefetch race** — trigger prefetch of a privileged URL; the prefetched response gets cached publicly.
0570. **Counter-increment race** — burst requests so the counter increments after serving, exceeding the limit.
0571. **Sliding-window race** — exploit the window boundary to get twice the limit across adjacent windows.
0572. **Fixed-window race** — fire all requests at the window edge for double the allowance.
0573. **Token-bucket race** — drain the bucket concurrently before refills are accounted.
0574. **Per-IP versus per-user** — alternate IPs and user contexts to multiply the effective limit.
0575. **Endpoint-specific race** — the limit is per-endpoint; fan out across endpoints sharing a backend resource.
0576. **Limit-reset timing** — time requests to the documented reset second to squeeze extra calls.
0577. **Distributed-counter race** — counters sharded per node let you exceed the global limit by spreading load.
0578. **Header-spoof race** — spoof X-Forwarded-For to rotate the rate-limit identity per request.
0579. **IPv6-rotation race** — rotate through a /64 to get a fresh limit per address.
0580. **Limit-bypass race** — the limit applies to the API but not the GraphQL mirror of the same operation.
0581. **Burst-allowance race** — exploit the burst allowance repeatedly by timing the refill.
0582. **Penalty-box race** — trigger the penalty, then act during the penalty-propagation delay.
0583. **Allowlist race** — get allowlisted, then exceed limits before the allowlist is revoked.
0584. **Quota-reset race** — the quota resets at midnight UTC; schedule bursts across the reset.
0585. **OTP-reuse race** — submit the same OTP concurrently before it's marked consumed.
0586. **OTP-bruteforce race** — parallelize OTP guessing to beat the attempt counter's non-atomic increment.
0587. **OTP-resend race** — request resends rapidly so multiple valid OTPs exist simultaneously.
0588. **OTP-channel race** — request both SMS and email OTPs; both are valid and independent.
0589. **OTP-TTL race** — use the OTP in the final second where expiry and verification aren't atomic.
0590. **OTP-backup-code race** — use a backup code while the primary OTP flow is in flight.
0591. **OTP device race** — complete verification on one device while the attacker completes it on another.
0592. **SIM-swap window** — act during the carrier's SIM-swap propagation where both SIMs receive codes.
0593. **OTP-autofill race** — race the app's OTP autofill against manual entry to double-submit.
0594. **Voice-OTP race** — request voice-call OTPs concurrently to get multiple valid codes.
0595. **OTP rate-limit race** — guess OTPs from many IPs to dodge per-IP attempt limits.
0596. **TOTP-skew race** — exploit the time-step acceptance window to reuse a TOTP code twice.
0597. **TOTP-secret race** — provision TOTP on two devices during setup before the secret is locked.
0598. **Recovery-code race** — use the same recovery code twice before it's invalidated.
0599. **OTP-length race** — the verifier accepts variable-length OTPs; race short and long guesses.
0600. **Null-OTP race** — submit an empty OTP concurrently with the real one where empty bypasses the check.
0601. **OTP-session race** — the OTP binds to a session; race two sessions sharing one OTP.
0602. **Cross-account OTP** — an OTP issued for account A is accepted for account B due to weak binding.
0603. **OTP-log race** — the OTP appears in logs before invalidation; read it in the window.
0604. **Push-approval race** — approve a push prompt while the legitimate user also approves, both sessions proceeding.
0605. **Seat double-hold** — hold the same seat from two sessions before either hold commits.
0606. **Inventory oversell** — buy the last unit concurrently from web and mobile.
0607. **Hold-expiry race** — complete purchase in the gap between hold expiry and inventory release.
0608. **Cart-hold race** — the cart holds inventory; duplicate the cart to hold twice the stock.
0609. **Wishlist-hold race** — move wishlist items to cart concurrently to double-hold inventory.
0610. **Preorder-allocation race** — claim the same preorder allocation from two accounts.
0611. **Ticket-queue race** — hold a place in the ticket queue while buying through the direct link.
0612. **Flash-sale race** — the flash-sale stock counter decrements after serving, overselling the drop.
0613. **Restock race** — buy during the restock job before the inventory count updates.
0614. **Return-to-stock race** — buy an item in the window between return receipt and restock.
0615. **Reservation race** — reserve the same hotel room via web and API concurrently.
0616. **Rental-car race** — book the last car in two location systems before sync.
0617. **Appointment-slot race** — book the same slot twice before the calendar locks.
0618. **Course-enrollment race** — enroll in the last seat from two browsers.
0619. **License-seat race** — activate the same license seat on two machines concurrently.
0620. **API-seat race** — claim the same API concurrency slot from two keys.
0621. **Warehouse-allocation race** — two warehouses allocate the same physical unit.
0622. **Dropship race** — the dropshipper and the retailer both sell the last unit.
0623. **Bundle-component race** — two bundles share one scarce component; both sell concurrently.
0624. **Gift-card-stock race** — buy more gift cards than the issued stock during a bulk sale.
0625. **Bid-timing race** — place two bids that both read the same current price, leapfrogging the increment logic.
0626. **Snipe collision** — automated snipers collide in the final second; exploit the tie-break to win at the lower bid.
0627. **Proxy-bid race** — concurrent proxy bids confuse the auto-increment engine into skipping increments.
0628. **Reserve-met race** — bid exactly as the reserve is met by another bidder, both thinking they won.
0629. **Bid-retraction race** — retract a bid while another bid is being placed, corrupting the bid history.
0630. **Auto-extend race** — bid in the final second while the auto-extend job runs, avoiding the extension.
0631. **Tie-bid race** — place an identical bid concurrently; the tie-break awards it to the later timestamp incorrectly.
0632. **Increment race** — bid the minimum increment concurrently from two accounts to double-increment.
0633. **Buy-now race** — click buy-it-now while another buyer's bid processes, getting both outcomes.
0634. **Bid-history race** — read bid history mid-update to see hidden maximum proxy bids.
0635. **Auction-close race** — bid in the millisecond the auction closes; the late bid is accepted.
0636. **Re-list race** — bid on a re-listed item while the original auction's winner is being determined.
0637. **Multi-quantity race** — bid on multi-quantity lots concurrently to exceed the available quantity.
0638. **Currency-bid race** — bid in two currencies where conversion lags, winning below the real price.
0639. **Off-platform race** — complete the sale off-platform while the auction is closing, then dispute the auction outcome.
0640. **Email-change verification race** — change the email and verify the new one before the old-email confirmation completes.
0641. **Email-revert race** — revert the email change while the new-email verification is in flight.
0642. **Primary-email race** — set two primary emails concurrently, leaving the account with no verified primary email.
0643. **2FA-disable race** — disable 2FA while a sensitive action that required it is executing.
0644. **2FA-enroll race** — enroll a second 2FA device during the first enrollment before it's finalized.
0645. **Recovery-email race** — change the recovery email while a recovery is in progress.
0646. **Phone-change race** — change the 2FA phone number without re-verifying the old one in the propagation window.
0647. **Backup-code regen race** — generate new backup codes while old ones are being used, leaving both valid.
0648. **Trusted-device race** — mark a device trusted while trust is being revoked account-wide.
0649. **Session-revoke race** — act on a session while the revoke-all-sessions job runs.
0650. **Password-plus-email race** — change password and email concurrently to dodge the confirmation emails.
0651. **SSO-link race** — link SSO while unlinking it, leaving the account in a half-linked state.
0652. **API-key rotation race** — the old API key stays valid during the rotation propagation window.
0653. **Webhook-secret rotation** — replay events signed with the old secret during the rotation window.
0654. **OAuth-unlink race** — unlink an OAuth app while it refreshes its token, keeping access.
0655. **Idempotency-key reuse** — replay a successful request with the same idempotency key after the result expired from the store.
0656. **Key-collision race** — two different requests share one idempotency key; the second gets the first's result.
0657. **Key-TTL race** — reuse the key in the gap between result expiry and key cleanup.
0658. **Cross-endpoint key** — the same key is accepted on two endpoints, applying one payment to two orders.
0659. **Key prediction** — idempotency keys are sequential; predict another user's key to fetch their result.
0660. **Concurrent same-key** — send the same key concurrently; both execute because the lock isn't held during processing.
0661. **Key-scope race** — the key is scoped per-user but checked globally, letting you replay another user's request.
0662. **Partial-failure race** — the request partially succeeds; retrying with the same key replays the partial side effects.
0663. **Header-versus-body key** — the key in the header differs from the body; the server checks one and processes the other.
0664. **Empty-key race** — omit the idempotency key on an endpoint that only enforces it when present.
0665. **Key replay after refund** — replay a payment with its old idempotency key after refund to get the goods again.
0666. **Distributed-key race** — idempotency stores are per-region; replay the key in another region.
0667. **Key-log race** — idempotency keys logged in plaintext let you replay others' requests.
## L. JWT / OAuth / OIDC / SAML attacks
0668. **alg-none acceptance** — strip the signature and set alg to none where the verifier honors it.
0669. **RS256-to-HS256 confusion** — sign an RS256 token with the public key as the HMAC secret.
0670. **HS256-to-RS256 confusion** — trick the verifier into the reverse confusion via ambiguous key handling.
0671. **Duplicate alg header** — add a duplicate alg claim where the parser reads the first and the verifier the second.
0672. **Case-variant alg** — use "None", "NONE", or "nOnE" where the comparison is case-sensitive downstream.
0673. **alg confusion via jku** — combine a malicious jku with alg HS256 to supply your own HMAC key.
0674. **Empty-signature bypass** — send a token with an empty signature segment where the verifier skips empty signatures.
0675. **Signature stripping** — remove the third segment entirely; some parsers treat the token as valid.
0676. **alg-none with kid** — include a kid pointing to a null key to satisfy key lookup with none.
0677. **Mixed-alg chains** — chain tokens where the gateway checks alg but the backend doesn't.
0678. **none-alg in nested JWT** — hide alg:none in an inner nested JWT the outer verifier doesn't inspect.
0679. **Algorithm allowlist bypass** — use "HS384" where the allowlist checks only the prefix "HS256".
0680. **none with trailing data** — append data after the signature; the verifier truncates before checking alg.
0681. **kid plus none** — the key-ID lookup returns empty, and empty keys are treated as "no verification."
0682. **x5c with none** — embed a self-signed x5c chain alongside alg:none to confuse validators.
0683. **EdDSA-to-HMAC confusion** — confusion between EdDSA and HMAC where the key material is reused.
0684. **PS256-to-HS256 downgrade** — downgrade RSASSA-PSS to HMAC using the RSA public key.
0685. **JWKS alg mismatch** — the JWKS advertises RS256 but the token uses HS256 with the same key ID.
0686. **none in refresh tokens** — refresh tokens accept alg:none even when access tokens don't.
0687. **none in WebSocket** — the WebSocket auth path skips algorithm checks the HTTP path enforces.
0688. **none in query param** — tokens passed as ?token= accept none where the header path doesn't.
0689. **Legacy-verifier confusion** — a legacy microservice behind the gateway still accepts none after re-signing.
0690. **SAML-derived JWT confusion** — apply alg:none to tokens parsed from SAML assertions by JWT libraries.
0691. **Certificate-as-HMAC-secret** — use the X.509 certificate bytes as the HMAC secret.
0692. **Octet-key confusion** — supply a JWK with kty:oct where the server expected RSA.
0693. **Federation symmetric confusion** — an IdP-issued HS256 token accepted by an RS256-only relying party.
0694. **cty parser switch** — use the content-type header to switch the parser into an unverified mode.
0695. **none in embedded tokens** — tokens embedded in URLs for passwordless login accept alg:none.
0696. **jku SSRF key injection** — point jku at an attacker server to supply the verification key.
0697. **jku DNS rebinding** — serve a malicious JWKS via DNS rebinding to bypass jku allowlists.
0698. **x5u certificate injection** — point x5u at an attacker certificate the verifier trusts without pinning.
0699. **x5u path traversal** — use file:// or path traversal in x5u to load a local key file.
0700. **jku allowlist bypass** — bypass the jku domain allowlist with a subdomain or redirect.
0701. **jku redirect** — the jku URL 301-redirects to an attacker domain after allowlist validation.
0702. **x5u redirect** — validate the original x5u URL, then follow its redirect to the attacker domain.
0703. **JWKS cache poisoning** — replace the JWKS endpoint's keys via cache poisoning so your key verifies.
0704. **JWKS kid collision** — publish a JWKS with a colliding kid the verifier prefers over the real one.
0705. **jku parameter pollution** — supply two jku headers; the allowlist checks one, the fetcher uses the other.
0706. **x5c self-signed trust** — embed a self-signed x5c chain where the verifier doesn't check the trust anchor.
0707. **jku file inclusion** — jku with file:// URLs probes local key material via error messages.
0708. **x5u LDAP exfiltration** — x5u pointing at an LDAP URL exfiltrates data in Java validators.
0709. **jku slow-server** — point jku at a slow server to hang verifiers that fail open on timeout.
0710. **JWKS caching race** — swap the JWKS between the verifier's cache refreshes to get a malicious key trusted.
0711. **kid-to-jku confusion** — the verifier treats the kid value as a jku URL.
0712. **jku data URL** — embed the attacker key in a data: URL in jku where the fetcher supports it.
0713. **x5u data URL** — x5u as a data: URL carrying the attacker certificate.
0714. **jku subdomain takeover** — point jku at a dangling subdomain you claimed to host the JWKS.
0715. **x5t thumbprint collision** — collide the x5t thumbprint to get the wrong certificate selected.
0716. **JWKS x5c chain confusion** — the verifier uses the leaf key without validating the x5c chain.
0717. **Multiple-JWKS merge** — the verifier merges JWKS from jku and a configured URL, preferring the attacker's.
0718. **jku port bypass** — the allowlist checks host but not port; serve the JWKS from an unexpected port.
0719. **jku userinfo** — jku with embedded credentials (https://user:pass@evil) bypasses naive allowlists.
0720. **x5u null-byte** — null-byte truncation in x5u bypasses extension checks.
0721. **JWKS rollover gap** — exploit the rollover window where old and new keys are both trusted to inject a third.
0722. **kid SQL injection** — inject SQL through the kid parameter into the key-lookup query.
0723. **kid path traversal** — kid as ../../dev/null loads an empty key file.
0724. **kid null-byte** — truncate the key filename with a null byte to load an unintended key.
0725. **kid command injection** — kid passed to a shell command in custom key loaders.
0726. **kid LDAP injection** — kid interpolated into an LDAP query for key retrieval.
0727. **kid template injection** — kid rendered in a template during key resolution.
0728. **kid XXE** — kid used in XML key-configuration parsing.
0729. **kid brute force** — enumerate valid kids via timing or error oracles to find signing keys.
0730. **kid to public key** — point kid at the application's own public-key file and use it as the HMAC secret.
0731. **kid to dev-null** — an empty key file means an empty HMAC secret you know.
0732. **kid array injection** — pass kid as an array to bypass string checks and hit default keys.
0733. **kid unicode normalization** — bypass kid allowlists with unicode-equivalent characters.
0734. **kid case collision** — two kids differing only in case resolve to the same key on case-insensitive filesystems.
0735. **kid shell metacharacters** — kid containing pipes and semicolons in popen-based loaders.
0736. **kid Redis injection** — kid interpolated into a Redis lookup with wildcard patterns.
0737. **kid NoSQL injection** — kid as a MongoDB operator selects an arbitrary key document.
0738. **kid length truncation** — overlong kids truncate to a valid key name in the lookup.
0739. **kid symlink** — kid resolving through a symlink to an attacker-controlled key.
0740. **kid default fallback** — an invalid kid falls back to a predictable default key.
0741. **kid enumeration via JWKS** — list valid kids from the public JWKS to target the weakest key.
0742. **Weak HMAC brute force** — crack HS256 secrets with wordlists and GPU cracking.
0743. **Secret-is-public-key** — use the published RSA public key as the HMAC secret.
0744. **Empty-secret tokens** — sign with an empty HMAC secret where the server configured none.
0745. **Secret in repo** — find the JWT secret committed in public repos or frontend bundles.
0746. **Secret in error page** — the secret leaks via stack traces or debug error pages.
0747. **Secret via env leak** — the secret exposed through /env, config endpoints, or CI logs.
0748. **Default-secret reuse** — the app uses the framework's default secret like "secret" or "changeme".
0749. **Short-secret brute force** — brute-force short secrets with GPU cracking within the token's lifetime.
0750. **Dictionary secret** — the secret is a dictionary word vulnerable to wordlist attacks.
0751. **Secret rotation gap** — old secrets stay valid after rotation; crack the weaker old one.
0752. **Per-tenant secret confusion** — use tenant A's weak secret to forge tokens for tenant B.
0753. **Symmetric key in JWKS** — the symmetric key published in the JWKS (kty:oct) for "convenience."
0754. **Secret in mobile app** — extract the hardcoded HMAC secret from the mobile app binary.
0755. **Secret in JS bundle** — the secret embedded in the frontend bundle for client-side token creation.
0756. **Predictable secret** — secrets derived from predictable values like the app name plus year.
0757. **Secret via backup** — old secrets linger in database backups or snapshots.
0758. **Cross-env secret** — production accepts tokens signed with the staging secret.
0759. **Secret timing oracle** — the login endpoint's timing reveals secret correctness, pruning the keyspace.
0760. **Multi-secret weakest link** — the server tries multiple secrets; crack the weakest one in the set.
0761. **Reset-token secret reuse** — recover the secret from the password-reset token, a JWT signed with the same key.
0762. **sub manipulation** — change the subject claim to another user's ID for account takeover.
0763. **aud confusion** — retarget a token issued for one audience to a different service sharing the key.
0764. **iss spoofing** — forge the issuer claim where the verifier doesn't pin the expected issuer.
0765. **exp removal** — delete the expiry claim where the verifier treats missing exp as never-expiring.
0766. **exp far-future** — set expiry decades out on a token minted from a short-lived one.
0767. **nbf backdate** — set not-before in the past to activate a token immediately.
0768. **iat manipulation** — forge issued-at to bypass token-age checks.
0769. **jti replay** — replay a token where the jti blacklist isn't enforced.
0770. **Scope escalation in claims** — add admin scopes to the scope claim the API trusts.
0771. **Role claim injection** — add "role":"admin" where the app reads roles from the token.
0772. **Tenant claim swap** — change the tenant ID to access another tenant's data.
0773. **Email claim takeover** — change the email claim to the victim's on a service that trusts it.
0774. **Username claim lookup** — the app looks up users by a mutable username claim instead of sub.
0775. **Groups claim injection** — add privileged groups to the groups claim.
0776. **amr spoofing** — forge the authentication-methods claim to skip step-up auth.
0777. **acr spoofing** — claim a higher assurance level than actually performed.
0778. **auth_time backdate** — forge auth_time to satisfy re-authentication freshness checks.
0779. **nonce reuse** — replay tokens where the nonce isn't tracked.
0780. **Custom-claim trust** — the app trusts custom claims like "is_admin" or "plan":"enterprise."
0781. **Claim-type confusion** — pass the user ID as an integer versus string to bypass claim matching.
0782. **Nested-claim injection** — inject claims inside a nested JSON object the verifier flattens.
0783. **Duplicate-claim parsing** — send two "sub" claims; the verifier reads the second, the logger the first.
0784. **Unicode sub** — use unicode-normalized variants of a victim's ID to collide.
0785. **Empty sub** — an empty subject is treated as an admin or wildcard user.
0786. **Wildcard aud** — aud:"*" accepted by services that should require exact match.
0787. **Multi-aud confusion** — add your service to the aud array of a token meant for another.
0788. **azp confusion** — confuse the authorized-party claim to impersonate a trusted client.
0789. **Claim injection via signup** — profile fields (name, bio) flow into token claims unsanitized, enabling claim smuggling.
0790. **Token chaining** — use a low-privilege token's claims to mint a higher-privilege token at the token-exchange endpoint.
0791. **act claim abuse** — abuse the "act" (actor) claim in delegation to impersonate downstream users.
0792. **Redirect path confusion** — use /callback/../evil to bypass exact-match redirect validation.
0793. **Redirect fragment** — append #@evil.com to confuse parsers about the real host.
0794. **Subdomain-takeover redirect** — register a whitelisted subdomain pattern via takeover.
0795. **Wildcard-subdomain abuse** — *.example.com allows evil.example.com that you registered.
0796. **Redirect regex bypass** — bypass naive regexes with userinfo (https://good@evil).
0797. **Redirect scheme downgrade** — switch https to http where the validator only checks the host.
0798. **Redirect port bypass** — the validator ignores ports; use good.com:8443@evil.
0799. **Redirect with at-sign** — https://whitelisted@attacker.com passes naive startsWith checks.
0800. **Redirect unicode** — use unicode domains that normalize to attacker-controlled hosts.
0801. **Redirect punycode** — register the punycode variant of a whitelisted domain.
0802. **Redirect path traversal** — /%2e%2e/ sequences that resolve server-side to attacker paths.
0803. **Open-redirect chain** — chain the OAuth redirect through an open redirect on the whitelisted domain.
0804. **Redirect via shortener** — whitelisted shortener domains expand to attacker URLs.
0805. **Redirect query injection** — inject &redirect_uri=evil as a query param the backend parses.
0806. **Redirect parameter pollution** — supply two redirect_uri params; validation reads one, the IdP uses the other.
0807. **Redirect whitespace** — newline or space injection truncates the validated URI.
0808. **Redirect case tricks** — hTTps://GOOD.com defeats case-sensitive exact matching.
0809. **Redirect trailing dot** — good.com. resolves to good.com but may bypass string matching.
0810. **Mobile-scheme hijack** — register the app's custom URI scheme to intercept the OAuth redirect on device.
0811. **App-link downgrade** — the app claims https app-links but falls back to the custom scheme you registered.
0812. **Redirect to javascript** — javascript: URIs in hybrid apps execute in the WebView.
0813. **Redirect to data** — data: URLs exfiltrate the code via navigation.
0814. **Redirect with credentials** — https://user:pass@whitelisted confuses the host parser.
0815. **Redirect double-encode** — double-encoded characters decode after validation.
0816. **Redirect semicolon** — semicolon params (;/evil) treated as path separators by some servers.
0817. **Redirect backslash** — backslash acts as separator on Windows-based validators.
0818. **Redirect via 404 page** — point the redirect at a 404 page that reflects the code in its body or JS.
0819. **Loopback redirect theft** — use 127.0.0.1 variants (0.0.0.0, [::]) to steal codes via local interception.
0820. **PKCE downgrade to plain** — send code_challenge_method=plain with a known verifier.
0821. **PKCE omission** — omit code_challenge entirely where the server doesn't enforce it.
0822. **Verifier interception** — steal the authorization code and supply your own verifier by re-running the flow.
0823. **code_challenge truncation** — the server truncates long challenges, letting you brute-force the remainder.
0824. **S256-to-plain downgrade** — the server accepts plain even when the client sent S256.
0825. **Verifier entropy** — verifiers generated with weak RNG are predictable.
0826. **Verifier reuse** — reuse one verifier across flows where the server doesn't bind it to the session.
0827. **Challenge injection** — inject your own code_challenge into the victim's authorization request via CSRF.
0828. **PKCE bypass via confidential client** — switch the client to confidential to skip PKCE where the server allows.
0829. **Authorization-code interception** — intercept the code on the redirect and exchange it before the victim.
0830. **Challenge-method confusion** — send method=S256 but a plain verifier; the server hashes inconsistently.
0831. **Verifier length** — the server accepts 1-character verifiers, making brute force trivial.
0832. **PKCE drop on refresh** — the refresh flow drops the PKCE binding, letting stolen refresh tokens work anywhere.
0833. **Code-challenge replay** — replay a victim's challenge with your own session to bind their code to you.
0834. **PKCE-less token endpoint** — the token endpoint doesn't check the verifier at all.
0835. **Downgrade via authorize params** — tamper the authorize request to strip PKCE before the user approves.
0836. **Verifier in logs** — the verifier leaks in referer or logs; harvest it to exchange intercepted codes.
0837. **Plain-method brute force** — with method=plain the verifier equals the challenge, so it's visible.
0838. **Authorization-code replay** — replay a used code where the server doesn't mark codes single-use.
0839. **Code leakage via Referer** — the code leaks in the Referer header to third-party resources on the landing page.
0840. **Code in browser history** — codes persist in history; extract them from a shared machine.
0841. **Code in logs** — authorization codes logged server-side are harvested and replayed.
0842. **Code phishing** — phish the code by getting the victim to authorize your malicious client.
0843. **Code injection** — inject an attacker-known code into the victim's session (login CSRF).
0844. **client_secret brute force** — brute-force weak client secrets at the token endpoint.
0845. **client_secret in app** — extract the secret from a public mobile or SPA client that can't keep secrets.
0846. **client_secret in repo** — find secrets committed in public code.
0847. **client_secret rotation gap** — old secrets stay valid; use the leaked old one.
0848. **Public-client impersonation** — impersonate a public client by omitting the secret where the server doesn't distinguish.
0849. **client_assertion confusion** — forge client assertions where the server accepts self-signed JWTs.
0850. **Token-endpoint client confusion** — use one client's code with another client's credentials.
0851. **Code bound to wrong client** — the code isn't bound to client_id; exchange it as a different client.
0852. **Redirect-code swap** — swap the victim's code for yours in the callback.
0853. **Code lifetime** — codes valid for hours give a long replay window.
0854. **Code entropy** — short or predictable codes are guessable.
0855. **Pre-authorized code** — the IdP issues codes without user interaction for pre-consented clients; abuse silent auth.
0856. **Code via postMessage** — the code is delivered via postMessage to any origin due to wildcard target.
0857. **Code in error page** — failed exchanges echo the code in error responses.
0858. **Secretless refresh** — refresh tokens work without the client secret where the server misconfigures.
0859. **Code-exchange race** — exchange the same code twice concurrently before single-use marking.
0860. **Implicit token in URL** — tokens in the fragment leak via browser history and referer.
0861. **Implicit token via postMessage** — wildcard postMessage leaks the fragment token.
0862. **Implicit-flow downgrade** — force response_type=token where the server still supports implicit.
0863. **Token leakage in analytics** — analytics scripts reading location.hash capture the token.
0864. **Implicit CSRF** — no state validation lets attackers inject their token into the victim's session.
0865. **Implicit token replay** — replay an implicit token at the API without client authentication.
0866. **Hybrid-flow confusion** — mix code and token flows to get a token without PKCE.
0867. **Fragment injection** — inject extra params into the fragment the client parses.
0868. **Implicit-to-code swap** — exchange an implicit token for a code-bearing session.
0869. **Silent-auth token theft** — abuse prompt=none iframes to harvest tokens for logged-in victims.
0870. **Token in 404 page** — the SPA's 404 handler reflects the fragment into the DOM.
0871. **Third-party script theft** — analytics scripts exfiltrate location.hash with the token.
0872. **Address-bar exposure** — the token visible in the address bar on shared screens.
0873. **Copy-paste leak** — users paste callback URLs with tokens into support chats.
0874. **Refresh-token replay** — reuse a rotated refresh token where rotation isn't enforced.
0875. **Refresh-token theft** — steal the refresh token from insecure storage and use it indefinitely.
0876. **Rotation-grace abuse** — the grace period for the old token lets both old and new work.
0877. **Unbound refresh token** — tokens not bound to a device work from anywhere.
0878. **Refresh flood** — flood the refresh endpoint to extend sessions indefinitely.
0879. **Scope escalation on refresh** — request broader scopes at refresh time than originally granted.
0880. **Refresh-token exchange** — exchange a refresh token at a different IdP in a federation.
0881. **Offline-access abuse** — the offline_access scope yields non-expiring refresh tokens.
0882. **Refresh token in logs** — refresh tokens logged in plaintext are replayed.
0883. **Family-token abuse** — a compromised family refresh token mints new tokens for all apps.
0884. **Refresh-before-expiry race** — refresh concurrently to get two valid token sets.
0885. **Revocation lag** — revoked refresh tokens work until the revocation propagates.
0886. **Refresh-token fixation** — plant a known refresh token in the victim's session.
0887. **Sliding-session abuse** — activity keeps sliding the refresh window forever.
0888. **Refresh token in URL** — refresh tokens passed as query params leak in logs.
0889. **Device-code refresh** — device-flow refresh tokens never expire and are portable.
0890. **Reuse-detector bypass** — the reuse detector only checks the last token, so alternate two tokens.
0891. **Cross-client refresh** — use one client's refresh token at another client's token endpoint.
0892. **Device-flow phishing** — phish the user_code by mimicking the device verification page.
0893. **User-code brute force** — guess the short user_code within its validity window.
0894. **Code-interception polling** — poll the token endpoint with an intercepted device_code.
0895. **Device-code entropy** — predictable device_codes are guessable.
0896. **Verification-URI swap** — trick the user into visiting your verification URI.
0897. **Device-flow CSRF** — initiate a device flow for the victim and get them to approve your session.
0898. **Slow-down bypass** — ignore the slow_down response to poll faster and win races.
0899. **Device-code lifetime** — long-lived codes extend the phishing window.
0900. **Expired-code reuse** — expired device codes are still accepted.
0901. **Device-flow scope escalation** — request extra scopes at the token poll step.
0902. **Unattended-device approval** — approve your own device flow on a logged-in unattended machine.
0903. **QR-code swap** — replace the device's QR code with one encoding your verification URI.
0904. **SAML signature wrapping** — move the signed assertion and inject a forged one the verifier checks differently.
0905. **XSW duplicate ID** — duplicate the ID attribute so the signature validates a different node.
0906. **XSW namespaced** — hide the malicious assertion in a different namespace.
0907. **XSW comment** — wrap the original assertion in comments the parser ignores.
0908. **Response tampering** — modify the SAML response where the signature isn't validated.
0909. **Assertion injection** — inject a second unsigned assertion the service provider processes.
0910. **Signature exclusion** — strip the signature where the service provider doesn't require one.
0911. **SAML algorithm downgrade** — force the provider to accept unsigned or HMAC-signed assertions.
0912. **Recipient confusion** — retarget an assertion meant for another service provider.
0913. **Audience confusion** — the audience check is skipped or wildcarded.
0914. **NotOnOrAfter bypass** — the provider doesn't enforce assertion expiry.
0915. **NotBefore bypass** — use assertions before their validity window.
0916. **InResponseTo missing** — the provider doesn't validate InResponseTo, enabling replayed unsolicited responses.
0917. **Unsolicited-response abuse** — send unsolicited responses the provider accepts without a matching request.
0918. **SessionIndex confusion** — log out one session while another stays active.
0919. **NameID manipulation** — change the NameID to impersonate another user.
0920. **NameID format confusion** — switch formats (email versus persistent) to collide identities.
0921. **Attribute injection** — add admin attributes the provider trusts from the assertion.
0922. **Attribute case** — "Admin" versus "admin" group confusion.
0923. **Encrypted-assertion bypass** — the provider falls back to plaintext assertions you can forge.
0924. **IdP key-rollover gap** — the provider trusts both old and new IdP certs; forge with the weaker old key.
0925. **Rogue IdP registration** — register a rogue IdP with a self-signed certificate the provider trusts.
0926. **Logout-request forgery** — forge logout requests to kill victims' sessions.
0927. **Artifact-resolution abuse** — intercept the artifact and resolve it yourself.
0928. **Nonce omission** — the relying party doesn't send or validate the nonce, enabling replay.
0929. **State omission** — no state parameter lets attackers inject their code (login CSRF).
0930. **State predictability** — predictable state values let attackers forge the callback.
0931. **State reuse** — the same state is accepted twice, enabling replay.
0932. **Nonce reuse** — a captured ID token replays because the nonce isn't tracked.
0933. **State-to-session binding** — the state isn't bound to the browser session.
0934. **PKCE-nonce confusion** — the nonce doubles as the PKCE verifier, weakening both.
0935. **Fragment-state leak** — state in the fragment leaks via referer.
0936. **State in logs** — the state value logged server-side aids session hijack.
0937. **max_age bypass** — the relying party doesn't enforce max_age, accepting stale authentications.
0938. **auth_time missing** — the ID token lacks auth_time and the relying party doesn't require it.
0939. **prompt=none abuse** — silent authentication issues tokens without user interaction for clickjacking.
0940. **ui_locales injection** — inject content via ui_locales reflected in the login page.
0941. **login_hint manipulation** — the login_hint pre-fills a victim's identifier for phishing.
0942. **PAR bypass** — skip the pushed request and call authorize directly with tampered params.
0943. **Request-URI prediction** — guessable request_uris let attackers use others' pushed requests.
0944. **Request-URI replay** — replay a request_uri before it expires.
0945. **PAR-to-victim binding** — the request_uri isn't bound to the client session.
0946. **PAR expiry** — long-lived request_uris extend the attack window.
0947. **Unsigned PAR** — the PAR endpoint accepts unsigned requests, letting attackers push malicious params.
0948. **PAR client confusion** — use one client's request_uri with another client's credentials.
0949. **PAR redirect tampering** — tamper the redirect after PAR where the authorize step doesn't revalidate.
0950. **PAR scope escalation** — push minimal scopes, then escalate at the authorize step.
0951. **PAR audience confusion** — the request_uri works across relying parties sharing the authorization server.
0952. **PAR replay across devices** — use the victim's request_uri on the attacker's device.
0953. **PAR error oracle** — error messages reveal whether a request_uri exists, enabling enumeration.
0954. **JWT in query params** — tokens in ?token= leak in logs, referers, and history.
0955. **JWT in WebSocket upgrade** — the WebSocket handshake skips the signature checks the HTTP layer enforces.
0956. **JWT in fragment** — tokens in #fragment are exposed to client-side scripts.
0957. **JWT cookie without flags** — JWT cookies missing HttpOnly and Secure are exfiltrated via script.
0958. **JWT in postMessage** — tokens passed via postMessage with wildcard origins leak.
0959. **JWT in localStorage** — tokens in localStorage are stolen by any injected script.
0960. **Cookie-versus-header confusion** — the API accepts the token from the weaker-validated location.
0961. **Token in WS subprotocol** — the subprotocol header carries a token the gateway doesn't validate.
0962. **Token in WS query** — ?access_token= on the WebSocket URL is logged by intermediaries.
0963. **Mixed-token confusion** — the server reads the user from the cookie but the scopes from the query token.
0964. **Token replay across protocols** — an HTTP token is accepted on MQTT or WebSocket without rebinding.
0965. **Query-token caching** — the CDN caches responses keyed without the token, leaking data cross-user.
0966. **Token in error redirect** — error pages redirect with the token in the URL.
0967. **WS re-auth gap** — the WebSocket connection stays alive after the JWT expires or is revoked.
0968. **IdP mix-up** — confuse the relying party into accepting an attacker's IdP token as the honest IdP's.
0969. **Malicious-endpoint IdP** — register a rogue IdP whose discovery document points at attacker endpoints.
0970. **Issuer confusion** — the relying party doesn't pin the issuer, accepting any IdP's tokens.
0971. **Discovery-document spoofing** — spoof the .well-known document to redirect token validation.
0972. **JWKS-URI confusion** — the relying party fetches keys from the attacker's JWKS URI in the spoofed discovery doc.
0973. **Scope escalation** — request admin scopes the user never consented to at the authorize step.
0974. **Scope-enforcement gap** — the API enforces fewer scopes than the authorize screen showed.
0975. **Incremental-consent abuse** — stack incremental consent grants to exceed the original authorization.
0976. **Scope-delimiter tricks** — space versus comma delimiters parsed differently by AS and RS.
0977. **Wildcard scope** — the AS issues scope *:* that the resource server interprets broadly.
0978. **Scope injection via redirect** — inject scope=admin into the authorize URL the user approves blindly.
0979. **Cross-IdP token reuse** — a token from IdP-A is accepted by a relying party trusting IdP-B with the same key.
0980. **Federation metadata tampering** — tamper the SAML or OIDC metadata to add attacker endpoints.
0981. **IdP-initiated SSO abuse** — forge IdP-initiated logins the provider accepts without request tracking.
0982. **Account-linking confusion** — link the attacker's IdP account to the victim's local account.
0983. **JIT-provisioning abuse** — just-in-time provisioning creates admin accounts from crafted IdP attributes.
0984. **Token in server logs** — JWTs logged in plaintext are harvested from log disclosures.
0985. **Token in error pages** — stack traces echo the Authorization header.
0986. **Token in analytics** — analytics scripts capture the token from the URL.
0987. **Token in support tickets** — users paste callback URLs with tokens into support chats.
0988. **Token in git history** — tokens committed in code or Postman collections.
0989. **Token in CI logs** — tokens printed in build logs.
0990. **Token in crash reports** — crash dumps include Authorization headers.
0991. **Token in APM traces** — APM tools record tokens in trace data.
0992. **Token in cache keys** — tokens embedded in cache keys leak via cache introspection.
0993. **Token in backups** — database backups contain active tokens.
0994. **Token in browser extensions** — malicious extensions read tokens from storage.
0995. **Token via DNS prefetch** — DNS prefetch of token-bearing URLs leaks to resolvers.
0996. **Token in proxy logs** — corporate proxies log full URLs including query tokens.
0997. **Token in WAF logs** — WAFs log the Authorization header on blocked requests.
0998. **Token in email** — magic-link tokens forwarded or CC'd leak.
0999. **Token in calendar invites** — meeting URLs with embedded tokens leak to attendees.
1000. **Token-lifetime audit** — audit token lifetimes to find non-expiring service tokens for persistence.
