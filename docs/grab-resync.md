# Ре-синк меню из Grab (квартальный)

Источник истины по составу меню и ценам доставки — каталог хозяйки в GrabMerchant.
Скрейпить food.grab.com **нельзя** (ToS Cl. 3.1.11/3.1.12); единственный законный
источник — экспорт, который хозяйка делает сама.

## Как хозяйка делает экспорт

GrabMerchant (портал merchant.grab.com, не приложение) → Menu → **Bulk Update** →
Download. Получается zip с CSV (`*ItemID,*ItemName,*Price,*CategoryName,…`).
Пошаговая инструкция на тайском — в `HANDOVER-th.md`, §8.

## Как восстановить изображения, которых больше нет у семьи

Excel/CSV не содержит фотографий. Для разового recovery используется отдельный fail-closed
коннектор, который принимает только скопированный JSON response каталога из авторизованного
GrabMerchant, официальный Partner API menu payload или Chrome `Export HAR (sanitized)`:

```bash
pnpm grab:photos -- --input /private/tmp/grab-menu-response.json --provenance ai-generated
```

Dry-run сопоставляет `categories[].items[].id` с `scripts/data/grab-item-map.json`, показывает
точные image hosts и не пишет файлы. Скачивание требует `--write`, новый staging-путь вне repo и
отдельный `--allow-host` для каждого обнаруженного host. Пароли, OTP, cookies и Authorization в
коннектор не передаются; HAR с такими полями отклоняется.

Восстановленные изображения остаются в private staging с SHA-256, MIME, размерами и ItemID.
Поскольку текущие изображения были сгенерированы в ChatGPT, они маркируются `ai-generated` и не
выдаются за реальные фотографии поданных блюд. Публикация — отдельный gate: хозяйка визуально
подтверждает соответствие каждого ItemID и явно разрешает website/crops. До этого ни исходник,
ни crop, ни `permission: granted` не попадают в dish JSON, `public/` или Git.

## Как обновить сайт по свежему CSV

1. Dry-run прямо на owner export (сырой файл не коммитить):

   ```bash
   pnpm import:menu -- --input /path/to/grab-bulk-update.csv
   ```

2. Скрипт валидирует весь файл до записи и сопоставляет строки **только** через
   `scripts/data/grab-item-map.json`. Для известных ItemID он меняет только `price_thb`, category
   и permanent availability, сохраняя RU/EN/TH names, slugs, descriptions, media, featured и
   verified food facts. `UNAVAILABLE_TODAY` — no-op; отсутствующий в export mapped ItemID только
   попадает в отчёт и никогда не удаляется автоматически.
3. Новый/unmapped ItemID останавливает импорт без записи. Сначала вручную создать dish JSON,
   проверить EN/TH/RU names/slugs/category и добавить exact ItemID→file mapping; затем повторить
   dry-run. Display name никогда не используется как identity.
4. После review плана применить его:

   ```bash
   pnpm import:menu -- --input /path/to/grab-bulk-update.csv --write
   pnpm validate:content && pnpm build
   ```

## Текущее состояние каталога (2026-08-14)

- В Grab два одинаковых «Спагетти с грибным соусом» ฿199 (`THITE…09904`, `THITE…95416`) —
  вопрос хозяйке в BACKLOG B8; на сайте пока оба.
- В свежем owner export 144 доступные позиции. Три current-active позиции, которых не было на
  предыдущем сайте, добавлены по точным ItemID: Vegan spring rolls, Mushroom naem и Vegan Luuk
  Chuey.
- Для этих трёх ItemID GrabMerchant отдал detail WebP 1000×1000. Recovery и crops сохранены в
  private staging как `ai-generated`; сайт пока оставляет `images: []` до визуального owner-check
  и отдельного разрешения на публикацию.
- Политика соответствия цен сайта, Grab и кафе ещё не подтверждена владельцем (см. B8 и
  `operations.pricePolicy`).
