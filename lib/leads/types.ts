// Заявки (шаг 3.7, ТЗ 10.1): типы, поля по типу и что форма отправляет серверу. Без импортов SDK —
// модуль подключают и формы сайта, и сервер, и кабинет.

/** Типы заявки — enum lead_type базы (миграция 20261026090000_leads.sql). */
export const LEAD_TYPES = [
  "callback",
  "view",
  "complex",
  "layout",
  "documents",
  "pick",
  "partner",
  "calc",
  "tg",
  "consult",
  "quiz",
  "promo",
] as const;

export type LeadType = (typeof LEAD_TYPES)[number];

/** Статусы ведения — enum lead_status (мокап CabLeads). */
export const LEAD_STATUSES = ["new", "work", "called", "meeting", "deal", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_CHANNELS = ["telegram", "sheet"] as const;
export type LeadChannel = (typeof LEAD_CHANNELS)[number];

export type DeliveryState = "pending" | "sent" | "failed";

/** «Записаться на просмотр» (ТЗ 10.1): что посмотреть, удобный день и время (время — по желанию). */
export const VIEW_TARGETS = ["complex", "delivered", "office"] as const;
export const VIEW_DAYS = ["today", "tomorrow", "weekend"] as const;
export const VIEW_TIMES = ["morning", "afternoon", "evening"] as const;

export type ViewTarget = (typeof VIEW_TARGETS)[number];
export type ViewDay = (typeof VIEW_DAYS)[number];
export type ViewTime = (typeof VIEW_TIMES)[number];

export type ViewChoice = { target: ViewTarget; day: ViewDay; time: ViewTime | null };

export type SiteLang = "ru" | "uz";

/** О чём заявка: база сама найдёт ЖК по адресу и проверит, что планировка из него (lead_subject). */
export type LeadObject = { complex?: string; layout?: string; unit?: string; developer?: string };

/** Снимок расчёта (Р4): программа, входные данные и итог; условия и курс база берёт сама. */
export type LeadCalc = { program: string; input: Record<string, unknown>; result: Record<string, unknown> };

/** Источник первого захода (ТЗ 10.3): метки рекламы, клики Meta и Google, откуда пришли. */
export const SOURCE_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "referrer",
  "landing",
] as const;

export type SourceKey = (typeof SOURCE_KEYS)[number];
export type LeadSource = Partial<Record<SourceKey, string>>;

/** Что форма отправляет серверу. Контекст («ЖК Shodlik · 2-комн.») сервер не принимает — он из базы. */
export type LeadRequest = {
  type: LeadType;
  name: string;
  phone: string;
  contactLang: SiteLang | null;
  siteLang: SiteLang;
  object: LeadObject;
  pageUrl: string;
  source: LeadSource;
  view?: ViewChoice;
  /** Подбор: фильтры каталога текстом и ссылкой (ТЗ 10.1 «+ фильтры автоматически»). */
  filters?: { text: string; link: string };
  /** Застройщикам (3.11): компания, город, формат, сколько проектов, комментарий. */
  partner?: { company: string; city: string; format: string; projects: string; comment: string };
  /** Строки расчёта для менеджера: «Программа: …», «Платёж: …» — как в окне «Точный расчёт». */
  calcRows?: { label: string; value: string }[];
  calc?: LeadCalc;
  /** «Хочу это условие» (3.16б): какое спецпредложение или реклама — названием для менеджера. */
  promo?: { title: string };
  /** Квиз «Подбор за 1 минуту» (3.17): ответы словами, сколько подошло и ссылка на подходящие ЖК. */
  quiz?: { answers: string; link: string; complexes: number; flats: number; partial: boolean };
  /** Скрытое поле-ловушка (ТЗ 10.2): человек его не видит и не заполняет. */
  trap?: string;
};

export type LeadSubmitResult =
  | { status: "sent"; number: number; repeat: boolean; id?: string }
  | { status: "error"; error: LeadErrorCode; fields?: LeadFieldErrors };

export type LeadField = "name" | "phone" | "company";
export type LeadFieldErrors = Partial<Record<LeadField, "required" | "phone">>;

export const LEAD_ERRORS = ["invalid", "rateLimited", "unavailable", "network", "unknown"] as const;
export type LeadErrorCode = (typeof LEAD_ERRORS)[number];
