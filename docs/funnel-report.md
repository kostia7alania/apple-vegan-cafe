# 30-day funnel report

`pnpm funnel:report -- <export.csv>` turns one privacy-safe aggregate export into
a deterministic baseline for site discovery → menu → Grab/call/maps actions. It
does not call an analytics API and does not write files.

## CSV contract

The header must contain exactly these five columns (order does not matter):

```csv
date,page_path,event_name,provider,count
```

- `date`: real `YYYY-MM-DD` date in the analytics property's `Asia/Bangkok`
  calendar.
- `page_path`: canonical path only, starting with `/`; no origin, query string,
  fragment, whitespace or duplicate slash. `/menu/`, `/th/menu/` and
  `/ru/menu/` are the three menu paths used by the report.
- `event_name`: lower-case analytics event name. The required funnel events are
  `page_view`, `order_click`, `phone_click`, `directions_click` and
  `review_click`.
- `provider`: empty for `page_view`; required for the three action events. The
  export step must normalize GA4's `provider`, `order_provider`,
  `contact_method`, `map_provider` and `review_provider` dimensions into this
  column, for example `grab`, `phone`, `google` and `happycow`.
- `count`: non-negative safe integer. This is an aggregate event count, never a
  user/session identifier.

No additional columns are accepted. In particular, never export client IDs,
user IDs, session IDs, IP addresses, phone numbers, URLs with query strings or
free-form event parameters.

## Complete-window rule

The file must contain exactly 30 consecutive dates and the final date must be
before today's date in `Asia/Bangkok`. Every date and every locale must have at
least one row for each required event, a `page_view` row for that locale's exact
menu path, and a row for every action-event/provider pair observed anywhere in
the file. Add a row with `count=0` when a segment had no occurrences; this
proves that the date/locale/provider segment was exported rather than silently
filtered out. Aggregate dimensions (`date`, `page_path`, `event_name`,
`provider`) must be unique.

Minimal single-day shape inside a real 30-day export:

```csv
date,page_path,event_name,provider,count
2026-07-01,/,page_view,,42
2026-07-01,/menu/,page_view,,18
2026-07-01,/menu/,order_click,grab,4
2026-07-01,/menu/,phone_click,phone,1
2026-07-01,/contact/,directions_click,google,0
2026-07-01,/,review_click,happycow,1
2026-07-01,/th/menu/,page_view,,0
2026-07-01,/th/menu/,order_click,grab,0
2026-07-01,/th/menu/,phone_click,phone,0
2026-07-01,/th/contact/,directions_click,google,0
2026-07-01,/th/,review_click,happycow,0
2026-07-01,/ru/menu/,page_view,,0
2026-07-01,/ru/menu/,order_click,grab,0
2026-07-01,/ru/menu/,phone_click,phone,0
2026-07-01,/ru/contact/,directions_click,google,0
2026-07-01,/ru/,review_click,happycow,0
```

Extra aggregate events such as `profile_click` may remain in the file. They are
validated and counted as ignored, but they cannot change funnel totals or
opportunity ranking.

## Output and exit codes

The report prints totals and event ratios overall, by `en`/`th`/`ru`, and by
provider. Rates use two decimal places and deterministic ordering. They are
event/page-view ratios, not unique-user or session conversion rates.

The three opportunity slots use fixed evidence rules: the locale with the
largest observed non-menu page-view gap, the locale with the largest menu-view
to menu-action gap, and the lowest-volume mandatory action provider. They are
prompts for the next product check, not causal claims.

- exit `0`: a valid report was printed;
- exit `1`: malformed or privacy-unsafe export;
- exit `2`: `INSUFFICIENT DATA` — the 30-day window or required event coverage
  is incomplete. Missing data is never rendered as a zero conversion rate.
