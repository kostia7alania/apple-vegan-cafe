# Регулярный бэкап GrabMerchant

Этот runbook сохраняет исходные данные Grab отдельно от производственного сайта. Он не
хранит пароль, cookie, HTTP-заголовки авторизации или временные подписанные URL.

## Где хранится фактический статус

Количество файлов, даты покрытия, продажи, выплаты, незавершённые отчёты и результаты
recovery записываются только в отчёты соответствующего ignored/private снимка. В этот
tracked runbook не копируются ни текущие коммерческие показатели, ни имена финансовых
файлов, ни идентификаторы магазина. Поэтому он остаётся процедурой, а не устаревающим
публичным слепком бизнеса.

## Частота

| Когда                                | Что сохранять                                                                         | Зачем                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Каждую неделю                        | Menu/Inventory, статусы, цены, фото, отзывы                                           | Быстро восстановить каталог после ошибочного редактирования                      |
| В первый рабочий день месяца         | Последние 90 дней всех Insights, Finance transactions, payouts, новые GMFR и invoices | Не потерять короткое окно экспорта и получить перекрывающиеся периоды для сверки |
| Сразу после изменения меню/цен/часов | Menu/Inventory и action-log                                                           | Привязать изменение к результату и иметь точку отката                            |
| Раз в квартал                        | Полный manifest, копия вне ноутбука и пробное восстановление одного товара/отчёта     | Проверить, что бэкап действительно читается                                      |

Grab официально ограничивает одну выгрузку Insights диапазоном до 90 дней. Поэтому
ежемесячный перекрывающийся снимок надёжнее попытки восстановить историю задним числом.

## Процедура

### 1. Создать приватный каталог снимка

Использовать дату в Bangkok:

```text
grab-backup.local/YYYY-MM-DD/
  raw/          # ответы и скачанные файлы; CDN access signatures редактируются после сохранения байтов
  normalized/   # CSV/JSON без cookie и временных URL
  media/        # байты фотографий и их метаданные
  reports/      # coverage, аналитика, аудит меню
  tools/        # локальная сборка manifest/нормализации
  manifest.json
  README.md
```

Новый снимок не должен перезаписывать предыдущий. Raw-файлы после скачивания считаются
неизменяемыми; исправления делаются новым снимком или новым derived-файлом. Единственное
исключение — удаление действующих CDN signed query **после** скачивания соответствующих
байтов; media manifest обязан сохранить SHA-256 исходного URL и pre/post hash raw-файла.
Repo-команды записи принимают только существующий внешний каталог либо путь, уже
исключённый через `.gitignore`; symlinked `normalized/`/`reports/` и website/build paths
отклоняются до записи.

### 2. Снять меню и фотографии

1. Войти в `merchant.grab.com` аккаунтом Owner/Manager в обычном браузере.
2. Сохранить текущий bulk export меню.
3. Сохранить официальный Inventory/Menu payload с ItemID, categoryID, ценой,
   availability, selling time, modifier groups и image URL.
4. Фотографии сопоставлять только по стабильному Grab ItemID. Не матчить по похожему
   названию.
5. Скачать байты фотографий в приватный staging и записать SHA-256, MIME и размеры.
   Для сайта изображения проходят отдельное подтверждение владельца; наличие в Grab не
   означает автоматическую публикацию на сайте.

Если используется repo-коннектор, discovery/download запускается через
`pnpm grab:photos`; полный контракт описан в установленном skill
`grab-photo-recovery`.

### 3. Снять Insights

Для Overview, Operations, Menu, Marketing и Customers выгрузить последний 90-дневный
диапазон. Для каждого ответа записать:

- store/merchant identity;
- timezone `Asia/Bangkok`;
- start/end inclusive;
- время захвата;
- параметры метрики и пагинации;
- исходный JSON/Excel/PDF и SHA-256.

Перекрывающиеся периоды дедуплицируются только в `normalized/`; raw ответы сохраняются
как есть. Дневная продажа имеет ключ `date`, товар — ItemID, а старый endpoint item
performance — display name и поэтому требует осторожности при переименовании.

### 4. Снять Finance

1. Finance → Transactions: скачать все доступные кабинету диапазоны и все страницы.
2. Finance → Payouts: скачать все доступные диапазоны и страницы.
3. Finance → Reports: сохранить новые GMFR XLSX и invoice PDF.
4. Сравнить metadata rows с реально скачанными файлами. `READY` без байтов и
   `PROCESS` считаются gap, а не успешным бэкапом.

Часть invoice PDF в Таиланде зашифрована налоговым номером владельца. Экстрактор сначала
ищет один согласованный 13-значный номер в открытых PDF того же приватного снимка и
использует его только в памяти процесса. Если в новом снимке все PDF зашифрованы,
владелец передаёт пароль только текущему процессу через `GRAB_INVOICE_PASSWORD`.
Номер не записывается в Git, нормализованные CSV или обычный console output. По явному
решению владельца значение для расшифровки сохраняется в password manager или другом
secret store отдельно от PDF, снимка и Git. Исходные PDF сохраняются как есть;
расшифрованные копии не создаются.

### 5. Снять Feedback и зафиксировать действия

- сохранить rating overview и все доступные written reviews;
- скачать байты `paxReviewImageUrls`, проверить MIME/размер/hash и только затем удалить
  из raw JSON значения `Signature`, `Key-Pair-Id` и signed query; сохранить origin/path,
  expiry и SHA-256 исходного URL в приватном media manifest;
- тексты, display names и order IDs остаются только в приватном бэкапе;
- каждое изменение цены, фото, часов, promo/ads или availability записать в
  `normalized/business-action-log-template.csv` **до** оценки результата.

### 6. Пересобрать аналитику и manifest

Из корня репозитория:

```bash
pnpm grab:extract-invoices -- grab-backup.local/YYYY-MM-DD
pnpm grab:extract-gmfr -- grab-backup.local/YYYY-MM-DD
pnpm grab:analyze -- grab-backup.local/YYYY-MM-DD
pnpm grab:intelligence -- grab-backup.local/YYYY-MM-DD
node grab-backup.local/YYYY-MM-DD/tools/archive-review-photos.mjs
node grab-backup.local/YYYY-MM-DD/tools/build-backup.mjs
```

Первая команда извлекает дневные service fee/VAT/grand total из всех invoice PDF,
проверяет идентичность, даты, арифметику и checksum налогового номера, но не выводит сам
номер. Вторая извлекает выбранные payment/payout rows из сохранённых GMFR XLSX, не
меняя workbooks. Третья создаёт 8-недельный backtested сценарий, action-log и контракт
для объединения Grab/GA4/GSC/GBP, не перезаписывая заполненные журналы. Четвёртая создаёт
PII-minimized AI context, agent brief и локальный private dashboard. Пятая архивирует
изображения письменных отзывов и редактирует только значения CDN-подписей после
сохранения байтов. Шестая нормализует raw данные, обновляет coverage и пересчитывает
SHA-256 manifest.

Проверить перед завершением:

- manifest содержит каждый файл и все SHA-256 сходятся;
- число ItemID равно числу строк текущего меню, нет duplicate ItemID;
- каждая скачанная фотография имеет ItemID, hash, MIME и размер;
- в metadata отчётов нет необъяснённого `READY` без файла;
- max date каждого набора соответствует дате снимка или явно описанному lag;
- в бэкапе нет cookie, Authorization, Set-Cookie, OTP, пароля аккаунта и временного
  query string от signed URL; значение для расшифровки invoice находится только в
  отдельном secret store, а не рядом с PDF, в raw HTTP, CSV или tracked docs.

### 7. Хранение и восстановление

- рабочая копия — на ноутбуке, зашифрованная копия — на другом носителе/облаке;
- минимум две физически разные копии, одна вне ноутбука;
- доступ только владельцу/уполномоченному оператору;
- раз в квартал открыть случайный XLSX, проверить один invoice и восстановить одну
  фотографию по ItemID;
- удаление старых снимков — только после успешной проверки более нового полного снимка.

## Если Grab не отдаёт историю

Безопасные альтернативы в порядке приоритета:

1. тот же диапазон через официальный Portal UI;
2. готовый GMFR/CSV в Finance → Reports;
3. invoice из зарегистрированной почты владельца;
4. запрос в Grab Help Centre с merchant/store ID, точным диапазоном и именем файла;
5. официальный data export/ответ поддержки.

Не подбирать внутренние object-storage URL, не обходить авторизацию и не подменять дату
клиента: это не восстанавливает серверные данные и создаёт риск аккаунту. Конкретные
ошибки Portal/API и список отчётов в `Preparing/PROCESS` фиксируются внутри приватного
coverage-отчёта снимка, а не в этом runbook.

Для зависшего отчёта: повторить проверку через 24 часа, затем отправить в Help Centre
имя файла, дату, screenshot статуса `Preparing` и попросить regenerate. Не создавать
десятки одинаковых задач генерации.

## Официальные источники

- [Grab Thailand: финансовые отчёты, invoices и пароль PDF](https://merchant.grab.com/th-th/guides/step-3-finance/financial-report)
- [Grab: Insights, доступные метрики и 90-дневное окно](https://merchant.grab.com/en-ph/blog/stay-on-top-of-your-business-maximize-business-data-from-grabmerchant-portal)
- [Grab: Portal обновляет Insights каждые 24 часа](https://merchant.grab.com/en-ph/guides/default/stop-guessing-and-start-mining-insights-to-grow-your-business)
- [GrabMerchant Financial Report](https://merchant.grab.com/en-sg/guides/setup101/gmfr)
