# Аналитика Apple Vegan Cafe: от отчёта Grab к решениям

## Достаточно ли графиков Grab

GrabMerchant Portal уже хорошо закрывает решения **внутри Grab**:

- Overview: gross/net sales, число заказов, AOV;
- Operations: peak hours, wait time, lost/cancelled orders, ratings;
- Menu: популярность, sales breakdown, bought together;
- Marketing: spend, attributed revenue, ROI promos/ads;
- Customers: new/repeat/reactivated, frequency и retention.

Это лучший оперативный экран на последние недели. Но его недостаточно как истории
бизнеса: одна выгрузка Insights ограничена 90 днями, там нет полной себестоимости,
офлайн-кассы, сайта, Google Search/Maps, погоды, журнала изменений и честного прогноза.
Наш слой не должен копировать Portal; он должен соединить источники и ответить:
**какое действие изменило прибыль и что, вероятно, произойдёт дальше**.

## Единый дневной слой

Ключ — `date` в `Asia/Bangkok`. Одна строка дня объединяет:

| Блок                    | Поля                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| Grab                    | net sales, transactions, AOV, commission/net earning, offline minutes, cancellations       |
| Invoice                 | daily Grab service fee before VAT, VAT, grand total                                        |
| Меню                    | units/revenue по ItemID, availability, price, photo/category change                        |
| Сайт/GA4                | sessions, menu views, order/call/directions clicks, locale, campaign                       |
| Search Console          | clicks, impressions, CTR, position по query/page/country/device                            |
| Google Business Profile | Search/Maps impressions, calls, directions, website/menu clicks, monthly query impressions |
| Demand                  | Google Trends, погода, праздники/события Pattaya, открытые минуты                          |
| Reputation              | rating, число отзывов и частота тем                                                        |
| Управление              | action IDs, стоимость, гипотеза, затронутые товары/часы                                    |

Контракт уже создан в приватном бэкапе:
`normalized/daily-business-join-template.csv`. Журнал решений:
`normalized/business-action-log-template.csv`.

## «Куда идёт клюшка»

Вместо одного графика нужны четыре уровня:

1. **Опережающий спрос:** Google Trends, GSC impressions, GBP impressions.
2. **Намерение:** GSC clicks, сайт menu views, order/directions/call clicks.
3. **Результат:** Grab transactions, net sales, AOV, new/repeat customers.
4. **Экономика:** net earning после комиссии/promo и contribution margin после
   себестоимости.

Показы могут расти за 1–4 недели до заказов; поэтому dashboard должен позволять сдвиг
серий по времени. Корреляция с лагом помогает найти гипотезу, но не доказывает причину.

Фактические sales/orders/AOV, прогноз и WAPE записываются только внутри
ignored/private снимка. Этот tracked playbook описывает метод и не дублирует
текущую коммерческую картину. Даже при низком WAPE прогноз — это диапазон для
закупок и смен, а не обещание выручки.

## ROI-анализ действий

Для каждого действия заранее фиксировать стоимость, дату, гипотезу, primary metric и
окно оценки. Без этого после любого скачка можно придумать удобное объяснение.

### Приоритет 1: не терять существующий спрос

- offline minutes и часы недоступности;
- отмены, missing/wrong items;
- availability топовых ItemID;
- кухня/курьеры в peak hours.

Метрика: сохранённые заказы и contribution margin. Это обычно дешевле нового трафика.

### Приоритет 2: меню

- фото/позиция/название/перевод;
- цена и размер порции;
- combo из bought-together;
- удаление настоящих дублей после подтверждения.

Смотреть units, revenue, AOV, attach rate и маржу; одна выручка может вырасти из-за
скидки и ухудшить прибыль.

### Приоритет 3: часы

Сопоставить peak-hours heatmap, open minutes, offline minutes, заказы и стоимость смены.
Гипотезу расширения/сокращения часов проверять на одинаковых днях недели минимум четыре
недели. Погоду и праздники отмечать отдельно.

### Приоритет 4: Grab Ads/Promo

Grab показывает attributed ROI, но для incremental ROI нужен baseline/holdout:

```text
Incremental contribution =
  (orders during action - expected baseline orders)
  × contribution per order
  - promo/ads cost
```

По возможности менять одну вещь, держать похожие дни/товары без промо как контроль и не
приписывать кампании все заказы, которые произошли во время кампании.

### Приоритет 5: Google и сайт

Сайт уже умеет отправлять GA4 events `order_click`, `phone_click`,
`directions_click`, `review_click` и provider. Но клик в Grab не сообщает, был ли заказ;
это верх воронки, пока Grab не отдаёт referral/order join.

Search Console API даёт clicks/impressions/CTR/position по query/page/date. Google
Business Profile Performance API даёт Search/Maps impressions, calls, directions,
website/menu clicks и monthly search keywords. Эти два источника полезнее общего Trends
для локального спроса на конкретный ресторан.

## Гипотеза `jay`

Не смотреть одно слово. Собирать корзину intent-запросов, например:

- `อาหารเจ พัทยา`, `ร้านอาหารเจ พัทยา`, `เจ พัทยา`;
- `vegan pattaya`, `vegan restaurant pattaya`, `jay food pattaya`;
- брендовые варианты Apple Vegan Cafe на EN/TH/RU.

Еженедельно сохранять:

1. GSC impressions/clicks/position для запросов с `เจ`, `jay`, `vegan`, `pattaya`;
2. GBP query impressions и действия профиля;
3. GA4 landing/menu/order/directions clicks по locale;
4. Grab orders/net sales/new customers;
5. дату изменения Thai Jay landing, GBP поста, часов или promo.

Если после изменения растут показы → клики → intent-actions → Grab orders с разумным
лагом, это сильная гипотеза. Причинный вывод появляется после повторяемого действия или
контроля, а не после одной красивой корреляции.

Google Trends API пока alpha с ограниченным доступом. До получения доступа можно делать
ручной ежемесячный снимок интерфейса Trends по Thailand/Chon Buri; не строить production
скрейпер неофициального endpoint.

## Полезные визуализации

1. Actual weekly sales + 8-week low/base/high + вертикальные отметки действий.
2. Воронка demand → intent → orders → contribution с лагом 0–4 недели.
3. Heatmap день недели × час: orders, offline, cancellation, kitchen capacity.
4. Матрица ItemID: volume × growth, цвет = margin, размер = revenue.
5. New/repeat/reactivated cohorts и 4/8/12-week retention.
6. Review-theme trend: вкус, порция, упаковка, ошибка блюда, скорость.
7. ROI ledger: стоимость действия, incremental orders, margin, payback и confidence.

## Где применять LLM

Подходит:

- кластеризация/перевод отзывов и поиск новых тем;
- сопоставление переименованных menu display names с ItemID-кандидатами для ручного
  подтверждения;
- объяснение аномалий на основе уже рассчитанных метрик и action-log;
- еженедельная записка «что изменилось / почему это может быть / что проверить»;
- генерация гипотез и SQL/графиков поверх приватного агрегированного слоя.

Не подходит как единственный числовой прогноз или доказательство ROI. Forecast делает
обычная модель временного ряда с backtest и интервалом; LLM объясняет результат и
предлагает проверяемое действие. Нельзя отправлять во внешнюю модель customer names,
order IDs, банковские данные или полные сырые отзывы без отдельного решения по privacy.

## Официальные источники

- [GrabMerchant Insights: категории, метрики и экспорт](https://merchant.grab.com/en-ph/blog/stay-on-top-of-your-business-maximize-business-data-from-grabmerchant-portal)
- [Grab: 90-дневные raw reports и обновление каждые 24 часа](https://merchant.grab.com/en-ph/guides/default/stop-guessing-and-start-mining-insights-to-grow-your-business)
- [Search Console Search Analytics API](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
- [Search Console: ежедневная выгрузка и ограничения](https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data)
- [Google Business Profile Performance API](https://developers.google.com/my-business/reference/performance/rpc/google.mybusiness.performance.v1)
- [GA4 BigQuery Export](https://support.google.com/analytics/answer/9823238)
- [Google Trends API alpha](https://developers.google.com/search/apis/trends)
