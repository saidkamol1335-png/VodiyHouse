// Контакты Vodiy House — единственные контакты в публичной части (правило ТЗ 1.2).
// Вводит руководитель в «Настройки → Контакты» (Ф9): публичная запись settings `site.contacts`.
// Пусто — кнопки и строки с этим контактом не показываются (TODO-заказчик, PLAN §9.8, §9.17).
// Адрес офиса известен (docs/vodiy-house-mockup.md) и живёт в messages: contacts.office.

export const SITE_CONTACTS_KEY = "site.contacts";

export type LocalizedText = { ru: string; uz: string };

export type SiteContacts = {
  /** Общий номер в формате +998XXXXXXXXX. */
  phone: string | null;
  /** Telegram-аккаунт Vodiy House, без «@». */
  telegram: string | null;
  /** Бот «Написать в Telegram» (Ф8), без «@». */
  bot: string | null;
  instagram: string | null;
  hours: LocalizedText | null;
  /** «Перезвоним за N минут». */
  callbackMinutes: number | null;
  /** Плашка «Для вас бесплатно» (текст — TODO-заказчик). */
  freeBadge: LocalizedText | null;
  /**
   * Пункты плашки на странице ЖК (ТЗ 7.1): что Vodiy House делает для покупателя бесплатно — 2–4
   * пункта, один набор на все ЖК; утверждает заказчик. Пусто — плашки нет.
   */
  freeServices: LocalizedText[];
};

export const NO_CONTACTS: SiteContacts = {
  phone: null,
  telegram: null,
  bot: null,
  instagram: null,
  hours: null,
  callbackMinutes: null,
  freeBadge: null,
  freeServices: [],
};

/** До четырёх пунктов плашки «Для вас бесплатно» — в одну строку карточки цены (мокап .free). */
export const FREE_SERVICES_MAX = 4;

export const PHONE_PATTERN = /^\+998\d{9}$/;
// Правила имён Telegram: 5–32 знака, латиница, цифры и «_», с буквы; бот кончается на «bot».
export const TELEGRAM_PATTERN = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
export const BOT_PATTERN = /^[A-Za-z][A-Za-z0-9_]{1,28}bot$/i;
export const INSTAGRAM_PATTERN = /^(?!\.)(?!.*\.\.)[A-Za-z0-9._]{1,30}(?<!\.)$/;
export const CALLBACK_MINUTES = { min: 1, max: 240 } as const;

const matching = (value: unknown, pattern: RegExp): string | null =>
  typeof value === "string" && pattern.test(value) ? value : null;

function localizedFrom(raw: unknown): LocalizedText | null {
  if (!raw || typeof raw !== "object") return null;
  const { ru, uz } = raw as Partial<LocalizedText>;
  return typeof ru === "string" && typeof uz === "string" && ru && uz ? { ru, uz } : null;
}

function minutesFrom(raw: unknown): number | null {
  return typeof raw === "number" &&
    Number.isInteger(raw) &&
    raw >= CALLBACK_MINUTES.min &&
    raw <= CALLBACK_MINUTES.max
    ? raw
    : null;
}

/** Значение из базы (jsonb) → контакты; неверное поле — как пустое: сайт не покажет кривой номер. */
export function contactsFrom(raw: unknown): SiteContacts {
  if (!raw || typeof raw !== "object") return NO_CONTACTS;
  const value = raw as Record<string, unknown>;
  return {
    phone: matching(value.phone, PHONE_PATTERN),
    telegram: matching(value.telegram, TELEGRAM_PATTERN),
    bot: matching(value.bot, BOT_PATTERN),
    instagram: matching(value.instagram, INSTAGRAM_PATTERN),
    hours: localizedFrom(value.hours),
    callbackMinutes: minutesFrom(value.callbackMinutes),
    freeBadge: localizedFrom(value.freeBadge),
    freeServices: Array.isArray(value.freeServices)
      ? value.freeServices.flatMap((item) => localizedFrom(item) ?? []).slice(0, FREE_SERVICES_MAX)
      : [],
  };
}

/** +998901234567 → «+998 90 123 45 67». */
export function formatPhone(phone: string): string {
  const match = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  return match ? `+998 ${match.slice(1).join(" ")}` : phone;
}

export function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function telegramHref(username: string): string {
  return `https://t.me/${username}`;
}

export function instagramHref(username: string): string {
  return `https://www.instagram.com/${username}/`;
}
