# Menu sync (Grab → website) — the legal, confirmed way

Automated scraping of food.grab.com is **prohibited by Grab's Terms of Service**
(Transport/Delivery ToS Cl. 3.1.11 "web spiders, web crawlers…" and 3.1.12
"data mining or scraping") — it risks the merchant account and is deliberately
not implemented anywhere in this repo.

The sanctioned source is the owner's own catalogue export:

## How the family syncs the menu (quarterly or after menu changes)

1. **Owner**: GrabMerchant Portal → Menu → **Bulk Update → Download** the
   catalogue (their own account, officially supported feature). The raw CSV is
   accepted locally as-is; do not commit it because it contains Grab CDN URLs
   and operational columns that the website does not need.
2. Run `pnpm import:menu -- --input /path/to/export.csv`. Identity is the exact
   `*ItemID`, never a display name. To use the optional GitHub workflow, upload
   only a sanitized `imports/menu.csv` with columns
   `grab_item_id,name_en,name_th,price_thb,category,availability` and no photo or
   merchant-internal columns.
3. CI automatically runs a **dry-run diff** — the "Menu import" workflow
   summary shows exactly what is NEW / CHANGED / UNCHANGED. Nothing is applied.
4. To apply: Actions → **Menu import** → Run workflow. It writes the dish
   files and opens a **pull request** — one file per dish, so the family
   reviews and can reject individual dishes ("выбрать, что притащить").
5. Merging the PR = confirmation → the site rebuilds and deploys.

Known dishes retain names, slugs, descriptions, images, featured flags,
`reviewedAt` and verified food facts. The importer changes only price, site
category and permanent availability after validating the complete file. New
ItemIDs fail closed until a human creates and maps the localized dish record.
