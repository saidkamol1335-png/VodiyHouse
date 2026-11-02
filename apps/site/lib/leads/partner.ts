// «Застройщикам» (шаг 3.11): форматы сотрудничества мокапа SitePartners и якорь формы. Модуль без
// "use client" — его читают и серверные разделы страницы, и форма.

export const PARTNER_FORMATS = ["sales", "ads", "listing"] as const;
export type PartnerFormat = (typeof PARTNER_FORMATS)[number];

/** Якорь формы; «Выбрать» у формата — #zayavka-<формат>: форма берёт формат и прокручивается. */
export const PARTNER_ANCHOR = "zayavka";
