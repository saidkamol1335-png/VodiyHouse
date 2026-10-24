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
export const CALC_MESSAGES = [CALC_NAMESPACE] as const;

/** Сайт: все разделы, кроме текстов кабинета и калькулятора. */
export function siteMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  const paths = Object.keys(messages).filter(
    (key) => key !== CABINET_NAMESPACE && key !== CALC_NAMESPACE,
  );
  return pickMessages(messages, paths);
}
