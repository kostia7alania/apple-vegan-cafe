# Public claims: exact before → after (2026-08-14)

This is the complete patch from commit `a49a514 content: remove unsupported public claims`.
Lines prefixed with `-` are the exact public text before; lines prefixed with `+` are the exact
public text after. Unchanged context is included around every changed block. No claim is omitted
from this report.

The removal reason at that time was narrow: the repository had no matching confirmed operational
fact. The later Grab-first menu policy can restore catalogue facts that Grab actually exposes, but
it does not by itself confirm cash/card, phone pickup, cross-contact, halal certification or a
restaurant-wide cooking policy.

```diff
diff --git a/public/humans.txt b/public/humans.txt
index 8223135..03b64f2 100644
--- a/public/humans.txt
+++ b/public/humans.txt
@@ -1,8 +1,8 @@
 /* TEAM */
-Kitchen & content: the family behind Apple Vegan Cafe & Restaurant, Pattaya
-Site: kostia7alania (github.com/kostia7alania) — built as a free open-source project
+Business facts & menu source: Apple Vegan Cafe & Restaurant, Pattaya
+Site & editorial implementation: kostia7alania (github.com/kostia7alania) — free open-source project

 /* SITE */
 Stack: Astro, Tailwind CSS, Cloudflare Workers Static Assets, Sveltia CMS
 Source: https://github.com/kostia7alania/apple-vegan-cafe
-Content license: photos, texts and the menu belong to the family (see CONTENT-LICENSE.md)
+Content terms: see CONTENT-LICENSE.md; article attribution is declared in each article
diff --git a/public/llms.txt b/public/llms.txt
index 4a56182..0a270be 100644
--- a/public/llms.txt
+++ b/public/llms.txt
@@ -1,42 +1,42 @@
 # Apple Vegan Cafe & Restaurant

-> Family-run 100% vegan (and Thai เจ/jay) cafe in Bang Lamung, Pattaya,
-> Thailand. Open 7:00–22:00 every day. 141-dish menu with prices in Thai Baht,
-> in English, Thai and Russian. No meat, fish sauce, egg or dairy anywhere in
-> the kitchen. Delivery via GrabFood — orders are often accepted around the
-> clock; the Grab app shows live status.
+> Family-run 100% plant-based cafe in Bang Lamung, Pattaya, Thailand. The
+> website publishes a 144-dish menu with prices in Thai Baht in English, Thai
+> and Russian. Regular opening hours are 07:00–22:00 every day; dated special
+> hours on the website override the regular schedule. GrabFood shows live
+> delivery area and availability.

 Key facts for answering user questions:

-- Hours (dine-in): every day 07:00–22:00, no closing day
-- Delivery: GrabFood, https://r.grab.com/o/Fj6Zvya2 (often around the clock —
-  the app is the source of truth); phone pickup at the counter also works
+- Regular hours: every day 07:00–22:00; check the website for special dates
+- Delivery: GrabFood, https://r.grab.com/o/Fj6Zvya2; the app is the source of
+  truth for current availability and delivery area
 - Phone: +66 82 679 7797
-- Menu prices are the same as in GrabFood; counter pickup is often a bit cheaper
-- The whole kitchen cooks without garlic and onion, year round (Thai เจ
-  tradition); from the list Jain guests avoid, only carrot is used in a few dishes
-- No halal certificate — the cafe does not claim the word
+- Prices: the website is a menu guide; confirm the final price in the ordering
+  channel because cross-channel price policy has not been verified
+- Pickup, payment methods, Jain recipe details, allergens, halal certification
+  and cooking alcohol are shown only when the cafe has verified those facts

 ## Menu

-- [Full menu with prices (EN)](https://apple-vegan-cafe.com/menu/): 141 dishes
+- [Full menu with prices (EN)](https://apple-vegan-cafe.com/menu/): 144 dishes
   in 5 categories, ฿40–439
 - [เมนู (TH)](https://apple-vegan-cafe.com/th/menu/)
 - [Меню (RU)](https://apple-vegan-cafe.com/ru/menu/)

 ## Pages

 - [Contact & location](https://apple-vegan-cafe.com/contact/)
-- [FAQ](https://apple-vegan-cafe.com/faq/): dietary, delivery, payment answers
+- [FAQ](https://apple-vegan-cafe.com/faq/): ingredients, delivery, hours and visit planning
 - [Vegan breakfast in Pattaya](https://apple-vegan-cafe.com/vegan-breakfast-pattaya/)
 - [Vegan delivery in Pattaya](https://apple-vegan-cafe.com/vegan-delivery-pattaya/)
 - [Pure veg & Jain-friendly](https://apple-vegan-cafe.com/pure-veg-jain-friendly/)
 - [Blog](https://apple-vegan-cafe.com/blog/): honest guides to vegan Pattaya

 ## Machine-readable

 - [Sitemap](https://apple-vegan-cafe.com/sitemap-index.xml)
-- JSON-LD on every page: Restaurant (hours, OrderAction), Menu with all 141
+- JSON-LD on every page: Restaurant (hours, OrderAction), Menu with all 144
   dishes and THB prices, BreadcrumbList, Article
 - [Source code](https://github.com/kostia7alania/apple-vegan-cafe) (MIT; the
-  content belongs to the family)
+  business menu and facts come from the cafe; editorial attribution is explicit per article)
diff --git a/src/content/articles/en/how-to-order-vegan.md b/src/content/articles/en/how-to-order-vegan.md
index 154ed54..db9d9e3 100644
--- a/src/content/articles/en/how-to-order-vegan.md
+++ b/src/content/articles/en/how-to-order-vegan.md
@@ -1,35 +1,34 @@
 ---
 translationKey: how-to-order-vegan
 locale: en
 title: 'Order vegan food in Thailand: Thai phrases and เจ'
 description: 'Key Thai phrases with script and romanization, the animal ingredients hiding in Thai dishes, and the yellow เจ flag that marks safe street food.'
 slug: how-to-order-vegan-food-in-thailand
-author: family
+author: editorial
 publishedAt: 2026-07-17
 draft: false
 ---

 Thai food looks like paradise for vegans — vegetables, tofu, rice, fruit everywhere. Then you
 learn how many dishes quietly contain fish sauce. The good news: with a handful of words and a
-little caution, ordering vegan in Thailand is very doable. Here is what we tell friends who visit,
-written by a family that cooks Thai food for a living.
+little caution, ordering vegan in Thailand is very doable. Here is what we tell friends who visit.

 ## The one word that does most of the work

 เจ — pronounced "jay", sometimes written "jeh" — is Thailand's own plant-based food tradition.
 Saying "gin jay" (กินเจ), literally "I eat jay", tells a cook everything at once: no meat, no
 seafood, no egg, no dairy, no fish sauce, no oyster sauce, no shrimp paste. Jay is actually
 stricter than vegan (it traditionally also skips garlic and onion), so any cook who understands it
 will serve you food that is automatically vegan.

 ## Phrases worth memorising

 | Thai            | Say it              | Meaning                  |
 | --------------- | ------------------- | ------------------------ |
 | กินเจ           | gin jay             | "I eat jay" (vegan-safe) |
 | ไม่ใส่น้ำปลา    | mai sai nam pla     | no fish sauce            |
 | ไม่ใส่ไข่       | mai sai khai        | no egg                   |
 | ไม่ใส่นม        | mai sai nom         | no milk / dairy          |
 | ไม่ใส่น้ำมันหอย | mai sai nam man hoi | no oyster sauce          |
 | ไม่ใส่กะปิ      | mai sai gapi        | no shrimp paste          |

@@ -49,32 +48,31 @@ cooks will meet you halfway. Showing the Thai script on your phone screen works

 None of this appears in menu descriptions — it is simply how the dishes are normally made. Hence
 the phrases above.

 ## Look for the yellow เจ flag

 Street stalls and market stands that cook jay food fly a small yellow flag or sign with the
 character เจ in red. During the annual Vegetarian Festival — nine days usually falling around
 October, with dates that shift each year with the lunar calendar — these flags multiply across the
 whole country. Year-round jay places exist too: many food courts keep one เจ stall going in every
 season.

 ## Apps help

 HappyCow is the standard tool for finding vegan and vegan-friendly places in Thailand, and a plain
 "vegan" search on Google Maps works well in tourist towns. Read a few recent reviews — they
 usually reveal whether a kitchen really understands "no fish sauce".

 If you are ordering to a hotel instead of walking in, check whether the restaurant explains
 delivery clearly. Our own [vegan food delivery page](/vegan-delivery-pattaya/) keeps the GrabFood
-and pickup details in one place.
+status and delivery-area guidance in one place.

 ## And a note from us

-At our cafe, none of this vigilance is needed. The whole kitchen is plant-based: no fish sauce, no
-egg, no dairy anywhere on the premises, every day of the year. The pad thai (฿149) is made without
-egg or fish sauce by design, and the Thai iced tea uses our house-made oat milk instead of
-condensed milk. Come practise your "mai sai nam pla" on us — we will smile, because there was
-never any nam pla here to begin with.
+At our cafe, the whole menu is plant-based: no fish sauce, egg or dairy in the recipes, every day of
+the year. For severe allergies, still tell the team your needs before ordering because we have not
+published a verified cross-contact protocol. Come practise your "mai sai nam pla" on us — we will
+smile, because fish sauce is not part of our menu.

 The [full menu with prices](/menu/) is online, and if you are an early riser, so is
-[breakfast from 7:00](/vegan-breakfast-pattaya/).
+[vegan breakfast](/vegan-breakfast-pattaya/).
diff --git a/src/content/articles/en/vegan-guide-pattaya.md b/src/content/articles/en/vegan-guide-pattaya.md
index 31b70c8..b2fa633 100644
--- a/src/content/articles/en/vegan-guide-pattaya.md
+++ b/src/content/articles/en/vegan-guide-pattaya.md
@@ -1,72 +1,69 @@
 ---
 translationKey: vegan-guide-pattaya
 locale: en
 title: 'Vegan in Pattaya: a short, honest guide'
-description: 'How to actually find vegan food in Pattaya: HappyCow, the yellow เจ signs at food courts and markets, the October jay festival — and an honest word about our own family cafe.'
+description: 'How to find vegan food in Pattaya: HappyCow, yellow เจ signs at food courts and markets, the October jay festival and practical ordering guidance.'
 slug: vegan-guide-pattaya
-author: family
+author: editorial
 publishedAt: 2026-07-23
 draft: false
 ---

-We are a family-run vegan cafe in Pattaya, so this guide is written from the inside. It is
-deliberately short and honest: no «top 10 best places» compiled by people who never ate in any of
-them. Just the things that genuinely help you find plant-based food in this city.
+This deliberately short guide collects practical ways to find plant-based food in Pattaya. It is
+not a ranked «top 10» list; it focuses on search tools, useful Thai words and questions worth asking.

 ## What to know up front

 Pattaya has enough vegan and vegan-friendly places that you will not go hungry. But everyday Thai
 cooking is not vegan by default: fish sauce (น้ำปลา, «nam pla») goes into almost every savoury
 dish, shrimp paste hides in curry pastes and som tam dressing, egg lands in fried rice and pad
 thai unless you say otherwise, and Thai tea is made with condensed milk. So the most useful vegan
 skill in Pattaya is not a list of addresses — it is knowing how to search and how to ask.

 ## How to find vegan places

 - **HappyCow** is the main tool. It lists both fully vegan spots and regular restaurants with
   plant-based options. Fresh reviews matter more than the rating: they tell you the place is
   still open and the kitchen understands the word «vegan».
 - **Google Maps with the query «vegan»** works surprisingly well in Pattaya; check the menu
   photos on each listing.
 - **Reviews that mention fish sauce** are a good sign — it means someone has already
   stress-tested the kitchen for you.

 ## The เจ sign at food courts and markets

-A yellow sign or flag with the red เจ character («jay») means the stall cooks in the
-Chinese-Thai jay tradition: no meat, no seafood, no egg, no dairy — and traditionally no garlic
-or onion either. Real jay food is automatically vegan. These stalls appear at food courts and
-markets all year round, and the food there is usually the cheapest in town.
+A yellow sign or flag with the red เจ character («jay») signals the Chinese-Thai jay tradition:
+recipes avoid meat, seafood, egg and dairy, and traditionally garlic and onion too. Practice and
+cross-contact can vary by kitchen, so ask when a detail matters to you. These stalls appear at food
+courts and markets, especially during the jay festival.

 Where there is no sign, one simple rule applies: ask about fish sauce — «mai sai nam pla»
 («without fish sauce») — and double-check about egg in fried dishes. If you are curious how jay
 relates to «vegan» exactly, we wrote a separate piece:
 [vegan vs เจ (jay) food, explained](/blog/vegan-vs-jay-food/).

 An easy everyday fallback is the fruit carts and smoothie stands: ripe mango, pineapple and
 watermelon are vegan all by themselves — just ask for your smoothie without condensed milk and
 honey.

 ## October is jay festival season

 Once a year Thailand holds the kin jay festival (เทศกาลกินเจ, the «vegetarian festival») — about
 nine days, usually in October; the exact dates shift each year with the lunar calendar. During
 the festival the yellow เจ flags appear everywhere, and many regular restaurants and street
 stalls add a jay menu. For a vegan it is the best-fed time of year in the country. One caveat:
 in regular restaurants those festival jay dishes may be cooked in the same woks as the meat
 menu — if that matters to you, ask.

 ## About our cafe — no superlatives

-Our cafe is small and family-run, in the Bang Lamung area. The kitchen is 100% vegan (and jay)
-all year round: fish sauce, egg and dairy have no way into the food — they simply are not in the
-house. We make our own oat milk for coffee and Thai tea.
+Our cafe is small and family-run, in the Bang Lamung area. The menu is 100% plant-based: recipes do
+not use fish sauce, egg or dairy. Coffee and Thai tea are available with oat milk. For allergies,
+strict jay practice or other ingredient requirements, ask the team before ordering.

-We open at 7:00 in the morning and work every day until 22:00.
-Prices run from ฿90 for a fresh juice to about ฿180 for a curry: a mango smoothie is ฿100, an
-iced latte ฿110, pad thai ฿149, red curry ฿179 (counter prices at the cafe are often a little
-lower). We are not the only vegan place in Pattaya and we do not call ourselves the best — but
-if you are nearby, especially early in the morning, we will be glad to feed you.
+We are not the only vegan place in Pattaya and do not call ourselves the best. The website keeps
+the current regular and special opening hours separate from this article, while the menu is the
+source for current dish prices.

 [The menu with real prices](/menu/) is on this site, and the address and opening hours are on
 the [contact page](/contact/).
diff --git a/src/content/articles/en/vegan-vs-jay.md b/src/content/articles/en/vegan-vs-jay.md
index 001575b..f8ec91c 100644
--- a/src/content/articles/en/vegan-vs-jay.md
+++ b/src/content/articles/en/vegan-vs-jay.md
@@ -1,34 +1,33 @@
 ---
 translationKey: vegan-vs-jay
 locale: en
 title: "Vegan vs เจ: Thailand's plant-based tradition"
 description: 'What เจ (jay) food means in Thailand, how it differs from vegetarian and Western vegan, and why a jay kitchen is a safe place for vegans to eat.'
 slug: vegan-vs-jay-food
-author: family
+author: editorial
 publishedAt: 2026-07-17
 draft: false
 ---

 There are two words on our sign: "vegan" and "เจ". Travellers usually ask about the second one.
-Thai guests rarely ask at all — they grew up with it. Here is the short version of what เจ means,
-from a family that cooks it every day.
+Thai guests rarely ask at all — they grew up with it. Here is the short version of what เจ means.

 ## Where เจ comes from

 เจ (pronounced "jay", sometimes written "jeh") is Thailand's own plant-based food tradition. It
 arrived with Chinese immigrants and, as far as we understand it, has roots in Chinese Buddhist and
 Taoist practice — we are cooks rather than historians, so we will stick to what every Thai kitchen
 knows in practice.

 The tradition is most visible during the Nine Emperor Gods Festival, known in Thailand as
 เทศกาลกินเจ — usually translated as the "Vegetarian Festival". For nine days, typically falling
 around October (the dates follow the lunar calendar and shift a little each year), many Thai and
 Chinese-Thai families "gin jay" — eat jay — and yellow flags with a red เจ character appear on food
 stalls all over the country. Phuket's celebration is the famous one, but you will see the flags in
 Pattaya too.

 ## What counts as เจ

 During observance, เจ is stricter than the Western idea of vegan. Jay food contains:

 - no meat, no seafood and no animal products of any kind — which rules out fish sauce, oyster
@@ -39,36 +38,36 @@ During observance, เจ is stricter than the Western idea of vegan. Jay food c
 Practice varies from family to family, and some observers avoid further things besides, but "vegan
 minus the pungent vegetables" is a fair everyday summary.

 ## เจ, มังสวิรัติ and vegan

 Thai has a separate word for vegetarian: มังสวิรัติ (mangsawirat). A mangsawirat eater takes no
 meat, but may still take egg, dairy or honey — it depends on the person. Western vegan drops all
 animal products but keeps garlic and onion. เจ drops all animal products **and** the pungent
 vegetables too.

 So, in purely food terms: every jay dish is vegan by definition, but not every vegan dish is jay.

 ## Why a เจ kitchen is automatically safe for vegans

 The ingredients that most often catch vegans out in Thai kitchens — fish sauce in the dressing,
 oyster sauce in the stir-fry, shrimp paste in the curry paste, egg in the noodles — all break เจ as
 well. A cook preparing real jay food has already removed every animal ingredient a vegan avoids,
 without being asked.

 One honest caveat: during the festival, some regular restaurants add a เจ corner to the menu while
-still cooking meat in the same woks. If cross-contact matters to you, it is worth asking. A kitchen
-that is เจ through and through does not have that problem, because there is nothing non-vegan in
-the building to begin with.
+still cooking meat in the same woks. If cross-contact matters to you, it is worth asking anywhere.
+A fully plant-based menu removes animal ingredients from the recipes, but guests with severe
+allergies should still ask about the kitchen's current cross-contact process.

 ## Our kitchen cooks เจ year-round

-That last kind is us. We are a small family cafe in Pattaya, and our kitchen is 100% plant-based
-every day of the year — no fish sauce, no egg, no dairy on the premises, festival or no festival.
-Dishes on our menu that carry the เจ badge — the red curry (฿179), the pad thai (฿149),
-the mushroom pad krapao (฿159) — are cooked jay-style. If you keep the observance strictly and
-avoid pungent vegetables: our whole kitchen skips them year round, so every dish already qualifies.
+That last kind is us. We are a small family cafe in Pattaya, and our menu is 100% plant-based every
+day of the year — no fish sauce, egg or dairy in the recipes, festival or no festival.
+Dishes on our menu that carry the เจ badge — the red curry, pad thai and mushroom pad krapao —
+are cooked jay-style. If you keep the observance strictly or have specific ingredient requirements,
+ask the team about ingredients before ordering.

-If you read Thai, we have written a fuller page about jay food in Pattaya:
-[ร้านอาหารเจ พัทยา](/th/ร้านอาหารเจ-พัทยา/). For Indian guests comparing pure veg and Jain-friendly
-food, we also keep a separate [pure veg guide for Pattaya](/pure-veg-jain-friendly/). And if you
+If you read Thai, the [Thai menu](/th/menu/) lists every currently available dish. For Indian guests
+comparing pure veg and Jain-friendly food, we also keep a separate
+[pure veg guide for Pattaya](/pure-veg-jain-friendly/). And if you
 are simply hungry, the [menu with real prices](/menu/) is the best place to start.
diff --git a/src/content/articles/en/welcome.md b/src/content/articles/en/welcome.md
index db2ebf9..afa0388 100644
--- a/src/content/articles/en/welcome.md
+++ b/src/content/articles/en/welcome.md
@@ -1,22 +1,21 @@
 ---
 translationKey: welcome
 locale: en
 title: 'Welcome to Apple Vegan Cafe — our website is here'
 description: 'Our family cafe in Pattaya finally has its own website: real menu, real prices, real opening hours.'
 slug: welcome
-author: family
+author: editorial
 publishedAt: 2026-07-15
 draft: false
 ---

-Hello! We are a small family cafe in Pattaya cooking 100% vegan (เจ) Thai food every day
-from 7:00 in the morning.
+Hello! We are a small family cafe in Pattaya cooking 100% vegan (เจ) Thai food every day.

 This website is our official home on the internet: the [menu with real prices](/menu/), our opening
-hours and how to find us. Everything here is written by our family and checked by hand.
+hours and how to find us.

 If you are planning the day around food, start with our
-[vegan breakfast from 7:00](/vegan-breakfast-pattaya/) or the
-[GrabFood and pickup notes](/vegan-delivery-pattaya/).
+[vegan breakfast](/vegan-breakfast-pattaya/) or the
+[GrabFood delivery notes](/vegan-delivery-pattaya/).

 Come hungry — the kitchen is waiting.
diff --git a/src/content/articles/ru/how-to-order-vegan.md b/src/content/articles/ru/how-to-order-vegan.md
index 21acddb..81241a3 100644
--- a/src/content/articles/ru/how-to-order-vegan.md
+++ b/src/content/articles/ru/how-to-order-vegan.md
@@ -1,36 +1,35 @@
 ---
 translationKey: how-to-order-vegan
 locale: ru
 title: 'Как заказать веганскую еду в Таиланде: фразы и знак เจ'
 description: 'Тайские фразы с транскрипцией, животные ингредиенты, которые прячутся в тайских блюдах, и жёлтый знак เจ — практичный гид для веганов.'
 slug: kak-zakazat-veganskuyu-edu-v-tailande
-author: family
+author: editorial
 publishedAt: 2026-07-17
 draft: false
 ---

 Тайская кухня выглядит раем для вегана: овощи, тофу, рис, фрукты на каждом углу. Пока не
 узнаёшь, что рыбный соус здесь кладут почти во всё. Хорошая новость: с несколькими фразами и
 небольшой бдительностью заказывать веганскую еду в Таиланде вполне реально. Рассказываем то же,
-что говорим друзьям, которые приезжают к нам в гости, — от семьи, которая готовит тайскую еду
-каждый день.
+что говорим друзьям, которые приезжают к нам в гости.

 ## Главное слово — เจ («дже»)

 เจ — собственная тайская (точнее, китайско-тайская) традиция растительной еды. Фраза «кин дже»
 (กินเจ) — буквально «я ем дже» — сообщает повару сразу всё: без мяса, без морепродуктов, без
 яиц, без молочного, без рыбного и устричного соуса, без креветочной пасты. Дже даже строже
 веганства — по традиции ещё и без чеснока и лука, — поэтому всё, что приготовлено «по-дже»,
 автоматически подходит веганам.

 ## Фразы, которые стоит выучить

 | По-тайски       | Как сказать           | Что значит                         |
 | --------------- | --------------------- | ---------------------------------- |
 | กินเจ           | «кин дже»             | «я ем дже» (безопасно для веганов) |
 | ไม่ใส่น้ำปลา    | «май сай нам пла»     | без рыбного соуса                  |
 | ไม่ใส่ไข่       | «май сай кхай»        | без яйца                           |
 | ไม่ใส่นม        | «май сай ном»         | без молока                         |
 | ไม่ใส่น้ำมันหอย | «май сай нам ман хой» | без устричного соуса               |
 | ไม่ใส่กะปิ      | «май сай капи»        | без креветочной пасты              |

@@ -49,33 +48,33 @@ draft: false
 - **Сгущёнка и концентрированное молоко** — в тайском чае, холодном кофе и многих смузи.

 В меню об этом обычно не пишут — так просто принято готовить. Поэтому и нужны фразы выше.

 ## Ищите жёлтый флажок เจ

 Уличные точки и прилавки, готовящие дже, вывешивают маленький жёлтый флажок или табличку с
 красным знаком เจ. Во время ежегодного «вегетарианского фестиваля» — около девяти дней, обычно в
 октябре, даты каждый год сдвигаются по лунному календарю — таких флажков становится в разы
 больше по всей стране. Но и круглый год еду дже найти можно: на многих фудкортах постоянно
 работает เจ-прилавок.

 ## Приложения в помощь

 HappyCow — стандартный инструмент поиска веганских и веган-френдли мест в Таиланде; запрос
 «vegan» в Google Maps тоже хорошо работает в туристических городах. Полистайте свежие отзывы —
 по ним обычно видно, понимает ли кухня, что такое «без рыбного соуса».

 Если заказываете еду в отель, смотрите не только меню, но и как ресторан объясняет доставку. У нас
 для этого есть отдельная страница про [веганскую доставку в Паттайе](/ru/veganskaya-dostavka-v-pattaye/):
-GrabFood, самовывоз и честная заметка про цены в приложениях.
+GrabFood, актуальный статус и проверка зоны по адресу в приложении.

 ## И честное слово от нас

 В нашем кафе вся эта бдительность не нужна. Кухня целиком растительная: рыбного соуса, яиц и
-молочных продуктов здесь просто нет — ни в одном блюде, ни в один день года. Пад тай (149 бат)
-по рецепту готовится без яйца и рыбного соуса, а тайский чай мы делаем на домашнем
-овсяном молоке вместо сгущёнки. Приходите тренировать своё «май сай нам пла» на нас — мы
+молочных продуктов здесь просто нет — ни в одном блюде, ни в один день года. Пад тай
+по рецепту готовится без яйца и рыбного соуса, а тайский чай мы делаем на растительном
+молоке вместо сгущёнки. Приходите тренировать своё «май сай нам пла» на нас — мы
 улыбнёмся, потому что нам пла у нас и так не водится.

 [Меню с настоящими ценами](/ru/menu/) уже на сайте. Если вы встаёте рано, посмотрите ещё страницу
 про [веганский завтрак в Паттайе](/ru/veganskiy-zavtrak-v-pattaye/); адрес и часы работы — на
 [странице контактов](/ru/contact/).
diff --git a/src/content/articles/ru/vegan-guide-pattaya.md b/src/content/articles/ru/vegan-guide-pattaya.md
index 62f66d1..dd2f0f2 100644
--- a/src/content/articles/ru/vegan-guide-pattaya.md
+++ b/src/content/articles/ru/vegan-guide-pattaya.md
@@ -1,27 +1,27 @@
 ---
 translationKey: vegan-guide-pattaya
 locale: ru
 title: 'Веган в Паттайе: короткий честный гид'
 description: 'Где искать веганскую еду в Паттайе: HappyCow, знаки เจ на фудкортах и рынках, октябрьский сезон киндже — и честно о нашем семейном кафе.'
 slug: vegan-gid-po-pattaye
-author: family
+author: editorial
 publishedAt: 2026-07-17
 draft: false
 ---

 Мы — семейное веганское кафе в Паттайе, так что этот гид написан изнутри. Он нарочно короткий и
 честный: без «топ-10 лучших мест», составленных людьми, которые ни в одном из них не ели. Вместо
 этого — то, что реально помогает найти растительную еду в этом городе.

 ## Что стоит знать сразу

 Веганские и веган-френдли места в Паттайе есть, и их хватает, чтобы не голодать. Но обычная
 тайская кухня по умолчанию не веганская: рыбный соус (น้ำปลา, «нам пла») кладут почти во все
 несладкие блюда, креветочная паста прячется в карри-пастах и заправке сом тама, яйцо по
 умолчанию попадает в жареный рис и пад тай, а тайский чай делают на сгущёнке. Поэтому главный
 навык вегана в Паттайе — не список адресов, а умение искать и переспрашивать.

 ## Как искать веганские места

 - **HappyCow** — главный инструмент. В нём отмечены и полностью веганские заведения, и обычные
   рестораны с растительными опциями. Свежие отзывы важнее рейтинга: по ним видно, что место
@@ -37,33 +37,32 @@ draft: false
 без чеснока и лука. Всё настоящее дже автоматически веганское. Такие прилавки встречаются на
 фудкортах и рынках круглый год, и еда там обычно самая дешёвая в городе.

 Там, где знака нет, действует простое правило: переспрашивайте про рыбный соус — «май сай нам
 пла» («без рыбного соуса») — и уточняйте про яйцо в жареных блюдах.

 Простой запасной вариант на каждый день — фруктовые тележки и смузи-станции: спелые манго,
 ананас и арбуз веганские сами по себе, только смузи просите без сгущёнки и мёда.

 ## Октябрь — сезон киндже

 Раз в год в Таиланде проходит фестиваль кин-дже (เทศกาลกินเจ, «вегетарианский фестиваль») — около
 девяти дней, обычно в октябре; точные даты каждый год сдвигаются по лунному календарю. В эти дни
 жёлтые флажки เจ появляются повсюду, а многие обычные рестораны и уличные точки добавляют
 дже-меню. Для вегана это самое сытное время в стране. Одна оговорка: в обычных ресторанах
 фестивальные дже-блюда могут готовиться на той же кухне и в тех же воках, что и мясные, — если
 для вас это важно, лучше уточнить.

 ## Про наше кафе — без превосходных степеней

-Наше кафе маленькое и семейное, находится в районе Банг Ламунг. Кухня у нас 100% веганская (и
-дже) круглый год: рыбному соусу, яйцам и молочным продуктам неоткуда взяться — их в доме просто
-нет. Овсяное молоко для кофе и тайского чая делаем сами.
+Наше кафе маленькое и семейное, находится в районе Банг Ламунг. Меню у нас 100% веганское (и
+дже) круглый год: в рецептах нет рыбного соуса, яиц и молочных продуктов. Для кофе и тайского чая
+используем растительное молоко.

-Открываемся в 7:00 утра и работаем каждый день до 22:00.
-Цены — от 90 бат за свежевыжатый сок до примерно 180 за карри: манговый смузи за 100,
-латте за 110, пад тай за 149, красный карри за 179 (в кафе у стойки может быть чуть дешевле). Мы не единственное веганское место в Паттайе и не называем себя
+Актуальные часы работы и адрес опубликованы на [странице контактов](/ru/contact/),
+а текущие цены — в [меню](/ru/menu/). Мы не единственное веганское место в Паттайе и не называем себя
 лучшим — просто если окажетесь рядом, особенно рано утром, будем рады накормить.

 [Меню с настоящими ценами](/ru/menu/) — на сайте. Для частых сценариев есть отдельные страницы:
 [веганский завтрак в Паттайе](/ru/veganskiy-zavtrak-v-pattaye/) и
 [веганская доставка в Паттайе](/ru/veganskaya-dostavka-v-pattaye/). Адрес и часы работы — на
 [странице контактов](/ru/contact/).
diff --git a/src/content/articles/ru/welcome.md b/src/content/articles/ru/welcome.md
index 31ab6be..692462d 100644
--- a/src/content/articles/ru/welcome.md
+++ b/src/content/articles/ru/welcome.md
@@ -1,22 +1,22 @@
 ---
 translationKey: welcome
 locale: ru
 title: 'Добро пожаловать: у Apple Vegan Cafe появился сайт'
 description: 'У нашего семейного веган-кафе в Паттайе теперь есть официальный сайт: настоящее меню, цены и часы работы.'
 slug: dobro-pozhalovat
-author: family
+author: editorial
 publishedAt: 2026-07-15
 draft: false
 ---

 Привет! Мы — маленькое семейное кафе в Паттайе, каждый день готовим 100% веганскую
-(เจ) тайскую еду с 7:00 утра.
+(เจ) тайскую еду.

 Этот сайт — наш официальный дом в интернете: [меню с настоящими ценами](/ru/menu/), часы работы
-и то, как нас найти. Всё здесь написано нашей семьёй и проверено вручную.
+и то, как нас найти.

 Если планируете день вокруг еды, начните со страницы про
-[веганский завтрак с 7:00](/ru/veganskiy-zavtrak-v-pattaye/) или про
-[доставку через GrabFood и самовывоз](/ru/veganskaya-dostavka-v-pattaye/).
+[веганский завтрак](/ru/veganskiy-zavtrak-v-pattaye/) или про
+[доставку через GrabFood](/ru/veganskaya-dostavka-v-pattaye/).

 Приходите голодными — кухня ждёт.
diff --git a/src/content/articles/th/vegan-vs-jay.md b/src/content/articles/th/vegan-vs-jay.md
index 2761867..6ad302e 100644
--- a/src/content/articles/th/vegan-vs-jay.md
+++ b/src/content/articles/th/vegan-vs-jay.md
@@ -1,63 +1,63 @@
 ---
 translationKey: vegan-vs-jay
 locale: th
 title: 'เจกับวีแกนต่างกันอย่างไร — และทำไมครัวเจจึงเสิร์ฟได้ทั้งสองแบบ'
 description: 'อธิบายแบบบ้าน ๆ ว่า "วีแกน" คืออะไร เหมือนและต่างจากอาหารเจกับมังสวิรัติตรงไหน และทำไมครัวเจของครอบครัวเราจึงต้อนรับทั้งคนถือศีลกินเจและชาววีแกน'
 slug: เจ-กับ-วีแกน-ต่างกันอย่างไร
-author: family
+author: editorial
 publishedAt: 2026-07-17
 draft: true
 ---

 สวัสดีค่ะ ที่ร้านของเรามีลูกค้าสองกลุ่มหลัก ๆ คือคนไทยที่ทานเจ กับชาวต่างชาติที่เรียกตัวเองว่า
 "วีแกน" (vegan) หลายท่านถามเราว่าสองคำนี้เหมือนกันไหม ต่างกันตรงไหน
-วันนี้ขอเล่าตามความเข้าใจของครอบครัวเรา ในฐานะคนที่ทำครัวเจอยู่ทุกวันนะคะ
+วันนี้ขอเล่าตามความเข้าใจของเรา ในฐานะคนที่ทำครัวเจอยู่ทุกวันนะคะ

 ## วีแกนคืออะไร

 "วีแกน" เป็นแนวทางการกินที่แพร่หลายจากฝั่งตะวันตก หลักการคืองดผลิตภัณฑ์จากสัตว์ทุกชนิด —
 เนื้อสัตว์ อาหารทะเล ไข่ นม เนย น้ำผึ้ง รวมถึงเครื่องปรุงที่ทำจากสัตว์อย่างน้ำปลา น้ำมันหอย
 และกะปิด้วย

 เหตุผลของแต่ละคนต่างกันไป บ้างเลือกเพื่อสัตว์ บ้างเพื่อสุขภาพ บ้างเพื่อสิ่งแวดล้อม
 และโดยมากไม่ได้ผูกกับศาสนาหรือช่วงเทศกาล ชาววีแกนส่วนใหญ่จึงทานแบบนี้ตลอดทั้งปี

 ข้อแตกต่างที่ชัดที่สุดจากเจคือ วีแกนไม่ได้งดผักฉุน — กระเทียม หัวหอม กุยช่าย ต้นหอม
 ยังทานได้ตามปกติ

 ## เหมือนเจตรงไหน ต่างตรงไหน

 อาหารเจตามธรรมเนียมของผู้ถือศีลกินเจ นอกจากงดเนื้อสัตว์และผลิตภัณฑ์จากสัตว์ทุกชนิดแล้ว
 ยังงดผักฉุนด้วย เพราะถือว่าเป็นของกระตุ้นจิตใจ รายละเอียดอาจต่างกันไปบ้างตามแต่ละบ้านและแต่ละศาล
 แต่ถ้าสรุปให้สั้นที่สุดก็คือ

 - **อาหารเจ** = ไม่มีของจากสัตว์เลย และไม่มีผักฉุน
 - **อาหารวีแกน** = ไม่มีของจากสัตว์เลย แต่มีกระเทียมหัวหอมได้

 ดังนั้น อาหารเจทุกจานเป็นอาหารวีแกนโดยอัตโนมัติ แต่อาหารวีแกนอาจไม่ใช่เจ
 ถ้าจานนั้นมีกระเทียมหรือหัวหอมอยู่

 ## แล้วมังสวิรัติล่ะ

 มังสวิรัติคือการงดเนื้อสัตว์ แต่บางท่านยังทานไข่ นม หรือน้ำผึ้งอยู่ แล้วแต่แนวทางของแต่ละคน
 จึงเป็นแบบที่ "เบา" ที่สุดในสามแบบนี้ — อาหารมังสวิรัติที่มีไข่หรือนมจะไม่ใช่ทั้งเจและวีแกนค่ะ

 ## ทำไมครัวเจจึงเสิร์ฟชาววีแกนได้อย่างสบายใจ

 ลองนึกถึงของที่ชาววีแกนต้องคอยระวังในร้านอาหารทั่วไป — น้ำปลาในน้ำจิ้มและต้มยำ
 น้ำมันหอยในผัดผัก กะปิในน้ำพริกแกง ไข่ในผัดไทยและข้าวผัด นมข้นในชาไทย —
 ทั้งหมดนี้เป็นของที่ครัวเจไม่ใช้อยู่แล้วตั้งแต่ต้น ไม่ต้องสั่งพิเศษ ไม่ต้องกำชับ

-ครัวที่ปรุงเจจริง ๆ จึงเป็นที่ที่ชาววีแกนนั่งทานได้โดยไม่ต้องถามอะไรเลย
-และนี่คือเหตุผลที่ร้านของเราเขียนทั้งคำว่า "เจ" และ "vegan" ไว้บนป้ายเดียวกันค่ะ
+ครัวที่ปรุงเจจริง ๆ จึงไม่มีส่วนผสมจากสัตว์ตามหลักเจ และนี่คือเหตุผลที่ร้านของเราเขียนทั้งคำว่า
+"เจ" และ "vegan" ไว้บนป้ายเดียวกันค่ะ ส่วนผู้ที่มีอาการแพ้หรือข้อจำกัดเฉพาะ
+ควรถามเรื่องส่วนผสมก่อนสั่งอาหาร

 ## ครัวของเรา

 ครัวของเราเป็นครัวเจ 100% ทุกวันตลอดปี ไม่ใช่เฉพาะช่วงเทศกาลกินเจ ในร้านไม่มีน้ำปลา ไข่
-หรือนมวัวเลย เมนูที่ติดป้ายเจ เช่น แกงมัสมั่นเจ (189 บาท) ผัดไทยเจ (149 บาท) และต้มยำเจ
-(189 บาท) ปรุงแบบเจ ส่วนท่านที่ถือศีลเคร่งเรื่องผักฉุน แจ้งพนักงานก่อนสั่งได้เลยค่ะ
-เรายินดีแนะนำและปรับเท่าที่ทำได้
+หรือนมวัวเลย เมนูที่ติดป้ายเจ เช่น แกงมัสมั่นเจ ผัดไทยเจ และต้มยำเจ ปรุงแบบเจ
+ส่วนท่านที่ถือศีลเคร่งเรื่องผักฉุน กรุณาสอบถามพนักงานเรื่องส่วนผสมก่อนสั่งอาหารค่ะ

-ร้านเปิดทุกวัน 7:00–22:00 น. ราคาอาหารส่วนใหญ่อยู่ที่ประมาณ 100–190 บาท
-ดู[เมนูพร้อมราคาจริง](/th/menu/)ได้เลย หรืออ่านเรื่องอาหารเจในพัทยาเพิ่มเติมได้ที่หน้า
+ดู[เวลาเปิด-ปิดล่าสุดและวิธีเดินทาง](/th/contact/) รวมถึง
+[เมนูพร้อมราคาจริง](/th/menu/)ได้เลย หรืออ่านเรื่องอาหารเจในพัทยาเพิ่มเติมได้ที่หน้า
 [ร้านอาหารเจ พัทยา](/th/ร้านอาหารเจ-พัทยา/) ของเราค่ะ
diff --git a/src/content/articles/th/welcome.md b/src/content/articles/th/welcome.md
index 3cb19f2..39b1b10 100644
--- a/src/content/articles/th/welcome.md
+++ b/src/content/articles/th/welcome.md
@@ -1,21 +1,19 @@
 ---
 translationKey: welcome
 locale: th
 title: 'ยินดีต้อนรับสู่เว็บไซต์ของคาเฟ่เจครอบครัวเรา'
 description: 'ร้านอาหารเจของครอบครัวเราในพัทยามีเว็บไซต์แล้ว: เมนูจริง ราคาจริง เวลาเปิดจริง'
 slug: ยินดีต้อนรับ
-author: family
+author: editorial
 publishedAt: 2026-07-15
 draft: false
 ---

 สวัสดีค่ะ! เราเป็นร้านอาหารเจเล็ก ๆ ของครอบครัวในพัทยา ทำอาหารเจ 100% ทุกวัน
-เปิดตั้งแต่ 7:00 น.

 เว็บไซต์นี้คือบ้านออนไลน์อย่างเป็นทางการของเรา: [เมนูพร้อมราคาจริง](/th/menu/) เวลาเปิด-ปิด
-และวิธีเดินทางมาหาเรา ทุกอย่างเขียนและตรวจโดยครอบครัวของเราเอง
+และวิธีเดินทางมาหาเรา

-ถ้ากำลังมองหาร้านเจในพัทยา อ่านหน้า [ร้านอาหารเจ พัทยา](/th/ร้านอาหารเจ-พัทยา/)
-ของเราได้เลยค่ะ
+ถ้ากำลังมองหาร้านเจในพัทยา ดู[เมนูภาษาไทยทั้งหมด](/th/menu/)ได้เลยค่ะ

 แวะมาทานกันนะคะ ครัวของเรารออยู่
diff --git a/src/content/faqs.json b/src/content/faqs.json
index 3dd3d2d..9732d61 100644
--- a/src/content/faqs.json
+++ b/src/content/faqs.json
@@ -1,167 +1,152 @@
 [
   {
     "id": "all-vegan",
     "topic": "food",
     "order": 1,
     "question": {
       "en": "Is everything on the menu vegan?",
       "th": "อาหารทุกจานเป็นเจ/วีแกนหรือไม่?",
       "ru": "Всё ли меню веганское?"
     },
     "answer": {
-      "en": "Yes — 100%. We are a fully vegan (เจ) kitchen: no meat, no fish sauce, no egg, no dairy.",
-      "th": "ใช่ 100% ครัวของเราเป็นเจทั้งหมด ไม่มีเนื้อสัตว์ น้ำปลา ไข่ หรือนม",
-      "ru": "Да, на 100%. Наша кухня полностью веганская (เจ): без мяса, рыбного соуса, яиц и молочных продуктов."
+      "en": "Yes — 100%. We are a fully vegan (เจ) kitchen: no meat, no fish sauce, no egg, no dairy. Names such as vegan chicken, pork, fish and egg always refer to plant-based alternatives.",
+      "th": "ใช่ 100% ครัวของเราเป็นเจทั้งหมด ไม่มีเนื้อสัตว์ น้ำปลา ไข่ หรือนม ชื่อเมนู เช่น ไก่เจ หมูเจ ปลาเจ หรือไข่เจ หมายถึงผลิตภัณฑ์จากพืชทั้งหมด",
+      "ru": "Да, на 100%. Наша кухня полностью веганская (เจ): без мяса, рыбного соуса, яиц и молочных продуктов. Слова «курица», «свинина», «рыба» и «яйцо» в названиях означают растительные аналоги."
     }
   },
   {
     "id": "fish-sauce",
     "topic": "food",
     "order": 2,
     "question": {
       "en": "Do you cook with fish sauce or oyster sauce?",
       "th": "ใช้น้ำปลาหรือน้ำมันหอยไหม?",
       "ru": "Используете ли вы рыбный или устричный соус?"
     },
     "answer": {
-      "en": "Never. We season with soy sauce, salt and Thai herbs only — the whole kitchen is plant-based.",
-      "th": "ไม่ใช้เลย เราปรุงด้วยซีอิ๊ว เกลือ และสมุนไพรไทยเท่านั้น",
-      "ru": "Никогда. Мы готовим только на соевом соусе, соли и тайских травах — вся кухня растительная."
+      "en": "No. Fish sauce and oyster sauce are animal products, and our entire menu is plant-based.",
+      "th": "ไม่ใช้ค่ะ น้ำปลาและน้ำมันหอยเป็นผลิตภัณฑ์จากสัตว์ ส่วนเมนูทั้งร้านของเราเป็นอาหารจากพืช",
+      "ru": "Нет. Рыбный и устричный соусы — продукты животного происхождения, а всё наше меню растительное."
     }
   },
   {
     "id": "cross-contact",
     "topic": "food",
     "order": 3,
     "question": {
       "en": "Is there any cross-contact with animal products?",
       "th": "มีการปนเปื้อนกับผลิตภัณฑ์จากสัตว์ไหม?",
       "ru": "Есть ли риск контакта с продуктами животного происхождения?"
     },
     "answer": {
-      "en": "No. Ours is a single, fully plant-based kitchen — no meat, dairy, eggs or fish products are ever on the premises, so there is nothing to cross-contact with.",
-      "th": "ไม่มี ครัวของเราเป็นครัวเจล้วนเพียงครัวเดียว ไม่มีเนื้อสัตว์ นม ไข่ หรือผลิตภัณฑ์จากปลาเข้ามาในร้านเลย จึงไม่มีอะไรให้ปนเปื้อน",
-      "ru": "Нет. У нас одна, полностью растительная кухня: мясо, молочные продукты, яйца и рыба вообще не попадают в заведение, поэтому контактировать просто не с чем."
+      "en": "The menu is fully vegan. We have not yet published a verified cross-contact protocol, so guests with severe allergies should explain their needs to the team before ordering.",
+      "th": "เมนูทั้งหมดเป็นวีแกน แต่เรายังไม่ได้เผยแพร่ขั้นตอนป้องกันการปนเปื้อนที่ตรวจสอบแล้ว ผู้ที่มีอาการแพ้รุนแรงควรแจ้งพนักงานก่อนสั่งอาหาร",
+      "ru": "Меню полностью веганское, но подтверждённый протокол по перекрёстному контакту пока не опубликован. При тяжёлой аллергии обязательно сообщите команде до заказа."
     }
   },
   {
     "id": "gluten-free",
     "topic": "food",
     "order": 4,
     "question": {
       "en": "Do you have gluten-free dishes?",
       "th": "มีเมนูปราศจากกลูเตนไหม?",
       "ru": "Есть ли у вас блюда без глютена?"
     },
     "answer": {
-      "en": "Yes — several dishes are gluten-free and marked on the menu. To be honest with you: we are not a certified gluten-free kitchen, so we cannot guarantee zero traces. Tell us when you order and we will help you choose.",
-      "th": "มีหลายจานที่ไม่มีกลูเตน และมีป้ายกำกับไว้ในเมนู แต่ขอบอกตามตรงว่าครัวของเราไม่ได้รับการรับรองปลอดกลูเตน จึงรับประกันไม่ได้ว่าไม่มีการปนเปื้อนเลย แจ้งเราตอนสั่งอาหารได้เลย เรายินดีช่วยเลือก",
-      "ru": "Да, несколько блюд без глютена — они отмечены в меню. Честно скажем: наша кухня не сертифицирована как безглютеновая, поэтому полное отсутствие следов гарантировать не можем. Скажите нам при заказе — поможем выбрать."
+      "en": "Some dishes may be made without gluten ingredients, but we do not currently publish verified gluten-free labels and cannot guarantee zero traces. Tell us about your restrictions before ordering so the team can explain the known ingredients.",
+      "th": "อาหารบางจานอาจทำโดยไม่มีส่วนผสมที่มีกลูเตน แต่ตอนนี้เรายังไม่ได้เผยแพร่ป้ายเมนูปลอดกลูเตนที่ตรวจสอบแล้ว และรับประกันไม่ได้ว่าไม่มีการปนเปื้อน กรุณาแจ้งข้อจำกัดก่อนสั่งเพื่อให้ทีมอธิบายส่วนผสมที่ทราบ",
+      "ru": "Некоторые блюда могут готовиться без ингредиентов с глютеном, но подтверждённых отметок в меню сейчас нет, а отсутствие следов мы не гарантируем. Сообщите об ограничениях до заказа, чтобы команда могла уточнить известный состав."
     }
   },
   {
     "id": "delivery",
     "topic": "ordering",
     "order": 5,
     "question": {
       "en": "Do you deliver?",
       "th": "มีบริการส่งอาหารไหม?",
       "ru": "Есть ли у вас доставка?"
     },
     "answer": {
-      "en": "Yes — via GrabFood: search for Apple Vegan Cafe in the app. The cafe itself runs 7:00–22:00, but we often keep Grab orders on around the clock — the app always shows our live status. You can also call us and pick your order up at the cafe.",
-      "th": "มีค่ะ ส่งผ่าน GrabFood ค้นหา Apple Vegan Cafe ในแอปได้เลย หน้าร้านเปิด 7:00–22:00 แต่ใน Grab เรามักเปิดรับออเดอร์เกือบตลอดเวลา สถานะจริงดูในแอปได้เลยค่ะ หรือจะโทรสั่งแล้วมารับที่ร้านก็ได้",
-      "ru": "Да — через GrabFood: найдите Apple Vegan Cafe в приложении. Само кафе работает 7:00–22:00, но заказы в Grab мы часто принимаем почти круглосуточно — актуальный статус всегда виден в приложении. Можно также позвонить и забрать заказ в кафе."
+      "en": "Use the confirmed ordering link on this site and check your address in the delivery app for live availability.",
+      "th": "ใช้ลิงก์สั่งอาหารที่ยืนยันแล้วบนเว็บไซต์ และตรวจสอบที่อยู่ในแอปเพื่อดูสถานะล่าสุด",
+      "ru": "Используйте подтверждённую ссылку заказа на сайте и проверьте адрес в приложении — там показана актуальная доступность."
     }
   },
   {
     "id": "hours",
     "topic": "visit",
     "order": 6,
     "question": {
       "en": "What are your opening hours? When are you closed?",
       "th": "ร้านเปิดกี่โมง และหยุดวันไหน?",
       "ru": "Какие у вас часы работы? Когда выходной?"
     },
     "answer": {
-      "en": "We are open every day, 7:00–22:00. And we often keep Grab delivery orders on around the clock — the app shows our live status.",
-      "th": "เราเปิดทุกวัน เวลา 7:00–22:00 น. และใน Grab เรามักเปิดรับออเดอร์เกือบตลอดเวลา สถานะจริงดูในแอปได้เลยค่ะ",
-      "ru": "Мы открыты каждый день с 7:00 до 22:00. А заказы в Grab часто принимаем почти круглосуточно — статус виден в приложении."
+      "en": "Current regular and special hours are published on this site.",
+      "th": "เว็บไซต์นี้แสดงเวลาปกติและเวลาพิเศษล่าสุดของร้าน",
+      "ru": "Актуальные обычные и специальные часы опубликованы на сайте."
     }
   },
   {
     "id": "payment",
     "topic": "visit",
     "order": 7,
     "question": {
       "en": "Do you take cards?",
       "th": "รับบัตรเครดิตไหม?",
       "ru": "Можно ли расплатиться картой?"
     },
     "answer": {
-      "en": "We currently accept cash. Payment options may change, so please check with us about bank transfers or QR payment before your visit.",
-      "th": "ตอนนี้เรารับเงินสด ช่องทางชำระเงินอาจเปลี่ยนแปลงได้ หากต้องการโอนหรือสแกน QR รบกวนสอบถามทางร้านก่อนมานะคะ",
-      "ru": "Сейчас мы принимаем наличные. Способы оплаты могут меняться, поэтому насчёт перевода или оплаты по QR-коду лучше уточнить у нас заранее."
+      "en": "We have not yet published a verified payment-method list. Please contact us before your visit if you need to pay by card, transfer or QR.",
+      "th": "เรายังไม่ได้เผยแพร่รายการช่องทางชำระเงินที่ยืนยันแล้ว หากต้องการชำระด้วยบัตร โอนเงิน หรือ QR กรุณาติดต่อร้านก่อนมา",
+      "ru": "Мы ещё не опубликовали подтверждённый список способов оплаты. Если вам нужна оплата картой, переводом или QR, уточните у нас до визита."
     }
   },
   {
     "id": "fasting",
     "topic": "food",
     "order": 8,
     "question": {
       "en": "Is the food suitable for religious fasting (Buddhist เจ, Orthodox Lent)?",
       "th": "อาหารเหมาะกับช่วงถือศีลกินเจไหม?",
       "ru": "Подходит ли еда для православного поста?"
     },
     "answer": {
-      "en": "Yes. Everything we cook is 100% plant-based all year — no meat, fish, egg or dairy — so it fits the Thai เจ observance and meat-free fasting traditions such as Orthodox Lent by definition.",
-      "th": "เหมาะค่ะ อาหารของเราเป็นเจแท้ 100% ตลอดทั้งปี ไม่ใช่เฉพาะช่วงเทศกาลกินเจ ทานเจได้อย่างสบายใจทุกวันค่ะ",
-      "ru": "Да. Вся наша еда круглый год на 100% растительная — без мяса, рыбы, яиц и молочного, — поэтому по определению подходит для православного поста, включая строгие дни."
+      "en": "The menu contains no meat, fish, egg or dairy. Religious fasting rules vary, including rules about oil, alcohol and strict days; compare this with your practice and ask the team before ordering if needed.",
+      "th": "เมนูไม่มีเนื้อสัตว์ ปลา ไข่ หรือนม แต่หลักการถือศีลหรือการกินเจของแต่ละท่านอาจต่างกัน รวมถึงเรื่องน้ำมัน แอลกอฮอล์ และข้อปฏิบัติในบางวัน กรุณาเทียบกับแนวทางของท่านและสอบถามทีมก่อนสั่งหากจำเป็น",
+      "ru": "В меню нет мяса, рыбы, яиц и молочных продуктов. Правила религиозного поста различаются, в том числе в отношении масла, алкоголя и строгих дней; сверьте меню со своей практикой и при необходимости уточните у команды до заказа."
     }
   },
   {
     "id": "halal",
     "topic": "food",
     "order": 9,
     "question": {
       "en": "Is the food halal?",
       "th": "อาหารฮาลาลไหม?",
       "ru": "Ваша еда халяльная?"
     },
     "answer": {
-      "en": "We don't hold a halal certificate, so we won't claim the word. What we can promise: the kitchen is 100% plant-based — no meat of any kind, no pork, no lard, and nothing shares a pan with them, because they are simply never here. Many Muslim guests are comfortable with that; the choice is always yours.",
-      "th": "ร้านเราไม่มีใบรับรองฮาลาล จึงไม่ขอกล่าวอ้างคำนั้น แต่ที่รับรองได้คือ ครัวของเราเป็นพืช 100% ไม่มีเนื้อสัตว์ใด ๆ ไม่มีหมู ไม่มีน้ำมันหมูในร้านเลย แขกมุสลิมหลายท่านสบายใจที่จะทาน แล้วแต่ท่านพิจารณาค่ะ",
-      "ru": "Халяль-сертификата у нас нет, поэтому этим словом мы не разбрасываемся. Что можем обещать твёрдо: кухня на 100% растительная — никакого мяса, свинины и смальца в заведении просто не бывает. Многим гостям-мусульманам этого достаточно; решение всегда за вами."
+      "en": "Our menu is 100% plant-based. We have not yet published verified information about halal certification or cooking alcohol, so we do not describe the food as halal. If either point matters to you, please ask the team before ordering.",
+      "th": "เมนูของเราเป็นอาหารจากพืช 100% ขณะนี้เรายังไม่ได้เผยแพร่ข้อมูลที่ยืนยันแล้วเกี่ยวกับใบรับรองฮาลาลหรือการใช้แอลกอฮอล์ในการปรุงอาหาร จึงไม่กล่าวอ้างว่าอาหารเป็นฮาลาล หากข้อมูลสองข้อนี้สำคัญต่อคุณ โปรดสอบถามทีมงานก่อนสั่งอาหาร",
+      "ru": "Наше меню на 100% растительное. Мы пока не опубликовали подтверждённые данные о халяль-сертификации и использовании алкоголя в готовке, поэтому не называем еду халяльной. Если это важно для вас, уточните оба пункта у команды до заказа."
     }
   },
   {
     "id": "late-night-orders",
     "topic": "ordering",
     "order": 10,
     "question": {
       "en": "Can I order food late at night?",
       "th": "สั่งอาหารดึก ๆ ได้ไหม?",
       "ru": "Можно ли заказать еду поздно ночью?"
     },
     "answer": {
-      "en": "Often yes. The dining room closes at 22:00, but we are a family business and usually keep GrabFood orders on around the clock — a late order literally wakes the kitchen up. We can't promise every single night, so the Grab app is the source of truth: if it shows us open, we're cooking.",
-      "th": "ส่วนใหญ่ได้ค่ะ หน้าร้านปิด 22:00 แต่เราเป็นร้านครอบครัวและมักเปิดรับออเดอร์ใน GrabFood เกือบตลอดเวลา ออเดอร์ดึก ๆ ปลุกครัวได้จริง ๆ ค่ะ แต่รับปากทุกคืนไม่ได้ ให้ดูสถานะจริงในแอป Grab เลยนะคะ ถ้าขึ้นว่าเปิด แปลว่าเรากำลังทำอาหารค่ะ",
-      "ru": "Чаще всего — да. Зал закрывается в 22:00, но мы семейный бизнес и заказы в GrabFood обычно принимаем почти круглосуточно: ночной заказ буквально будит кухню. Обещать каждую ночь не можем, поэтому источник истины — приложение Grab: если там «открыто», мы уже готовим."
-    }
-  },
-  {
-    "id": "phone-takeaway",
-    "topic": "ordering",
-    "order": 11,
-    "question": {
-      "en": "Can I order takeaway by phone and pick it up?",
-      "th": "โทรสั่งแล้วมารับที่ร้านได้ไหม?",
-      "ru": "Можно ли заказать навынос по телефону и забрать самим?"
-    },
-    "answer": {
-      "en": "Of course. Call us, say what you'd like, and we'll have it packed and waiting at the counter when you arrive. Pickup at the counter is often a little cheaper than the delivery apps — just ask us.",
-      "th": "ได้แน่นอนค่ะ โทรมาบอกเมนูที่ต้องการ เราจะแพ็กเตรียมไว้ให้ มาถึงก็รับได้เลย รับเองที่ร้านมักถูกกว่าสั่งผ่านแอปนิดหน่อยด้วยค่ะ สอบถามได้เลย",
-      "ru": "Конечно. Позвоните, скажите, что собрать, — к вашему приходу заказ будет упакован и ждать у стойки. Самовывоз у стойки часто немного дешевле, чем в приложениях доставки, — просто спросите нас."
+      "en": "Sometimes. Dining-room hours and delivery hours are different, so check the live GrabFood status before ordering. If the cafe appears open late, an order can literally wake the family and send them to the kitchen — but the website does not promise late-night availability.",
+      "th": "บางครั้งได้ค่ะ เวลาเปิดหน้าร้านกับเวลารับเดลิเวอรีไม่เหมือนกัน จึงควรดูสถานะจริงใน GrabFood ก่อนสั่ง หากร้านขึ้นว่าเปิดตอนดึก ออเดอร์อาจปลุกครอบครัวให้ลุกมาทำอาหารได้จริง ๆ แต่เว็บไซต์ไม่ได้รับประกันว่าจะเปิดรับออเดอร์ดึกค่ะ",
+      "ru": "Иногда. Часы зала и доставки отличаются, поэтому перед заказом проверьте живой статус в GrabFood. Если поздно ночью кафе отмечено открытым, заказ действительно может разбудить семью и отправить её на кухню — но сайт не обещает ночную доступность."
     }
   }
 ]
diff --git a/src/content/pages/about-en.md b/src/content/pages/about-en.md
index 96e119c..0a35116 100644
--- a/src/content/pages/about-en.md
+++ b/src/content/pages/about-en.md
@@ -1,14 +1,14 @@
 ---
 translationKey: about
 locale: en
 title: 'About our family cafe'
 description: 'Apple Vegan Cafe & Restaurant is a family-run, 100% vegan Thai kitchen in Pattaya.'
 ---

-Apple Vegan Cafe & Restaurant is run by our family — a couple and mom, a former chef.
-Everything we serve is 100% plant-based (เจ): no meat, no fish sauce, no egg, no dairy.
+Our family runs Apple Vegan Cafe & Restaurant in Pattaya. Everything we serve is 100%
+plant-based (เจ): no meat, no fish sauce, no egg, no dairy.

-We open early, at 7:00, cook Thai and Western dishes, and make our own oat milk drinks.
+We open early and cook Thai and Western dishes. Current hours are shown on our contact page.

-_(This is a short placeholder text — the real family story, with photos, will be written
-together with the family before launch.)_
+Our full menu and current prices are available [online](/menu/). You can eat with us every day,
+order through GrabFood, or [contact the cafe with a question](/contact/).
diff --git a/src/content/pages/about-ru.md b/src/content/pages/about-ru.md
index 84aecdd..3ab224d 100644
--- a/src/content/pages/about-ru.md
+++ b/src/content/pages/about-ru.md
@@ -1,15 +1,15 @@
 ---
 translationKey: about
 locale: ru
 title: 'О нашем семейном кафе'
 description: 'Apple Vegan Cafe & Restaurant — семейная 100% веганская тайская кухня в Паттайе.'
 ---

-Наше кафе ведёт семья — пара и мама, бывший шеф-повар. Всё, что мы готовим, —
+Наша семья ведёт Apple Vegan Cafe & Restaurant в Паттайе. Всё, что мы готовим, —
 на 100% растительное (เจ): без мяса, рыбного соуса, яиц и молочных продуктов.

-Мы открываемся рано, в 7:00, готовим тайские и европейские блюда и сами делаем
-овсяное молоко для напитков.
+Мы открываемся рано и готовим тайские и европейские блюда. Актуальные часы указаны
+на странице контактов.

-_(Это черновик — настоящую историю семьи с фотографиями напишем вместе с семьёй
-перед запуском.)_
+Полное меню с актуальными ценами можно [посмотреть на сайте](/ru/menu/). Приходите к нам
+каждый день, заказывайте через GrabFood или [свяжитесь с кафе, если есть вопрос](/ru/contact/).
diff --git a/src/content/pages/about-th.md b/src/content/pages/about-th.md
index 4f60634..58cf9e0 100644
--- a/src/content/pages/about-th.md
+++ b/src/content/pages/about-th.md
@@ -1,13 +1,14 @@
 ---
 translationKey: about
 locale: th
 title: 'เกี่ยวกับร้านของครอบครัวเรา'
 description: 'Apple Vegan Cafe & Restaurant คือครัวเจ 100% ของครอบครัวในพัทยา'
 ---

-ร้านของเราดูแลโดยครอบครัว — สองสามีภรรยาและคุณแม่ที่เคยเป็นเชฟ
+ครอบครัวของเราดูแล Apple Vegan Cafe & Restaurant ในพัทยา
 อาหารทุกจานเป็นเจ 100%: ไม่มีเนื้อสัตว์ น้ำปลา ไข่ หรือนม

-เราเปิดเช้าตั้งแต่ 7:00 น. มีทั้งอาหารไทยและอาหารฝรั่ง และทำนมข้าวโอ๊ตเอง
+เราเปิดตั้งแต่เช้าและมีทั้งอาหารไทยและอาหารฝรั่ง ดูเวลาเปิด-ปิดล่าสุดได้ที่หน้าติดต่อ

-_(ข้อความนี้เป็นฉบับร่าง — เรื่องราวจริงของครอบครัวพร้อมรูปถ่ายจะเขียนร่วมกับครอบครัวก่อนเปิดตัว)_
+ดู[เมนูและราคาล่าสุด](/th/menu/)ได้บนเว็บไซต์ มาทานที่ร้านได้ทุกวัน สั่งผ่าน GrabFood
+หรือ[ติดต่อร้านหากมีคำถาม](/th/contact/)ได้เลย
```
