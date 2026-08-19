# Периодический ре-синк меню из Grab

Источник истины для каталога сайта — owner-maintained GrabMerchant: ItemID, название,
категория, цена Grab, permanent availability, изображения и структурированные атрибуты Grab.
Сайт не угадывает эти поля и не сопоставляет блюда по названию.

## 1. CSV: состав каталога, цены и статусы

GrabMerchant → Menu → **Bulk Update** → Download. Получается zip с CSV
(`*ItemID,*ItemName,*Price,*CategoryName,…`). Сырой owner export не коммитится.

```bash
pnpm import:menu -- --input /path/to/grab-bulk-update.csv
pnpm import:menu -- --input /path/to/grab-bulk-update.csv --write
```

Импортёр сначала валидирует весь файл и только потом пишет. Identity — исключительно
`scripts/data/grab-item-map.json`. Для известных ItemID он обновляет цену, category и permanent
availability; `UNAVAILABLE_TODAY` остаётся временным статусом канала и не удаляет блюдо с сайта.
Новый ItemID останавливает импорт до создания dish JSON и точного ItemID→file mapping.

## 2. API JSON: изображения и Grab-бейджи

CSV не содержит фотографий. Owner-authenticated GrabMerchant menu response содержит для каждой
позиции `imageURL` (обычно 300px), `webPURL` detail (до 1000px) и enabled attributes.

Dry-run по сохранённому приватному payload и recovery manifests:

```bash
node --import tsx scripts/sync-grab-menu-media.ts \
  --input /private/tmp/grab-full-menu.json \
  --captured-at YYYY-MM-DD \
  --manifest /private/path/card-images/manifest.json \
  --manifest /private/path/detail-images/manifest.json
```

Если manifest с измеренными размерами отсутствует, скрипт может безопасно измерить публичные
`food-cms.grab.com` assets без сохранения байтов:

```bash
node --import tsx scripts/sync-grab-menu-media.ts \
  --input /private/tmp/grab-full-menu.json \
  --captured-at YYYY-MM-DD \
  --fetch-metadata
```

После проверки списка `CHANGED` примените тот же snapshot явно:

```bash
node --import tsx scripts/sync-grab-menu-media.ts \
  --input /private/tmp/grab-full-menu.json \
  --captured-at YYYY-MM-DD \
  --fetch-metadata \
  --write
```

Скрипт:

- принимает только HTTPS URL exact host `food-cms.grab.com`, без credentials/query/port;
- связывает фото только по ItemID и отклоняет missing/unmapped/duplicate identity;
- измеряет реальный MIME/dimensions, не апскейлит и не кладёт image bytes в Git;
- сохраняет все полезные responsive candidates в `srcset`: карточку и detail;
- dry-run печатает только реальные изменения как
  `CHANGED <ItemID> → <dish-file>: media | dietary old→new`; одинаковый snapshot с новой датой
  даёт `0 changed` и не создаёт diff;
- строит и валидирует полный план до записи, затем переписывает только изменившиеся dishes;
  новый `capturedAt` применяется только при изменении самих Grab media, а dietary-only update
  сохраняет media и прежний `capturedAt` byte-for-byte;
- при замене Grab snapshot сохраняет отдельные local/licensed images после него;
- переносит enabled `Dietary preferences` из Grab как provider metadata для аудита и обратной
  синхронизации. Публичная диетическая классификация берётся из подтверждённого контракта кафе,
  поэтому ошибка поставщика не может понизить vegan/jay блюдо до `Vegetarian`;
- сохраняет другие слова, уже встроенные в макет картинки, без превращения их в отдельные
  сайт-бейджи.

После применения:

```bash
pnpm validate:content
pnpm check
pnpm build
```

## 3. Текущее состояние (snapshot 2026-08-14)

- 144 Grab ItemID ↔ 144 dish JSON; у каждой позиции есть один Grab catalogue image.
- 134 detail WebP имеют 1000×1000; остальные сохраняют реальные меньшие размеры, минимум 185×185.
- 143 позиции имеют Grab attribute `Vegan`; Crispy breaded vegan chicken
  (`THITE2026052809382226355`) в Grab размечен как `Vegetarian`. Значение хранится для диагностики,
  но публичная карточка показывает подтверждённый кафе `jay`, а JSON-LD — `VeganDiet`. Ошибку всё
  равно следует исправить в GrabMerchant, чтобы она не путала гостей внутри Grab.
- Все 144 позиции в snapshot имеют одинаковую item price для Grab service types `Delivery`,
  `DineIn` и `SelfPickUp`. Поэтому сайт теперь подтверждает только совпадение своих item prices с
  GrabFood; фактическая цена у стойки вне Grab всё ещё может отличаться.
- В payload нет отдельных полей `Just try`, `Popular`, `Bestseller` или `Signature`. Розовый/жёлтый
  персонаж и подписи `100% vegan`, `plant based`, `no MSG`, `good for health` являются частью
  самих catalogue images и публикуются один в один вместе с ними.
- В Grab остаются два одинаковых Spaghetti with mushroom sauce по ฿199
  (`THITE2026052809421809904` и `THITE2026052906235195416`); сайт сохраняет оба, пока один ItemID
  не будет отключён/удалён в самом Grab.

## 4. Где лежат картинки

Сейчас публичные dish JSON содержат прямые responsive URL официального Grab CDN. Поэтому репозиторий
не растёт на десятки мегабайт, а браузер выбирает 300px или detail-кандидат по реальному размеру
карточки и DPR.

Cloudflare R2 остаётся запасным зеркалом, если Grab CDN URLs начнут дрейфовать: bucket на custom
domain даст Cloudflare Cache и не потребует хранить bytes в Git. Для включения нужен отдельный
авторизованный Cloudflare session/token; текущий локальный Wrangler не авторизован. До этого
owner-maintained Grab CDN лучше соответствует принятому source-of-truth контракту.
