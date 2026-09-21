# Marketing analytics playbook

This is the measurement contract for Apple Vegan Cafe. It is intentionally
small enough to operate without an analytics team and strict enough not to call
an outbound click a completed order.

## Current production state

Verified 2026-09-21:

- Cloudflare Web Analytics is active at the edge for page views and Web Vitals.
- Cloudflare does not support custom events or UTM reports, so it cannot be the
  button-goal or campaign-ROI system.
- The dedicated GA4 property `Apple Vegan Cafe` and web stream
  `Apple Vegan Cafe Website` were created with Thailand reporting time and THB.
  Enhanced Measurement is off, so sanitized custom page views and CTA events
  are the only site events. The approved stream ID is stored in the GitHub
  repository variable `PUBLIC_GA_MEASUREMENT_ID`. The rendered site starts
  privacy-reduced analytics by default unless the guest has explicitly opted out.
- Do not set `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`; the edge already injects
  that beacon and a second token would double-count page views.

GA4 analytics storage is granted by default outside the EEA, UK and Switzerland.
Those regulated regions stay denied until the guest explicitly grants consent,
while Google Consent Mode can retain cookieless measurement. Advertising
storage, Google signals, ad personalisation and site-side user IDs stay disabled
everywhere. The EN/TH/RU control explains the default on the first visit and is
available from the footer at all times.

An explicit opt-out is persisted, immediately pauses site event dispatch,
clears first-party GA cookies and prevents the Google tag from loading on later
pages. Menu query text and filter query strings are removed from
`page_location`; only controlled `utm_*` and Google Ads attribution parameters
are allowed through. This is an owner-selected opt-out policy with regional
Consent Mode safeguards, not permission to bypass local privacy requirements.

Consent, configuration and the sanitized page view are queued immediately, but
the non-critical Google runtime loads only after the first interaction outside
the settings panel or after 10 seconds. An explicit opt-out cancels that load;
if the runtime is already present, the opt-out disables the GA4 property. An
explicit opt-in loads it immediately. This keeps the tag out of the critical
render path. Passive visits shorter than 10 seconds can leave before the queued
page view reaches GA4, so short-bounce counts are intentionally conservative.

## Business goals

Mark only events backed by a live CTA as **key events**. They are qualified
intent, not confirmed revenue:

| Event                       | Business meaning               | Current site  |
| --------------------------- | ------------------------------ | ------------- |
| `order_click`               | Leaves for a delivery provider | Active CTA    |
| `phone_click`               | Starts a call                  | Active CTA    |
| `directions_click`          | Opens the verified Maps pin    | Active CTA    |
| `contact_click`             | Starts LINE, WhatsApp or email | Not published |
| `dietary_contact_click`     | Asks a dietary-safety question | Not published |
| `pickup_contact_click`      | Starts a pickup enquiry        | Not published |
| `reservation_contact_click` | Starts a reservation enquiry   | Not published |

At launch, mark `order_click`, `phone_click` and `directions_click`. Promote the
other events after the corresponding owner-confirmed CTA is published and its
first event is validated. Do not mark `cta_view`, discovery, menu UX, review or
social events as key events.

`cta_view` is the denominator for per-button CTR. It fires once per page load
when at least half of a declared goal CTA becomes visible and carries
`goal_name`, `placement` and `provider`.

The remaining events explain _why_ conversion changes:

| Funnel area | Events                                                                                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discovery   | `page_view`, `menu_click`, `menu_item_click`                                                                                                                                                  |
| Menu use    | `menu_search`, `menu_filtered_view`, `menu_filter_change`, `menu_filters_clear`, `menu_category_click`, `menu_popular_pick_click`, `menu_photo_open`, `menu_search_jump`, `menu_zero_results` |
| Trust       | `profile_click`, `review_click`, `social_click`, `outbound_click`                                                                                                                             |

All events include sanitized `page_location` and `site_language`. Relevant
events additionally use only controlled dimensions: `provider`, `placement`,
`goal_name`, `dish_id`, `dish_category`, `filter_name`, `filter_state`, `result_state`,
`interaction_type`, `query_length_bucket`, `active_filter_count`,
`diet_filter_count` and `result_count`. Search terms, phone numbers, email
addresses and arbitrary link URLs are not event parameters.

## Funnels and conversion definitions

### Delivery funnel

1. Discovery: landing `page_view`.
2. Menu intent: menu page view or `menu_click`.
3. Product discovery: search, category, popular-pick, item or photo interaction.
4. Order intent: `order_click`.
5. Completed order: import from Grab/another ordering system when a reliable
   export or integration exists.

### Visit funnel

1. Discovery: landing `page_view`.
2. Location intent: contact page view.
3. Visit intent: `directions_click` or `phone_click`.
4. Cafe visit: offline conversion, measurable only through an owner-approved
   proxy such as a campaign coupon or POS source field.

### Dietary lead funnel

1. Menu or FAQ page view.
2. Dietary guidance viewed/used.
3. `dietary_contact_click`.
4. Answered/qualified enquiry: optional aggregate CRM/POS import.

Use these formulas consistently in a session-scoped exploration:

- qualified session rate = sessions with any qualified key event / sessions;
- menu-to-order session rate = sessions with `order_click` after a menu view /
  sessions with a menu view;
- CTA CTR = goal clicks / matching `cta_view`, grouped by `placement`;
- submitted zero-result rate = `menu_search` with `result_state=zero` / all
  `menu_search` events;
- landing zero-result rate = `menu_filtered_view` with `result_state=zero` / all
  `menu_filtered_view` events;
- order-intent CPA = advertising spend / paid-attributed `order_click`;
- completed-order CPA = advertising spend / imported completed orders;
- ROAS = imported revenue / advertising spend;
- contribution ROI = (net revenue - COGS - provider commissions - discounts -
  payment fees - advertising spend) / advertising spend;
- break-even ROAS = 1 / contribution-margin rate.

Never label `order_click` as `purchase`. Until order/revenue data is imported,
CPA is an **intent CPA** and ROI is unavailable. A forecast may use
`order_click × owner-supplied click-to-order rate × AOV`, but it must be labelled
modelled revenue, never actual revenue.

## Dashboard for a marketer

Build one GA4 Exploration or Looker Studio report with six pages:

1. **Executive, last 30 days** — page views, menu views, qualified actions,
   qualified session rate, menu-to-order session rate, zero-result rate and
   30-day trend.
2. **Acquisition** — source / medium / campaign / landing page with page views,
   menu intent, order intent, qualified session rate, spend, intent CPA and, once
   imported, orders/revenue/ROAS.
3. **CTA performance** — `goal_name` × `placement` × `provider`, with `cta_view`,
   clicks and CTR. This answers which exact button position works.
4. **Menu demand** — searches, result-state mix, zero-result rate, filters,
   categories, popular picks and item/photo engagement. No raw search term is
   collected.
5. **Audience quality** — locale, device category, landing page and channel;
   compare rates rather than raw volume.
6. **Local Google performance** — after the verified Business Profile is linked,
   show GBP website clicks, calls, directions and menu clicks alongside the
   website's own `phone_click` and `directions_click`. Keep GBP actions and
   website events separate because they are actions, not deduplicated customers.

Create event-scoped custom dimensions for `placement`, `provider`, `goal_name`,
`site_language`, `dish_id`, `dish_category`, `filter_name`, `filter_state`,
`result_state`, `interaction_type` and `query_length_bucket`. Create custom
metrics for `result_count` and `active_filter_count` only if the menu
diagnostics page needs them.

The repository also contains a privacy-safe aggregate fallback:

```bash
pnpm funnel:report -- export.csv
```

Its strict 30-day input and interpretation rules are in
[`funnel-report.md`](funnel-report.md). Use it when dashboard access is
unavailable; its ratios are event/page-view ratios, not user conversion rates.

## UTM contract

Every owned campaign link must use lower-case, stable values:

- `utm_source`: `instagram`, `google`, `telegram`, `happycow`, `qr`, or a stable
  lower-case partner slug;
- `utm_medium`: `cpc`, `organic`, `paid_social`, `organic_social`, `referral`,
  `offline`;
- `utm_id`: immutable campaign ID for paid, partner and offline campaigns;
- `utm_campaign`: `yyyy_qn_objective_market`, for example
  `2026_q3_delivery_pattaya`;
- `utm_content`: creative/placement, for example `reel_red_curry`;
- `utm_term`: paid-search keyword only.

Do not put names, phone numbers, emails or free text into UTM values. Never
change naming mid-campaign. Google Ads uses native linking and auto-tagging,
without manual source/medium overrides. Preserve the final campaign URL in the
ad account and weekly report so non-Google cost imports can join on
`date + utm_id + source + medium` in THB.

When Business Profile manager access becomes available, use this exact website
link contract and keep it stable:

```text
https://apple-vegan-cafe.com/?utm_source=google&utm_medium=organic&utm_campaign=gbp_pattaya&utm_content=website
```

## Initial targets

The first 30 complete Bangkok days are the baseline. Before that, numerical
conversion claims are hypotheses. After the baseline:

- keep goal payload completeness (`placement` + `provider`) above 95%;
- keep menu zero-result rate below 5%, or fix the highest-volume discovery gap;
- improve menu-to-order session rate by 15% relative over the next 60 days;
- improve the weakest high-impression CTA placement by 20% relative through one
  controlled copy/layout test;
- cap paid intent CPA at
  `contribution profit per completed order × verified click-to-order rate`;
- set actual ROAS/ROI targets only after COGS, order and revenue imports exist.

These are operating targets, not invented historical performance. Re-baseline
after material menu, ordering-provider or campaign changes.

## Activation checklist

1. Use the dedicated `Apple Vegan Cafe` property and web stream, Thailand time
   zone, THB, 14-month event-data retention and data-driven attribution.
2. Add its public `G-...` ID as the GitHub repository variable
   `PUBLIC_GA_MEASUREMENT_ID`.
3. Deploy through the gated `main` workflow; do not deploy an unverified local
   build.
4. In GA4, register the dimensions above and mark `order_click`, `phone_click`
   and `directions_click` as initial key events.
5. Keep the existing Search Console link. Link the verified Google Business
   Profile only after correct owner/manager access is available. Link Google Ads
   only if the cafe has a suitable owner account; never create spend from this
   checklist.
6. Validate one EN, TH and RU journey in Realtime/DebugView: consent choice,
   page view, menu search, CTA view and CTA click. Confirm raw menu text is absent.
7. Start the 30-day baseline only after all checks pass and campaign links
   follow the UTM contract.
8. Import daily ad cost by campaign ID/source/medium. Add completed orders, revenue and
   COGS only from a reliable owner-controlled source.

Official references: [GA4 event parameters](https://support.google.com/analytics/answer/13675006),
[recommended events](https://support.google.com/analytics/answer/9267735),
[key events](https://support.google.com/analytics/answer/12229021), and
[Cloudflare Web Analytics FAQ](https://developers.cloudflare.com/web-analytics/faq/).
