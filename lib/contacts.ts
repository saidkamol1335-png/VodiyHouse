// Контакты Vodiy House — единственные контакты в публичной части (правило ТЗ 1.2).
// Телефон и Telegram — TODO-заказчик (PLAN §9.8): пока null, и кнопки с ними не показываются.
// Адрес офиса известен (docs/vodiy-house-mockup.md) и живёт в messages: contacts.office.

/** Общий номер Vodiy House в формате +998XXXXXXXXX. */
export const VODIY_HOUSE_PHONE: string | null = null;

/** Telegram-бот или аккаунт Vodiy House, без «@». */
export const VODIY_HOUSE_TELEGRAM: string | null = null;

export function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function telegramHref(username: string): string {
  return `https://t.me/${username}`;
}
