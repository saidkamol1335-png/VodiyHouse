import { type Currency, roundMoney } from "@/lib/calc/money";
import type { Locale } from "@/lib/i18n/routing";

// Форматирование для интерфейса. Даты — по времени Ташкента (PLAN §4: lib/format.ts), деньги —
// шагом вывода lib/calc. Телефоны появятся здесь вместе с формами (фаза 3).

export const APP_TIME_ZONE = "Asia/Tashkent";

/** «Понедельник, 19.10.2026» — подпись под заголовком Главной кабинета (мокап). */
export function formatWeekdayDate(date: Date, timeZone: string = APP_TIME_ZONE): string {
  const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "long", timeZone }).format(date);
  const day = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  }).format(date);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${day}`;
}

/** «20.10.2026» — дата в списках кабинета. */
export function formatDate(date: Date, timeZone: string = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  }).format(date);
}

/** «20.10.2026 14:05» — дата и время (последний вход сотрудника). */
export function formatDateTime(date: Date, timeZone: string = APP_TIME_ZONE): string {
  const time = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
  return `${formatDate(date, timeZone)} ${time}`;
}

/** Когда поменяли — по-человечески, как в мокапе (fRel): тексты в messages, здесь только вид. */
export type RelativeStamp =
  | { kind: "now" }
  | { kind: "minutes"; minutes: number }
  | { kind: "today" | "yesterday"; time: string }
  | { kind: "date"; date: string; time: string };

const DAY_MS = 86_400_000;

// «Обновлено …» считается у сотен строк на каждый тик часов: форматтеры Intl создаются один раз
// на часовой пояс, а не на строку (создание — самое дорогое).
const stampFormats = new Map<
  string,
  Record<"day" | "time" | "dayMonth" | "full", Intl.DateTimeFormat>
>();

function formatsIn(timeZone: string) {
  let formats = stampFormats.get(timeZone);
  if (!formats) {
    formats = {
      day: new Intl.DateTimeFormat("en-CA", { timeZone }),
      time: new Intl.DateTimeFormat("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone,
      }),
      dayMonth: new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", timeZone }),
      full: new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone,
      }),
    };
    stampFormats.set(timeZone, formats);
  }
  return formats;
}

/**
 * «только что» (до 45 с — и время из будущего: часы сервера и телефона расходятся), «N мин назад»,
 * «сегодня в 09:41», «вчера в 18:05», иначе «21.10 в 09:41» (другой год — «21.10.2025»).
 * Неверная дата — null: строку списка без времени показать можно, а исключение уронило бы весь.
 */
export function relativeStamp(
  at: Date,
  now: Date,
  timeZone: string = APP_TIME_ZONE,
): RelativeStamp | null {
  if (!Number.isFinite(at.getTime()) || !Number.isFinite(now.getTime())) return null;
  const seconds = Math.round((now.getTime() - at.getTime()) / 1000);
  if (seconds < 45) return { kind: "now" };
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return { kind: "minutes", minutes };
  const formats = formatsIn(timeZone);
  const time = formats.time.format(at);
  const day = formats.day.format(at);
  const today = formats.day.format(now);
  if (day === today) return { kind: "today", time };
  if (day === formats.day.format(new Date(now.getTime() - DAY_MS)))
    return { kind: "yesterday", time };
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  const date = (sameYear ? formats.dayMonth : formats.full).format(at);
  return { kind: "date", date, time };
}

/** Час суток 0–23 в часовом поясе. */
export function hourIn(date: Date, timeZone: string = APP_TIME_ZONE): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
  return Number(hour);
}

const KILOBYTE = 1024;
const MEGABYTE = 1024 * 1024;

/** Вес файла для кабинета: «512 КБ», «2,4 МБ» (одна цифра после запятой — до 10 МБ). */
export function formatFileSize(bytes: number): string {
  if (bytes < MEGABYTE) return `${Math.max(1, Math.round(bytes / KILOBYTE))} КБ`;
  const megabytes = bytes / MEGABYTE;
  const digits = megabytes < 10 ? 1 : 0;
  const value = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(megabytes);
  return `${value} МБ`;
}

/** Инициалы для аватара: «Дилноза Юсупова» → «ДЮ», одно слово — одна буква. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

const GROUPED = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
/** Число как есть: разряды, до двух знаков после запятой — площадь, набранная сумма, процент. */
const DECIMAL = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

/** Название сума на языке страницы: кабинет — по-русски, сайт — «so‘m» на /uz. */
const SUM_WORD: Readonly<Record<Locale, string>> = { ru: "сум", uz: "so‘m" };

/**
 * Цена для кабинета и сайта (ТЗ 1.5, предложение): USD — до доллара, «$31 000»; сум — до тысячи,
 * «354 000 000 сум». Хранится цена без округления — округляет только вывод (PLAN §0.10).
 */
export function formatPrice(amount: number, currency: Currency, locale: Locale = "ru"): string {
  const rounded = GROUPED.format(roundMoney(amount, currency));
  return currency === "USD" ? `$${rounded}` : `${rounded} ${SUM_WORD[locale]}`;
}

const SHORT_SCALES = [
  { from: 1_000_000_000, ru: "млрд", uz: "mlrd" },
  { from: 1_000_000, ru: "млн", uz: "mln" },
] as const;
const ONE_DECIMAL = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

/** Коротко для тесных мест (липкая панель телефона, мокап MobFlatBank): «22,5 млн сум». */
export function formatPriceShort(
  amount: number,
  currency: Currency,
  locale: Locale = "ru",
): string {
  const index = SHORT_SCALES.findIndex((item) => Math.abs(amount) >= item.from);
  if (currency === "USD" || index < 0) return formatPrice(amount, currency, locale);
  // 999,96 млн с одним знаком — «1 000 млн»: такое пишем следующей шкалой, «1 млрд».
  const roundsUp =
    index > 0 && Math.round((Math.abs(amount) / SHORT_SCALES[index]!.from) * 10) >= 10_000;
  const scale = SHORT_SCALES[roundsUp ? index - 1 : index]!;
  return `${ONE_DECIMAL.format(amount / scale.from)} ${scale[locale]} ${SUM_WORD[locale]}`;
}

const RATE = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Курс как у ЦБ: «11 808,76». */
export function formatRate(usdUzs: number): string {
  return RATE.format(usdUzs);
}

/** «20%», «17,5%» — взнос, ставка, скидка (без пробела, как в мокапе). */
export function formatPercent(value: number): string {
  return `${DECIMAL.format(value)}%`;
}

/** Срок для подписи: от 5 лет ровными годами — «15 лет», иначе — «24 мес.» (мокап). */
export function termParts(months: number): { unit: "months" | "years"; count: number } {
  if (months >= 60 && months % 12 === 0) return { unit: "years", count: months / 12 };
  return { unit: "months", count: months };
}

/** Свой срок рассрочки — целое число месяцев (PLAN §3.14). */
export const CUSTOM_MONTHS_MAX = 600;

/** Свой срок, набранный руками: только цифры, 1–600. */
export function parseMonthsInput(raw: string): number | null {
  const digits = raw.trim();
  if (!/^\d{1,3}$/.test(digits)) return null;
  const months = Number(digits);
  return months >= 1 && months <= CUSTOM_MONTHS_MAX ? months : null;
}

/** Сумма, как её набрали, — с разрядами и без округления до тысячи сумов: «8 320 500». */
export function formatAmount(amount: number): string {
  return DECIMAL.format(amount);
}

/** «42,5 м²» — площадь планировки (как подпись базы в журнале). */
export function formatArea(area: number): string {
  return `${DECIMAL.format(area)} м²`;
}

/** «$620/м²», «4 100 000 сум/м²» — цена за м² квартиры (Н3). */
export function formatPricePerM2(amount: number, currency: Currency): string {
  return `${formatPrice(amount, currency)}/м²`;
}

/** Предел цены — numeric(14,2) в базе. */
export const PRICE_MAX = 999_999_999_999;

/** Предел цены за м²: площадь (до 999,99 м²) × цена м² должна влезать в «цену от» планировки. */
export const PRICE_PER_M2_MAX = 999_999_999;

export type PriceInput = { value: number | null; issue?: "notNumber" | "outOfRange" };

/**
 * Цена, набранная руками: целое, группы — пробелами («31 000»). Запятую и точку не угадываем:
 * «31,000» с клавиатуры ПК — это 31 000, а Number() дал бы 31, поэтому такой ввод — ошибка.
 */
export function parsePriceInput(raw: string, max: number = PRICE_MAX): PriceInput {
  const digits = raw.replace(/\s+/g, "");
  if (!digits) return { value: null };
  if (!/^\d+$/.test(digits)) return { value: null, issue: "notNumber" };
  const value = Number(digits);
  return value <= 0 || value > max ? { value: null, issue: "outOfRange" } : { value };
}

/** Вычитаемая сумма: знак минус U+2212 (как «−$3 473» в мокапе r1), а не дефис. */
export function formatMinus(formatted: string): string {
  return `−${formatted}`;
}

/**
 * Телефон Узбекистана: +998 и 9 цифр (пробелы, скобки, дефисы — как набрали; 9 цифр — без кода
 * страны). Неверный — null. Формы заявок фазы 3 берут его же.
 */
export function phoneDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const full = digits.length === 9 ? `998${digits}` : digits;
  return /^998\d{9}$/.test(full) ? full : null;
}

/** «+998901234567» — для заявки и сообщения менеджеру; неверный номер — null. */
export function formatPhone(raw: string): string | null {
  const digits = phoneDigits(raw);
  return digits ? `+${digits}` : null;
}
