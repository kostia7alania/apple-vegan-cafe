# Menu sync (Grab → website) — the legal, confirmed way

Automated scraping of food.grab.com is **prohibited by Grab's Terms of Service**
(Transport/Delivery ToS Cl. 3.1.11 "web spiders, web crawlers…" and 3.1.12
"data mining or scraping") — it risks the merchant account and is deliberately
not implemented anywhere in this repo.

The sanctioned source is the owner's own catalogue export:

## How the family syncs the menu (quarterly or after menu changes)

1. **Owner**: GrabMerchant Portal → Menu → **Bulk Update → Download** the
   catalogue (their own account, officially supported feature). Convert to CSV
   with columns: `name_en,name_th,price_thb,category,description,photo_file,availability`.
2. Upload the file here as `imports/menu.csv` (GitHub web UI → Add file →
   Upload, straight to `main` or via PR).
3. CI automatically runs a **dry-run diff** — the "Menu import" workflow
   summary shows exactly what is NEW / CHANGED / UNCHANGED. Nothing is applied.
4. To apply: Actions → **Menu import** → Run workflow. It writes the dish
   files and opens a **pull request** — one file per dish, so the family
   reviews and can reject individual dishes ("выбрать, что притащить").
5. Merging the PR = confirmation → the site rebuilds and deploys.

Every imported dish is stamped `source: "grab_export"`, `reviewedAt: null`;
the owner sets `reviewedAt` after checking price/photo/description.
