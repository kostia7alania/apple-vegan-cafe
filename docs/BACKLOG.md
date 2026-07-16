# Backlog

Протокол: команда **«работай»** = взять верхнюю задачу из READY и довести до
Definition of Done (CI зелёный, задеплоено, отмечено здесь). Задачи из BLOCKED
не трогать — они ждут внешнего действия. Порядок в READY = приоритет.

## READY (могу делать автономно)

| # | Задача | DoD | Размер |
|---|---|---|---|
| R1 | **TH лендинг `/th/ร้านอาหารเจ-พัทยา/`** — เจ/Jay страница. ⏰ дедлайн сентябрь (фестиваль ~11–20 окт 2026). Уникальный контент: что такое เจ, почему у нас 100% เจ-кухня, меню-секция, часы, маршрут | страница live, hreflang/breadcrumb ок, тайский текст помечен `draft`-статусом до вычитки семьёй | M |
| R2 | **EN лендинг `/vegan-breakfast-pattaya/`** — козырь: открываемся в 7:30 (Tess с 9:00). Завтрак-блюда из коллекции, часы, CTA | live, Lighthouse ≥95, внутр. ссылки с home/menu | M |
| R3 | **EN лендинг `/vegan-delivery-pattaya/`** — Grab CTA + честная заметка «цены в приложении могут быть выше, в кафе — меню зала» (см. проверку договора Grab: parity-клаузы нет) | live, orderingLinks из settings | M |
| R4 | **EN лендинг `/pure-veg-jain-friendly/`** — для индийских гостей: что без лука/чеснока, jay-теги блюд | live; честность: только то, что кухня реально может | M |
| R5 | Статьи блога: «Vegan vs เจ (Jay) explained» (EN+TH), «How to order vegan food in Thailand» (EN+RU), «Веган-гид по Паттайе» (RU) | опубликованы как draft:false после моей вычитки EN/RU; TH — draft до семьи | M |
| R6 | Страница `/faq/` из faqs-коллекции (EN,RU; контент без FAQPage-разметки) | live, faqs расширены до 6–8 вопросов | S |
| R7 | Favicon + webmanifest + og:image (базовые, из логотипа/фото фасада) | нет 404 на favicon, OG-превью в мессенджерах | S |
| R8 | **Визуальный дизайн** — сейчас скелет. Сделаю 2–3 варианта направления (typography/палитра/mobile-first) на утверждение, потом раскатка | ⚠️ нужно твоё «ок» по направлению перед раскаткой | L |
| R9 | HANDOVER-th.md — полная тайская инструкция со скриншотами админки | семья выполняет 3 операции по ней без подсказок | M |
| R10 | www→apex 301 (zone Redirect Rule) + HSTS preload после месяца стабильности | curl -I www → 301 | S |

## BLOCKED (ждут тебя или владельца кафе)

| # | Задача | Ждёт |
|---|---|---|
| B1 | **Реальное меню** вместо 14 образцов: фото бумажного меню / Grab-экспорт → `import:menu` → PR → merge → снять noindex (`SITE_LAUNCHED=true`) → sitemap в GSC | фото/файл от хозяйки (запрошено в FB-чате) |
| B2 | Общий GitHub-аккаунт семьи («Continue with Google») → коллаборатор в репо | создание аккаунта |
| B3 | Автодеплой: секрет `CLOUDFLARE_API_TOKEN` в репо (deploy.yml готов) ИЛИ переустановка GitHub App | твой токен (сам, мне не показывать) |
| B4 | Google Business Profile: доступ/verification, категория Vegan restaurant, меню-ссылка на сайт, review-QR; точный geo-пин + Maps URL → в locations.json | доступ владельца |
| B5 | Оригинальные фото блюд (или пересъёмка) → в карточки блюд | фото от семьи |
| B6 | HappyCow claim (тикет) + создать TripAdvisor-листинг | владелец |
| B7 | UptimeRobot keyword-монитор + Search Console (домен подтвердить) + Bing Places + Apple Business Connect | твои аккаунты |
| B8 | Спросить хозяйку: подписывала ли спец-условия с Grab (сверх стандартного договора) и кто снимал фото для Grab | владелец |

## LATER (по плану, не сейчас)

- Языки phase 2 (zh-Hans, ko, de) — только с носителем-редактором
- Catering-страница — когда услуга реальна
- Онлайн-заказ на сайте (корзина → LINE/телефон; Workers Paid $5/мес при SSR)
- Приватный модуль: рецептуры/граммовки/себестоимость/чек-листы (отдельное приложение Workers+D1+Access, отдельный private-репо)
- Pagefind-поиск по меню (если блюд станет >40)
- Мультифилиальность (locations[] уже готова)

## DONE

- 2026-07-15: research (8 агентов) + архитектурное решение, scaffold: Astro 7 SSG, EN/TH/RU, Zod-коллекции, CI (lint/typecheck/vitest/playwright/lighthouse/links), security headers, Sveltia CMS, Renovate
- 2026-07-16: домен apple-vegan-cafe.com (Cloudflare Registrar) + деплой на Workers Static Assets, репо public, auth-Worker на auth.apple-vegan-cafe.com (юзер поставил OAuth-секреты, логин работает), placeholder-меню 14 блюд ×3 языка, noindex-гейт, legal menu-import workflow (diff→PR), fix: двойной CSP на /admin, шрифты Sveltia, deploy.yml
