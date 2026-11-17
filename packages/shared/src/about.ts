// «Biz haqimizda» (правки 15.11, п. 25): «Tarix» и «Jamoa» — публичные записи settings. Формат
// проверяет база (20261117120000_about_page.sql); здесь — разбор для сайта и кабинета.

export const ABOUT_HISTORY_KEY = "site.about_history";
export const ABOUT_TEAM_KEY = "site.about_team";

export type AboutText = { ru: string; uz: string };

export type AboutEvent = { year: number; title: AboutText; text: AboutText | null };

export type TeamPhoto = { path: string; width: number; height: number; blur: string | null };

export type TeamMember = { id: string; name: string; position: AboutText; photo: TeamPhoto | null; consentAt: string };

function textFrom(value: unknown): AboutText | null {
  if (!value || typeof value !== "object") return null;
  const { ru, uz } = value as { ru?: unknown; uz?: unknown };
  if (typeof ru !== "string" || typeof uz !== "string") return null;
  const text = { ru: ru.trim(), uz: uz.trim() };
  return text.ru && text.uz ? text : null;
}

/** История → события по году (раньше — выше); неполное — не на сайт. */
export function aboutHistoryFrom(value: unknown): AboutEvent[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item: { year?: unknown; title?: unknown; text?: unknown } | null) => {
      const title = textFrom(item?.title);
      const year = item?.year;
      return typeof year === "number" && Number.isInteger(year) && title ? [{ year, title, text: textFrom(item?.text) }] : [];
    })
    .sort((a, b) => a.year - b.year);
}

function photoFrom(value: unknown): TeamPhoto | null {
  if (!value || typeof value !== "object") return null;
  const { path, width, height, blur } = value as Record<string, unknown>;
  if (typeof path !== "string" || typeof width !== "number" || typeof height !== "number") return null;
  return { path, width, height, blur: typeof blur === "string" ? blur : null };
}

/** Команда → сотрудники в порядке руководителя; без отметки согласия — не на сайт. */
export function aboutTeamFrom(value: unknown): TeamMember[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: Record<string, unknown> | null) => {
    const position = textFrom(item?.position);
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    const consentAt = typeof item?.consent_at === "string" ? item.consent_at : "";
    const id = typeof item?.id === "string" ? item.id : "";
    return id && name && position && consentAt ? [{ id, name, position, photo: photoFrom(item?.photo), consentAt }] : [];
  });
}
