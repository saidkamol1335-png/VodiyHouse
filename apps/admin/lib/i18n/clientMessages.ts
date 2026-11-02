// Какие сообщения уходят в браузер. NextIntlClientProvider кладёт переданное в HTML каждой
// страницы: без отбора /ru нёс 48 тыс. знаков текстов кабинета (HTML 97 КБ против 23 КБ у /uz,
// Lighthouse на пороге). Серверные компоненты читают сообщения сами (getTranslations) — им
// отбор не нужен.

import type { AbstractIntlMessages } from "next-intl";

/** Тексты кабинета — только в кабинете и на стендах; сайту они не нужны. */
export const CABINET_NAMESPACE = "admin";

/** Клиентские компоненты корня /admin вне кабинета: вход, смена пароля, «кабинет недоступен». */
export const ADMIN_ROOT_MESSAGES = [
  "header",
  "admin.login",
  "admin.password",
  "admin.unavailable",
] as const;

/** Разделы по путям с точкой («admin.login»): остальные ветки дерева не копируются. */
export function pickMessages(
  messages: AbstractIntlMessages,
  paths: readonly string[],
): AbstractIntlMessages {
  const picked: AbstractIntlMessages = {};
  for (const dotted of paths) {
    const keys = dotted.split(".");
    let source: string | AbstractIntlMessages | undefined = messages;
    let target = picked;
    for (const [index, key] of keys.entries()) {
      source = typeof source === "object" ? source[key] : undefined;
      if (source === undefined) throw new Error(`Нет раздела сообщений «${dotted}»`);
      if (index === keys.length - 1) target[key] = source;
      else target = (target[key] ??= {}) as AbstractIntlMessages;
    }
  }
  return picked;
}

/**
 * Тексты калькулятора (~7 тыс. знаков) — только страницам с калькулятором: свой провайдер с
 * CALC_MESSAGES (фаза 2: /kalkulyator, расчёт квартиры), а не HTML каждой страницы сайта.
 */
export const CALC_NAMESPACE = "calc";
/** Подписи кнопок заявок (шаг 3.7): «Перезвоните мне», «Получить точный расчёт»… — разделам с кнопками. */
export const LEAD_BUTTON_MESSAGES = "lead.buttons";
export const CALC_MESSAGES = [CALC_NAMESPACE, LEAD_BUTTON_MESSAGES] as const;

/**
 * Сайт (фаза 3, «сообщения по разделам»): каждой странице — только тексты оболочки (шапка, меню,
 * подвал). Тексты разделов (калькулятор, каталог, страница ЖК, формы) — своим провайдером только
 * своим страницам, как CALC_MESSAGES; заголовки и тексты серверных компонентов в браузер не идут.
 */
// siteError — экран «временно недоступна» (error.tsx страниц сайта): он рисуется без провайдера
// своей страницы, только с оболочкой.
export const SITE_SHELL_MESSAGES = ["nav", "header", "contacts", "footer", "siteError"] as const;

/**
 * Окно заявки (шаг 3.7): его тексты (~3 тыс. знаков) приходят вместе с кодом окна при первом
 * нажатии (leadMessagesAction), а не в HTML каждой страницы. Форма в разделе страницы («Хотите
 * узнать больше?» на странице ЖК) получает их провайдером своей страницы.
 */
export const LEAD_NAMESPACE = "lead";
export const LAZY_SITE_MESSAGES = [LEAD_NAMESPACE] as const;

export function siteMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  return pickMessages(messages, SITE_SHELL_MESSAGES);
}

/** Каталог (шаг 3.4): свой провайдер заменяет набор целиком — тексты оболочки внутри тоже нужны. */
export const CATALOG_NAMESPACE = "catalog";
/** Избранное и «Поделиться» (шаг 3.10): сердце и окно ссылки — на карточках и странице ЖК. */
export const SHARE_NAMESPACE = "share";
/** Подборки витрины над выдачей (3.16б): ряд карточек и плашка «Подборка применена» — в каталоге. */
export const COLLECTIONS_MESSAGES = "showcase.collections";
export const CATALOG_MESSAGES = [
  CATALOG_NAMESPACE,
  LEAD_BUTTON_MESSAGES,
  SHARE_NAMESPACE,
  COLLECTIONS_MESSAGES,
  ...SITE_SHELL_MESSAGES,
] as const;

/** «Предложения от застройщиков» на главной (3.16б): карточка рекламы и спецпредложения с кнопкой заявки. */
export const SHOWCASE_NAMESPACE = "showcase";
export const SHOWCASE_MESSAGES = [
  SHOWCASE_NAMESPACE,
  LEAD_BUTTON_MESSAGES,
  ...SITE_SHELL_MESSAGES,
] as const;

/**
 * Контакты заявки без окна (3.17): имя, телефон, ловушка, согласие, ошибки и номер заявки — то, что
 * читают ContactFields, TrapField, LeadConsent и квиз; весь `lead` (~3,7 тыс. знаков) не нужен.
 */
export const LEAD_CONTACT_MESSAGES = [
  "lead.name",
  "lead.phone",
  "lead.phonePlaceholder",
  "lead.fieldErrors",
  "lead.trap",
  "lead.consent",
  "lead.errors",
  "lead.sending",
  "lead.doneNumber",
] as const;

/** Квиз «Подбор за 1 минуту» (3.17): вопросы, живой счётчик и контакты с текстами заявки — главная и /podbor. */
export const QUIZ_NAMESPACE = "quiz";
export const QUIZ_MESSAGES = [
  QUIZ_NAMESPACE,
  ...LEAD_CONTACT_MESSAGES,
  ...SITE_SHELL_MESSAGES,
] as const;

/** «Застройщикам» (шаг 3.11): форма застройщика — тексты окна заявки (lead) в HTML страницы. */
export const PARTNERS_MESSAGES = [LEAD_NAMESPACE, ...SITE_SHELL_MESSAGES] as const;

/** «О нас», «Как купить» (шаг 3.11): кнопка заявки («Записаться на встречу», «Перезвоните мне»). */
export const ABOUT_MESSAGES = [LEAD_BUTTON_MESSAGES, ...SITE_SHELL_MESSAGES] as const;

/** /izbrannoe и /podborka (шаг 3.10): тексты избранного и карточки каталога. */
export const FAVORITES_MESSAGES = ["favorites", ...CATALOG_MESSAGES] as const;

/** Страница ЖК (шаг 3.5): свои тексты, калькулятор «Расчёт для этой квартиры» и оболочка. */
export const COMPLEX_NAMESPACE = "complex";
export const COMPLEX_MESSAGES = [
  COMPLEX_NAMESPACE,
  CALC_NAMESPACE,
  LEAD_NAMESPACE,
  SHARE_NAMESPACE,
  ...SITE_SHELL_MESSAGES,
] as const;

/**
 * Видео квартиры для клиента (фаза 5, /video/<id>): свои тексты, плеер «Хода строительства»,
 * калькулятор «Сколько платить за эту квартиру» и заявка «Записаться на просмотр».
 */
export const UNIT_VIDEO_MESSAGES = ["unitVideo", "complex.progress", CALC_NAMESPACE, LEAD_NAMESPACE, ...SITE_SHELL_MESSAGES] as const;

/** Застройщики (шаг 3.15): список — поиск на месте; страница — вкладки объектов и карточки каталога. */
export const DEVELOPERS_NAMESPACE = "developers";
export const DEVELOPERS_LIST_MESSAGES = [DEVELOPERS_NAMESPACE, ...SITE_SHELL_MESSAGES] as const;
export const DEVELOPERS_MESSAGES = [DEVELOPERS_NAMESPACE, ...CATALOG_MESSAGES] as const;
