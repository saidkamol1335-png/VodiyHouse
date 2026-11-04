# Итоговая спецификация: «Архитектурный люкс» (травертин, графит, бронза)

Направление выбрали оба судьи. Я добавил в него лучшие идеи из «Наследия» и «Тихой роскоши» и закрыл все обязательные правки. Работа рассчитана на одну рабочую сессию в три блока. То, что дольше, помечено «позже».

Корень репозитория: `C:/Users/Alocomputers/Desktop/VH_release`. Ниже все пути даны от него.

## 0. Перед кодом

**Две строки в `docs/design-decisions.md`.** Без них код не начинать.

1. **Акцент (отступление от ТЗ §2).**
   - Главная кнопка сайта графитовая.
   - Мелкий акцент бронзовый.
   - Янтарь `#F89B0D` остаётся только в логотипе, иконке вкладки, пиксельном знаке подвала и на экране загрузки.
   - Запасной вариант, если заказчик против, — блок из 3 строк, см. A3.
2. **Первый экран.** Меняются только токены цвета, начертание h1 и цвет кнопки. Раскладка, постер, пелена и пункты не меняются (решение «Сдача · экран загрузки ≤ 3 с»).

**Ещё одна строка в `design-decisions.md` — что переопределяется:**
- «Токены · радиусы»;
- «Токены · шрифты»: h1 и h2 — Manrope 400/450, название ЖК — Cormorant прямым;
- Э1 (колонок нет на сайте), Э3 (подсветки нет), Э4 (зерно .025);
- Ш2 (логотип без свечения);
- активный пункт шапки — сплошная линия.

**Блоки работы:**
1. Механизм и палитра: A0–A3, плюс B.
2. Компоненты C1–C8.
3. Подвал, первый экран, текстуры, движение: C9–C12 и D.

После каждого шага — lint, typecheck и одна e2e-спека на 1440. После A2 — e2e кабинета на 1440: правятся общие с кабинетом CSS-файлы.

---

## A. Токены

### A0. Как ограничить правки публичным сайтом

Кабинет `/admin` и `/dev` читают тот же `tokens.css`. Поэтому все новые значения действуют только под атрибутом сайта.

1. **`apps/site/components/RootDocument/RootDocument.tsx`**
   - Новый проп `surface?: "site"`.
   - На `<html>` добавить `data-surface={surface}`.
   - `BackgroundColumns` больше не рендерить на сайте. Проп `withColumns` удалить вместе с рендером колонок, или оставить и не передавать.
2. **`apps/site/app/[locale]/layout.tsx`**
   - `withColumns` заменить на `surface="site"`.
   - После `import "../site.css";` добавить `import "../../styles/skin-site.css";`.
3. **Новый файл `apps/site/styles/skin-site.css`** — весь «скин». Откат — убрать этот import и атрибут.
4. **Правила специфичности в скине:**
   - Каждый селектор начинается с `:root[data-surface="site"]`. Это (0,2,0) и больше, такой селектор бьёт базовые правила компонентов.
   - Правила, которые перекрывают `[data-motion="full"] …`, пишутся с `:root[data-surface="site"][data-motion="full"]`.
   - **В базовом блоке скина не задавать** `--glass`, `--glass-filter`, `--over-photo-button`, `--over-photo-filter` и `--dur-*`. Иначе скин перебьёт lite/none из `tokens.css`. Значения только для full — в блоке `[data-motion="full"]`.
   - Мобильные `--fs-h1`/`--fs-h2` повторить в своём `@media` внутри скина.
5. **`app/global-not-found.tsx`** (404) атрибута не получает и остаётся в старом виде. Это позже.

### A1. Новые ролевые токены в `packages/shared/styles/tokens.css`

Добавить в блок `:root`. По умолчанию они равны текущему поведению, поэтому кабинет не меняется.

```css
--accent: var(--amber);
--accent-hover: var(--amber-hover);
--on-accent: var(--on-amber);
--focus-ring: var(--amber);
--action-bg: var(--amber);
--action-bg-hover: var(--amber-hover);
--action-fg: var(--on-amber);
--action-glow: var(--glow-amber);
--rule-style: dashed;
--selection: rgba(248, 155, 13, 0.3);
--display: var(--font);
--r-button: var(--r-pill);
--r-chip: var(--r-pill);
--r-badge: var(--r-pill);
--footer-bg: transparent;
```

Сам `--amber` **не переопределять нигде**. Тогда логотип (`Logo.tsx:10 fill="var(--amber)"`) и `icon.svg` остаются янтарными без отдельного `--brand-amber`.

### A2. Механические замены

Это правка компонентов. Для кабинета замены пустые: значения по умолчанию те же.

1. **Роль янтаря.** Во всех `apps/site/components/**/*.css`, **кроме** `SitePreloader/SitePreloader.css`:

   ```
   var(--amber)          → var(--accent)
   var(--amber-hover)    → var(--accent-hover)
   var(--on-amber)       → var(--on-accent)
   var(--on-amber, #1a1205) → var(--on-accent)
   ```

   - Затем вернуть вручную `SiteFooter.css` → `.site-footer__pixels { fill: var(--amber); }`: знак бренда.
   - `HomeHero.css`: строка 17 `--amber-hover:` → `--accent-hover:`, строка 20 `--on-amber:` → `--on-accent:`. Это локальные переопределения: свойство, вычисленное на `:root`, их не видит.
   - `CatalogCard.css:99`: `var(--amber-text, var(--fg))` → `var(--amber-2)`. Токена `--amber-text` нет.
2. **Фокус.** Везде `outline: 2px solid var(--accent)` → `outline: 2px solid var(--focus-ring)` (около 70 мест).
3. **Пунктир.** В объявлениях `border*` и `border-style` слово `dashed` → `var(--rule-style)` (около 142 мест). Пример: `border-top: 1px var(--rule-style) var(--dash)`. `dotted` в `HeaderNav.css:35` не трогать: он перекрыт в скине (C6).
4. **`packages/shared/styles/base.css`**
   - строка 33: `background: var(--selection);`
   - строка 38: `outline: 2px solid var(--focus-ring);`
5. **`apps/site/app/globals.css`** (`@theme`): `--color-primary: var(--accent)`, `--color-primary-foreground: var(--on-accent)`, `--color-ring: var(--focus-ring)`.
6. **Главные кнопки читают `--action-*`:**
   - `Button/Button.css`:
     - `.button--primary { background: var(--action-bg); color: var(--action-fg); box-shadow: var(--action-glow); }`;
     - `:hover` → `var(--action-bg-hover)`;
     - `[data-motion="full"] .button--primary:not(:disabled)::before` → `var(--action-bg-hover)`;
     - `[data-motion="full"] .button--primary:not(:disabled):hover` → `var(--action-bg)`;
     - `.button { border-radius: var(--r-button); }`.
   - `ComplexBar/ComplexBar.css` `.complex-bar__book`: `--action-bg` / `--action-fg` / `--action-glow`, радиус `var(--r-button)`.
   - `FilterPills/FilterPills.css` `.filter-pills__pill`: радиус `var(--r-chip)`.
   - `Badge/Badge.css` `.badge`: радиус `var(--r-badge)`.
7. **`CatalogCard/CatalogCard.css`, строки 49–53** (хардкоды подписи):
   - `background: var(--over-photo-chip); color: var(--over-photo-fg); border-radius: var(--r-xs); font-size: var(--fs-micro);`.
8. **`CatalogCard/CatalogCard.tsx:116`:** `<LeadButton … variant="outline" />`. Это одна кнопка-заливка на экран; кнопка остаётся, путь к заявке тот же.

### A3. Скин: блок токенов (`apps/site/styles/skin-site.css`)

```css
/* «Архитектурный люкс» — только публичный сайт (html[data-surface="site"]). */
:root[data-surface="site"] {
  /* Фоны */
  --bg: #eeeae3; --bg-2: #faf8f4; --bg-3: #f5f2ec; --bg-4: #e4ded4; --row-alt: #f5f2ec;
  --page-glow: none;
  --card-bg: #faf8f4; --control-bg: #faf8f4; --chip-bg: #faf8f4; --field-bg: #faf8f4;
  --seg-bg: rgba(30, 28, 25, 0.05); --seg-on-bg: #faf8f4;
  --chip-on-bg: #faf8f4;                       /* выбранное = графитовая рамка, не заливка */
  --map-bg: #e4ded4; --picker-plan-bg: #f5f2ec; --picker-frame-bg: #e4ded4;
  --quiz-card-bg: linear-gradient(#faf8f4, #f3efe8);
  --offer-free-bg: rgba(46, 106, 76, 0.07);    /* единственная цветная плашка — выгода */

  /* Текст */
  --fg: #1e1c19; --fg-heading: #161512; --fg-2: #4a4640; --fg-3: #625c53;
  --badge-fg: #3f3a33; --badge-line-fg: #4a4640; --chip-fg: #4a4640;

  /* Линии — сплошные */
  --line: rgba(30, 28, 25, 0.10); --line-2: rgba(30, 28, 25, 0.16); --line-3: rgba(30, 28, 25, 0.30);
  --dash: rgba(30, 28, 25, 0.12); --rule-style: solid;
  --control-border: rgba(30, 28, 25, 0.18); --chip-border: rgba(30, 28, 25, 0.18);
  --card-border: rgba(30, 28, 25, 0.10); --seg-border: rgba(30, 28, 25, 0.10);
  --home-marquee-stroke: rgba(30, 28, 25, 0.20);

  /* Акцент: одна бронза для текста, линий и фокуса */
  --accent: #7a5634; --accent-hover: #6a4a2c; --on-accent: #f6f2ea;
  --amber-2: #7a5634; --amber-3: #6a4a2c; --gold: #7a5634;
  --amber-soft: rgba(122, 86, 52, 0.10); --amber-line: rgba(122, 86, 52, 0.36);
  --focus-ring: #7a5634; --selection: rgba(122, 86, 52, 0.20);
  --field-ring: 0 0 0 3px rgba(122, 86, 52, 0.18);

  /* Действие: графит */
  --action-bg: #1e1c19; --action-bg-hover: #34312c; --action-fg: #f6f2ea; --action-glow: none;

  /* Выключенные свечения */
  --glow-amber: none; --logo-glow: none; --footer-pixel-glow: none; --footer-glow: none;
  --flash-glow: none; --button-shine: transparent; --live-dot-glow: none;
  --spot-fill: transparent; --spot-edge: transparent; --beam-color: transparent;

  /* Выбранное состояние */
  --chip-on-border: #1e1c19; --chip-on-ring: inset 0 0 0 1px #1e1c19;
  --seg-on-shadow: 0 1px 2px rgba(30, 28, 25, 0.08), inset 0 0 0 1px rgba(30, 28, 25, 0.18);

  /* Бейджи */
  --badge-amber-bg: transparent; --badge-amber-fg: #7a5634; --badge-amber-border: rgba(122, 86, 52, 0.35);
  --ok: #2e6a4c; --ok-strong: #245a3f; --ok-soft: rgba(46, 106, 76, 0.08); --ok-line: rgba(46, 106, 76, 0.28);
  --bad: #a23b2c; --bad-soft: rgba(162, 59, 44, 0.07);
  --blue: #3e5a7a; --blue-soft: rgba(62, 90, 122, 0.08); --violet: #5e5478; --teal: #3d6b68;
  --badge-ok-fg: #2e6a4c; --badge-ok-border: rgba(46, 106, 76, 0.28);
  --badge-bad-fg: #8e3527; --badge-bad-border: rgba(162, 59, 44, 0.28);
  --badge-blue-fg: #3e5a7a; --badge-blue-border: rgba(62, 90, 122, 0.28);
  --live-dot: #3f8a63;

  /* Статусы квартир (те же значения — в --picker-unit-free/res/sold, суффиксы как в tokens.css) */
  --s-free: rgba(46, 106, 76, 0.07); --s-free-b: rgba(46, 106, 76, 0.26); --s-free-t: #2e6a4c;
  --s-res: rgba(122, 86, 52, 0.10); --s-res-b: rgba(122, 86, 52, 0.36); --s-res-t: #6a4a2c;
  --s-sold: rgba(162, 59, 44, 0.06); --s-sold-b: rgba(162, 59, 44, 0.24); --s-sold-t: #8e3527;

  /* Значки «рядом» и монограммы застройщиков — монохром */
  /* все 10 --poi-* (имена из tokens.css): #4a4640 */
  --developer-mark-1: #1e1c19; --developer-mark-2: #1e1c19; --developer-mark-3: #1e1c19;
  --developer-mark-4: #1e1c19; --developer-mark-5: #1e1c19; --developer-mark-fg: #cdb08a;

  /* Поверх фото */
  --photo-bg: #12110f; --over-photo-chip: rgba(20, 18, 15, 0.62);
  --card-chip-bg: rgba(250, 248, 244, 0.94);
  --gallery-thumb-shadow: none; --gallery-thumb-shadow-on: 0 0 0 2px #faf8f4, 0 0 0 3px #1e1c19;
  --special-badge-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);

  /* Тёмные блоки */
  --home-hero-bg: #12110f; --home-hero-fg: #f1ece3; --home-hero-fg-2: #b9b1a5;
  --home-hero-amber-light: #cdb08a; --home-hero-gold: #d6bc95; --home-hero-ok: #8fc7a6;
  --home-hero-on-amber: #1e1c19; --home-hero-glow-amber: none;
  --home-hero-glass-line: rgba(241, 236, 227, 0.45);
  --hero-muted: #b9b1a5;
  --about-card-bg: #1e1c19; --inv: #1e1c19; --on-inv: #f6f2ea;
  --calc-dark-bg: #1a1916; --calc-dark-accent: #cdb08a; --calc-dark-ok: #8fc7a6; --calc-dark-bad: #e8907f;
  --home-bento-olive: linear-gradient(160deg, #2a2621, #1a1916); --home-bento-olive-kicker: #cdb08a;
  --preloader-bg: #12110f; --picker-stage-bg: #12110f;
  --footer-bg: #161512;

  /* Форма */
  --r-xs: 2px; --r-s: 4px; --r-m: 6px; --r-l: 8px; --r-xl: 10px; --r-2xl: 12px;
  --r-card: 6px; --r-button: 2px; --r-chip: 4px; --r-badge: 2px;
  --shadow-1: 0 1px 0 rgba(30, 28, 25, 0.04); --card-shadow: 0 1px 0 rgba(30, 28, 25, 0.04);
  --shadow-2: 0 1px 2px rgba(30, 28, 25, 0.04), 0 12px 32px -16px rgba(30, 28, 25, 0.14);
  --shadow-hover: 0 28px 56px -32px rgba(30, 28, 25, 0.30);
  --card-shadow-hover: 0 28px 56px -32px rgba(30, 28, 25, 0.30);
  --shadow-3: 0 40px 90px -40px rgba(20, 18, 15, 0.38);
  --control-shadow: none;

  /* Стекло: в lite и none — сплошной травертин */
  --glass-solid: #eeeae3; --glass-blur: 20px; --glass-saturate: 1.05;

  /* Шрифты и шкала */
  --mono: var(--font);                                   /* JetBrains на сайте не скачивается */
  --display: var(--font-cormorant-display), serif;
  --fs-h1: clamp(44px, 5vw, 76px); --fs-h2: clamp(32px, 3.4vw, 52px);
  --fs-card-name: 24px; --fs-card-name-phone: 22px; --fs-card-price: 22px; --fs-stat: 38px;
}

:root[data-surface="site"][data-motion="full"] {
  --glass: rgba(238, 234, 227, 0.94);
  --dur-home-marquee: 60s;
}

@media (max-width: 760px) {
  :root[data-surface="site"] { --fs-h1: 36px; --fs-h2: 28px; }
}

/* Тёмные островки: свой акцент, фокус и действие (бронза на тёмном даёт 2,6–3,4 : 1) */
:root[data-surface="site"] :is(.home-hero, .site-header--dark, .about-hero__card,
  .collections__card, .complex-picker__stage, .site-footer) {
  --accent: #cdb08a; --accent-hover: #dcc4a3; --on-accent: #1e1c19; --focus-ring: #cdb08a;
  --action-bg: #f1ece3; --action-bg-hover: #ffffff; --action-fg: #1e1c19;
  --amber-line: rgba(205, 176, 138, 0.4);
}
@media (max-width: 767px) {
  :root[data-surface="site"] .calc-total {
    --accent: #cdb08a; --on-accent: #1e1c19; --focus-ring: #cdb08a;
    --action-bg: #f1ece3; --action-bg-hover: #ffffff; --action-fg: #1e1c19;
  }
}
```

**Запасной вариант по ТЗ §2** — если заказчик против графита, добавить в базовый блок три строки. Сделать это можно в любой момент.

```css
--action-bg: var(--amber); --action-bg-hover: var(--amber-hover); --action-fg: var(--on-amber); /* 8,47:1 */
```

Свечение (`--action-glow`) остаётся `none`.

---

## B. Шрифты (`apps/site/lib/fonts.ts`)

- **Manrope, Cormorant italic, JetBrains** — оставить как есть. JetBrains на сайте не запрашивается через `--mono: var(--font)`, кабинету он остаётся.
- **Добавить один вызов:**

  ```ts
  // Прямой Cormorant — только название ЖК (карточка каталога и h1 страницы ЖК). Без предзагрузки,
  // вне первого экрана главной: LCP главной не задет. Подменный шрифт next/font держит метрики.
  const cormorantDisplay = Cormorant_Garamond({
    subsets: ["latin", "cyrillic"],
    weight: ["500"],
    style: "normal",
    variable: "--font-cormorant-display",
    display: "swap",
    preload: false,
  });

  export const fontVariables = [
    manrope.variable, cormorant.variable, cormorantDisplay.variable, jetbrainsMono.variable,
  ].join(" ");
  ```

- **CSS-переменная:** `--display` (A1 по умолчанию `var(--font)`, на сайте `var(--font-cormorant-display), serif`).
- **Проверки:**
  - знак `ʻ` (U+02BB) в «Oʻ», «gʻ»: в DevTools → Rendered Fonts должен быть Cormorant;
  - CLS каталога и ЖК < 0,05. Если ≥ 0,05 — `display: "optional"`.
- **h1 и h2 остаются на Manrope** (вариативный, уже предзагружен). Новых файлов в первом экране нет.

---

## C. Компоненты

Все правила лежат в `apps/site/styles/skin-site.css`. Порядок — по силе влияния на ощущение люкса.

### C1. Кнопки

Токены уже в A2.

```css
:root[data-surface="site"] .button { font-weight: 600; letter-spacing: 0.01em; }
:root[data-surface="site"] .button--outline { border-color: rgba(30, 28, 25, 0.28); background: transparent; }
:root[data-surface="site"] .button--outline:hover { border-color: var(--fg); }
:root[data-surface="site"][data-motion="full"] .button--primary::after { display: none; } /* блик */
/* «Hisoblash» в планировках — вторичная, а не 4 заливки в ряд */
:root[data-surface="site"] .complex-layout__calc {
  border-radius: var(--r-button); background: transparent; color: var(--fg);
  box-shadow: inset 0 0 0 1px rgba(30, 28, 25, 0.28);
}
:root[data-surface="site"] .complex-layout__calc:hover { background: var(--bg-3); }
```

### C2. Карточка каталога

Содержание не прячем: цена за м², оплата, «поделиться» и сердце остаются.

```css
:root[data-surface="site"] .catalog-card { padding: 0; }
:root[data-surface="site"] .catalog-card__media { border-radius: calc(var(--r-card) - 1px) calc(var(--r-card) - 1px) 0 0; }
:root[data-surface="site"] .catalog-card__body { padding: 18px 20px 20px; }
:root[data-surface="site"] .catalog-card__developer { font-weight: 600; letter-spacing: 0.12em; }
:root[data-surface="site"] .catalog-card__name {
  font-family: var(--display); font-weight: 500; line-height: 1.1;
  letter-spacing: -0.005em; font-variant-numeric: lining-nums;
}
:root[data-surface="site"] :is(.catalog-card__address, .catalog-card__facts, .catalog-card__type) { font-weight: 500; }
:root[data-surface="site"] .catalog-card__landmark-icon { color: var(--fg-3); }
:root[data-surface="site"] .catalog-card__amount { font-weight: 450; letter-spacing: -0.02em; }
:root[data-surface="site"] .catalog-card__monthly { color: var(--fg-2); font-weight: 550; }
:root[data-surface="site"] :is(.catalog-card__soon, .catalog-card__promo, .catalog-card__class) {
  border-radius: var(--r-xs); font-weight: 600;
}
/* Пилюли оплаты → строка текста */
:root[data-surface="site"] .catalog-card__pays .badge {
  height: auto; padding: 0; border: 0; background: none; color: var(--fg-2); font-weight: 500;
}
:root[data-surface="site"] .catalog-card__pays .badge + .badge::before { content: "·"; margin-right: 6px; color: var(--fg-3); }
```

### C3. Остатки «N ta qoldi»: точка вместо светофора

Сигнал срочности сохраняется.

```css
:root[data-surface="site"] :is(.catalog-card__type .badge, .badge.stock-badge) {
  height: auto; padding: 0; gap: 6px; border: 0; background: none; color: var(--fg-2); font-weight: 550;
}
:root[data-surface="site"] :is(.catalog-card__type .badge, .badge.stock-badge)::before {
  content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--fg-3);
}
:root[data-surface="site"] :is(.catalog-card__type, .stock-badge) .badge--ok::before,
:root[data-surface="site"] .badge--ok.stock-badge::before { background: var(--ok); }
:root[data-surface="site"] :is(.catalog-card__type, .stock-badge) .badge--amber::before,
:root[data-surface="site"] .badge--amber.stock-badge::before { background: var(--accent); }
:root[data-surface="site"] .catalog-card__type .badge--bad::before { background: var(--bad); }
```

### C4. Типографика

```css
:root[data-surface="site"] .heading--h1 { font-weight: 400; letter-spacing: -0.04em; }
:root[data-surface="site"] .heading--h2 { font-weight: 450; letter-spacing: -0.03em; }
:root[data-surface="site"] .heading--h3 { font-weight: 550; letter-spacing: -0.01em; }
:root[data-surface="site"] .heading__accent { font-size: 1.08em; }
:root[data-surface="site"] .eyebrow { font-weight: 600; letter-spacing: 0.18em; }
:root[data-surface="site"] .eyebrow::before { width: 24px; border-top: 1px solid var(--accent); transform-origin: left center; }
```

- Если h1 первого экрана на 1440 или 390 переносится на большее число строк, чем сейчас, добавить `:root[data-surface="site"] .home-hero { --fs-h1: clamp(42px, 4.7vw, 68px); }`. Раскладка первого экрана не должна меняться.
- Моноширинные подписи (крошки, лейблы, «MD», «01», даты, счётчики) переходят на Manrope через `--mono`. Цифры табличные из `base.css`.

### C5. Фильтры, сегменты, калькулятор, поля

Выбранное состояние — графитовая рамка 1+1 px на кости. Делается токенами: `--chip-on-*` и `--seg-on-*` из A3. Текст остаётся `--fg`, поэтому 13 потребителей `--chip-on-bg` не нужно править.

Поля по WCAG 1.4.11 — граница не меньше 3:1:

```css
:root[data-surface="site"] .field__input { border-color: rgba(30, 28, 25, 0.5); font-weight: 500; }
:root[data-surface="site"] .field__input:hover { border-color: var(--fg); }
```

То же правило — для `.select-field__select`, если рамка задаётся на нём.

### C6. Шапка

Стекло и свечение логотипа сделаны токенами. Плюс одно правило:

```css
:root[data-surface="site"] .header-nav__link--active::after { border-bottom: 1px solid currentColor; }
```

Счётчик избранного: на светлом — бронза с кремовым текстом, над первым экраном — шампань с графитом. Это работает через тёмный островок.

### C7. Кнопки поверх фото (сердце, «поделиться», стрелки галереи)

Светлая кость с графитовой иконкой одинаково читается в full, lite и none.

```css
:root[data-surface="site"] :is(.catalog-card__tools, .complex-gallery__tools, .complex-gallery__nav) {
  --over-photo-button: rgba(250, 248, 244, 0.9); --over-photo-button-strong: rgba(250, 248, 244, 0.94);
  --over-photo-fg: #1e1c19; --over-photo-line: rgba(30, 28, 25, 0.12); --over-photo-filter: none;
}
```

Если `FavoriteButton` или `ShareButton` на фото читают `--control-*`, а не `--over-photo-*`, задать в этом же блоке `--control-bg: rgba(250,248,244,.9); --control-border: transparent`.

### C8. Страница ЖК

```css
:root[data-surface="site"] .complex-hero__name {
  font-family: var(--display); font-weight: 500; font-size: calc(var(--fs-h1) * 1.1);
  line-height: 1; letter-spacing: -0.01em; font-variant-numeric: lining-nums;
}
:root[data-surface="site"] .complex-hero__crumbs { text-transform: none; letter-spacing: 0; font-size: 13px; font-weight: 500; }
:root[data-surface="site"] .badge { font-weight: 600; }
:root[data-surface="site"] .complex-gallery__thumb { border-radius: var(--r-xs); }
:root[data-surface="site"] .complex-offer__amount { font-weight: 400; letter-spacing: -0.03em; }
:root[data-surface="site"] .complex-offer__free { box-shadow: inset 2px 0 0 var(--ok); }
:root[data-surface="site"][data-motion="full"] .beam::before { display: none; }
```

- Липкая кнопка на телефоне графитовая через `--action-*` (A2).
- Размытые поля галереи (решение 03.11) не трогаем.

### C9. Подвал — тёмный блок

Цвета задаются токенами на самом блоке: это не тема.

```css
:root[data-surface="site"] .site-footer {
  --fg: #ede7dc; --fg-heading: #ede7dc; --fg-2: #d9d2c6; --fg-3: #a9a194;
  --line: rgba(237, 231, 220, 0.12); --line-2: rgba(237, 231, 220, 0.18);
  --line-3: rgba(237, 231, 220, 0.32); --dash: rgba(237, 231, 220, 0.14);
  --gold: #cdb08a; --amber-2: #cdb08a;
  --bg-2: rgba(237, 231, 220, 0.06); --control-bg: rgba(237, 231, 220, 0.06);
  --control-border: rgba(237, 231, 220, 0.22); --field-bg: rgba(237, 231, 220, 0.06);
  --glass-3: rgba(237, 231, 220, 0.08);
  border-top: 0; background: var(--footer-bg); color: var(--fg);
}
:root[data-surface="site"] .site-footer__pixels { max-height: 72px; width: auto; } /* янтарь бренда, без свечения */
:root[data-surface="site"] .site-footer__promise { font-weight: 400; }
```

Поле «Nusxalash» остаётся. Проверить его вид на тёмном.

### C10. Первый экран

Только токены из A3 и тёмный островок:
- фон `#12110F`, текст `#F1ECE3`;
- надзаголовок, иконки и галочки — шампань;
- курсив `#D6BC95`;
- кнопка — кость с графитом, без свечения;
- рамка кнопки квиза `.45`.

Раскладка, пелена, постер и галочки не меняются. Новый сумеречный кадр фасада Shodlik — **TODO-заказчик**.

### C11. Фактура

```css
:root[data-surface="site"][data-motion="full"] .film-grain { opacity: 0.025; }
:root[data-surface="site"][data-motion="full"] :is(.spotlight::before, .spotlight::after) { display: none; }
```

- Колонки фона не рендерятся (A0).
- Обработчик подсветки остаётся: он работает только с мышью и через rAF. Снять монтирование — позже.

### C12. Картинка для соцсетей

`apps/site/app/[locale]/opengraph-image.tsx:10`:

```ts
COLOR = { bg: "#eeeae3", fg: "#1e1c19", muted: "#625c53", amber: "#f89b0d", gold: "#7a5634" }
```

---

## D. Движение

Анимируются только `transform` и `opacity`. В режиме none анимаций нет.

**1. Линия надзаголовка прорисовывается слева направо.**

```css
@keyframes eyebrow-draw { from { transform: scaleX(0); } }
@keyframes eyebrow-fade { from { opacity: 0; } }
@supports (animation-timeline: view()) {
  :root[data-surface="site"][data-motion="full"] .eyebrow { view-timeline: --eyebrow block; }
  :root[data-surface="site"][data-motion="full"] .eyebrow::before {
    animation: eyebrow-draw linear both;
    animation-timeline: --eyebrow;
    animation-range: entry 0% cover 25%;
  }
}
:root[data-surface="site"][data-motion="lite"] .eyebrow::before {
  animation: eyebrow-fade var(--dur-fast) var(--ease) both; /* 200 мс */
}
```

**2. Наведение на карточку мягче** — вместо −4px и 1.05:

```css
:root[data-surface="site"][data-motion="full"] .catalog-card:hover { transform: translateY(-2px); }
:root[data-surface="site"][data-motion="full"] .catalog-card:hover .site-photo__image { transform: scale(1.03); }
```

В lite без изменений: подъёма и зума нет, тень появляется сразу.

**3. Что убрано или замедлено:**
- блик кнопки (C1);
- луч и подсветка (C8, C11);
- свечения через токены;
- бегущая строка — 60 с только в full. Пауза и остановка, которые уже есть, сохраняются (WCAG 2.2.2).

**Позже:**
- проявление фото (opacity и scale). Риск для LCP: нужно исключать первое фото галереи ЖК и первый ряд каталога;
- сдвиг стрелки в кнопке на 4px.

---

## E. Контраст итоговой палитры

Пересчитано скриптом `C:/Users/ALOCOM~1/AppData/Local/Temp/claude/C--Users-Alocomputers-Desktop-VH-mijoz/3ed5de8b-8182-477f-b8ad-556ddcafc12b/scratchpad/luxury/final_contrast.py`.

| Пара | Отношение |
|---|---|
| `--fg` #1E1C19 на `--bg` #EEEAE3 / на `--bg-2` #FAF8F4 | 14,18 / 16,03 |
| `--fg-heading` #161512 на `--bg` | 15,23 |
| `--fg-2` #4A4640 на `--bg` / на `--bg-4` | 7,81 / 7,00 |
| `--fg-3` #625C53 на `--bg` / `--bg-2` / `--bg-4` | 5,52 / 6,24 / 4,94 |
| Бронза #7A5634 (мелкий текст, курсив, фокус) на `--bg` / `--bg-2` / `--bg-4` | 5,46 / 6,17 / 4,89 |
| Бронза на `--amber-soft` | 4,77 |
| `--on-accent` #F6F2EA на бронзе / на hover #6A4A2C | 5,86 / 7,15 |
| Текст графитовой кнопки #F6F2EA на #1E1C19 / на hover #34312C | 15,22 / 11,60 |
| Рамка выбранного #1E1C19 на `--bg` (не текст) | 14,18 |
| Рамка поля rgba(30,28,25,.5) на `--bg-2` / на `--bg` | 3,25 / 3,15 |
| `--ok` #2E6A4C на `--bg` / на `--ok-soft` / на «свободна» | 5,34 / 4,81 / 5,47 |
| `--bad` #A23B2C на `--bg`; «продана» #8E3527 на подложке | 5,48; 6,75 |
| «Бронь» #6A4A2C на подложке | 6,55 |
| `--blue` #3E5A7A на подложке | 5,97 |
| Плейсхолдер `--fg-3` на поле | 6,24 |
| Первый экран: текст / вторичный / шампань / курсив на #12110F | 16,04 / 8,89 / 9,14 / 10,32 |
| Кнопка на тёмном: #1E1C19 на #F1ECE3 | 14,45 |
| Рамка квиза .45 на #12110F (не текст) | 4,04 |
| Фокус шампанью на #12110F | 9,14 |
| Подвал: текст / ссылки / вторичный / шампань на #161512 | 14,84 / 12,16 / 7,14 / 8,85 |
| Итог калькулятора: текст / шампань на #1A1916 | 14,94 / 8,52 |
| Плитка главной: шампань на #2A2621 | 7,28 |
| Монограмма: шампань на #1E1C19 | 8,23 |
| Значок «рядом»: белый на #4A4640 | 9,37 |
| Иконка на кнопке-кости над чёрным / над белым фото | 12,78 / 16,14 |
| Белая подпись на `--over-photo-chip` .62 над белым кадром | 5,25 |
| Янтарь логотипа на `--bg` (логотип, требование не действует) / на тёмном подвале | 1,81 / 8,42 |
| Запасной вариант: #17140F на янтаре | 8,47 |

Без тёмных островков бронзовый фокус на тёмном дал бы 2,79:1. Поэтому островки в A3 обязательны.

Пилюли-фильтры отличаются от фона рамкой 1,45:1 и заливкой 1,13:1. Это допустимо: у пилюль есть текстовая подпись.

---

## F. Что не менять

- **Тема одна, светлая.** Тёмные блоки — токены на самом блоке. Переключателя нет.
- **`--amber` и логотип.**
  - Не переопределять `--amber`.
  - Не трогать `Logo.tsx`, `icon.svg`, `SitePreloader.css`, `fill` пиксельного знака подвала.
  - Белый текст на янтаре запрещён: `--on-amber` не меняем.
- **Кабинет и `/dev`.**
  - Ни одно значение не меняется: всё под `data-surface="site"`, а A1 по умолчанию равен текущему.
  - В `tokens.css` не править существующие значения, только добавлять A1.
- **Первый экран.**
  - Раскладку, постер (LCP), h1 без анимации и фильтров, пелену и пункты не трогать.
  - На постер не ставить CSS-фильтры.
- **Галерея ЖК:** размытые поля и кадрирование (решение 03.11) не трогать.
- **Содержание.** Не прятать и не менять формат: цену за м², оплату и рассрочку, «поделиться», сердце, галочки первого экрана, ориентир, «Nusxalash», строку «HOZIR TOPILDI».
  - Формат «682,7 mln» — это деньги (`@vh/shared/format`), только после вопроса заказчику.
- **Анимации.**
  - Только `transform` и `opacity`, два варианта `[data-motion]`.
  - Не анимировать `filter`, `blur`, `box-shadow`, размеры.
  - `lib/motion` и `useReveal` не переписывать.
- **Прочее.**
  - Шахматки нет.
  - Новых стендов `/dev` нет.
  - Тостов нет.
  - Правило 1.2 без изменений.
  - Prettier — только по изменённым файлам.
- **Новые шрифты.** Только B, без предзагрузки. JetBrains в кабинете остаётся.

---

## G. Обоснование для заказчика

Направление «Архитектурный люкс»: светлый травертин, графитовый текст и бронза. Так оформляют сайты крупных девелоперов.

Бронза — это затемнённый янтарь логотипа. Связь с брендом сохраняется, а сам янтарь остаётся только в знаке Vodiy House: он выглядит как фирменная печать, а не как распродажа.

На экране одна графитовая кнопка, линии сплошные и тонкие, свечений, пунктира и пилюль-светофоров нет. Цена и рассрочка остаются на месте, но не кричат.

Название ЖК набрано классической антиквой, остальной текст — лёгким гротеском. Новых тяжёлых файлов нет, скорость сайта и доступность не падают.

Кабинет не меняется, а вернуть прежний вид можно одной строкой.

---

## H. Позже и проверки

**Позже:**
- проявление фото;
- стрелка в кнопках;
- «одна плита» шапки и меню ЖК (нужен признак, что меню прилипло);
- иконки «MD» и пустые строки «Reja / Amalda» у застройщика (TSX);
- повтор «eng foydali» и «kichikroq to'lov» в калькуляторе (TSX);
- курсив в абзаце «qisqacha» — одна вставка вместо трёх, только разметка в messages, слова не меняются;
- хардкоды цветов в `HomeWhy.css`, `ProgressPlayer.css`, `UnitVideo.css`, `ComplexSoon.css`;
- пустоты между секциями (сначала проверить появление блоков);
- страница 404;
- снять монтирование подсветки;
- перенос в `VH_mijoz`: A1 в `packages/shared/styles/tokens.css`, скин в `apps/site/styles/`, атрибут на `<html>` сайта; файлы токенов там уже расходятся, сравнить перед переносом.

**Проверки до приёмки:**
- lint, typecheck и юниты;
- e2e на 1440 по шагам, e2e кабинета на 1440 после A2;
- полный e2e 390 и 1440 обоих приложений;
- в Network на главной, в каталоге и на ЖК нет woff2 JetBrains;
- Lighthouse главной, каталога и ЖК до и после на одном benchmark ноутбука: доступность 100, CLS < 0,05, LCP ЖК не хуже 3,0 с;
- строки в `docs/design-decisions.md` (пункт 0) и одна строка в `PROGRESS.md`.

Ключевые файлы:
- `C:/Users/Alocomputers/Desktop/VH_release/packages/shared/styles/tokens.css`
- `C:/Users/Alocomputers/Desktop/VH_release/packages/shared/styles/base.css`
- `C:/Users/Alocomputers/Desktop/VH_release/apps/site/styles/skin-site.css` (новый)
- `C:/Users/Alocomputers/Desktop/VH_release/apps/site/components/RootDocument/RootDocument.tsx`
- `C:/Users/Alocomputers/Desktop/VH_release/apps/site/app/[locale]/layout.tsx`
- `C:/Users/Alocomputers/Desktop/VH_release/apps/site/app/globals.css`
- `C:/Users/Alocomputers/Desktop/VH_release/apps/site/lib/fonts.ts`
- `C:/Users/Alocomputers/Desktop/VH_release/apps/site/components/Button/Button.css`
- `C:/Users/Alocomputers/Desktop/VH_release/apps/site/components/ComplexBar/ComplexBar.css`
- `C:/Users/Alocomputers/Desktop/VH_release/apps/site/components/CatalogCard/CatalogCard.css`
- `C:/Users/Alocomputers/Desktop/VH_release/apps/site/components/CatalogCard/CatalogCard.tsx`
- `C:/Users/Alocomputers/Desktop/VH_release/apps/site/components/HomeHero/HomeHero.css`
- `C:/Users/Alocomputers/Desktop/VH_release/apps/site/components/SiteFooter/SiteFooter.css`
- `C:/Users/Alocomputers/Desktop/VH_release/apps/site/app/[locale]/opengraph-image.tsx`
- `C:/Users/ALOCOM~1/AppData/Local/Temp/claude/C--Users-Alocomputers-Desktop-VH-mijoz/3ed5de8b-8182-477f-b8ad-556ddcafc12b/scratchpad/luxury/final_contrast.py` (расчёт контраста)