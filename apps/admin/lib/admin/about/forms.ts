import type { AboutEvent, TeamMember, TeamPhoto } from "@vh/shared/about";
import { bilingualFrom, bilingualIssue, readBilingual, type BilingualIssue, type BilingualValue } from "../bilingual";
import { bilingualHasContact } from "../contactGuard";
import { readText } from "../credentials";
import type { SaveContentResult } from "../complexes/types";

// «Настройки → О компании» (правки 15.11, п. 25): «История» по годам и «Команда». Пределы — как
// private.valid_about_history / valid_about_team в миграции 20261117120000 (тест сверяет).

export const HISTORY_LIMITS = { maxRows: 20, titleMax: 120, textMax: 600, yearMin: 1990, yearMax: 2100 } as const;
export const TEAM_LIMITS = { maxRows: 24, nameMin: 2, nameMax: 60, positionMax: 80 } as const;

export type AboutIssue = BilingualIssue | "contacts" | "year" | "name" | "consent";
export type AboutErrors = Record<string, Partial<Record<"year" | "title" | "text" | "name" | "position" | "consent", AboutIssue>>>;
export type AboutResult = SaveContentResult<AboutErrors>;

export type HistoryDraft = { key: string; year: string; title: BilingualValue; text: BilingualValue };
export type TeamDraft = { key: string; id: string; name: string; position: BilingualValue; photo: TeamPhoto | null; consentAt: string | null };

export type AboutParse<P> = { ok: true; payload: P[] } | { ok: false; error: "tooMany" } | { ok: false; error: null; errors: AboutErrors };

export const aboutField = (key: string, part: string) => `about-${key}-${part}`;

const EMPTY = { ru: "", uz: "" };

export function newHistoryDraft(): HistoryDraft {
  return { key: crypto.randomUUID(), year: "", title: EMPTY, text: EMPTY };
}

export function newTeamDraft(): TeamDraft {
  const id = crypto.randomUUID();
  return { key: id, id, name: "", position: EMPTY, photo: null, consentAt: null };
}

export function historyDrafts(events: readonly AboutEvent[]): HistoryDraft[] {
  return events.map((event, index) => ({
    key: `saved-${index}`,
    year: String(event.year),
    title: bilingualFrom(event.title),
    text: bilingualFrom(event.text ?? EMPTY),
  }));
}

export function teamDrafts(members: readonly TeamMember[]): TeamDraft[] {
  return members.map((member) => ({ key: member.id, id: member.id, name: member.name, position: bilingualFrom(member.position), photo: member.photo, consentAt: member.consentAt }));
}

function textIssue(value: BilingualValue, max: number, required: boolean): AboutIssue | undefined {
  const issue = bilingualIssue(value, { max, required });
  if (issue) return issue;
  return bilingualHasContact(value) ? "contacts" : undefined;
}

type HistoryPayload = { year: number; title: BilingualValue; text: BilingualValue | null };

/** Поля: historyKey (по строке), about-<key>-year, about-<key>-title.ru|uz, about-<key>-text.ru|uz. */
export function parseHistory(formData: FormData): AboutParse<HistoryPayload> {
  const rows = formData.getAll("historyKey").map(String).map((key) => ({
    key,
    year: (readText(formData, aboutField(key, "year")) ?? "").trim(),
    title: readBilingual(formData, aboutField(key, "title")),
    text: readBilingual(formData, aboutField(key, "text")),
  }));
  const filled = rows.filter((row) => row.year || row.title.ru || row.title.uz || row.text.ru || row.text.uz);
  if (filled.length > HISTORY_LIMITS.maxRows) return { ok: false, error: "tooMany" };
  const errors: AboutErrors = {};
  const payload: HistoryPayload[] = [];
  for (const row of filled) {
    const year = Number(row.year);
    const yearIssue = Number.isInteger(year) && year >= HISTORY_LIMITS.yearMin && year <= HISTORY_LIMITS.yearMax ? undefined : "year";
    const title = textIssue(row.title, HISTORY_LIMITS.titleMax, true);
    const hasText = Boolean(row.text.ru || row.text.uz);
    const text = hasText ? textIssue(row.text, HISTORY_LIMITS.textMax, true) : undefined;
    if (yearIssue || title || text) errors[row.key] = { ...(yearIssue ? { year: yearIssue } : {}), ...(title ? { title } : {}), ...(text ? { text } : {}) };
    else payload.push({ year, title: row.title, text: hasText ? row.text : null });
  }
  if (Object.keys(errors).length > 0) return { ok: false, error: null, errors };
  return { ok: true, payload: payload.sort((a, b) => a.year - b.year) };
}

type TeamPayload = { id: string; name: string; position: BilingualValue; photo: TeamPhoto | null; consent_at: string };

function photoFrom(raw: string | null): TeamPhoto | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<TeamPhoto>;
    return typeof value.path === "string" && typeof value.width === "number" && typeof value.height === "number"
      ? { path: value.path, width: value.width, height: value.height, blur: typeof value.blur === "string" ? value.blur : null }
      : null;
  } catch {
    return null;
  }
}

/**
 * Поля: teamKey (по строке), about-<key>-id, -name, -position.ru|uz, -photo (JSON фото или пусто),
 * -consent («on» — согласие получено), -consentAt (дата прежней отметки). Без согласия — не сохраняем.
 */
export function parseTeam(formData: FormData, now: Date = new Date()): AboutParse<TeamPayload> {
  const rows = formData.getAll("teamKey").map(String).map((key) => ({
    key,
    id: readText(formData, aboutField(key, "id")) ?? "",
    name: (readText(formData, aboutField(key, "name")) ?? "").trim(),
    position: readBilingual(formData, aboutField(key, "position")),
    photo: photoFrom(readText(formData, aboutField(key, "photo"))),
    consent: readText(formData, aboutField(key, "consent")) === "on",
    consentAt: readText(formData, aboutField(key, "consentAt")),
  }));
  const filled = rows.filter((row) => row.name || row.position.ru || row.position.uz || row.photo);
  if (filled.length > TEAM_LIMITS.maxRows) return { ok: false, error: "tooMany" };
  const errors: AboutErrors = {};
  const payload: TeamPayload[] = [];
  for (const row of filled) {
    const name = row.name.length >= TEAM_LIMITS.nameMin && row.name.length <= TEAM_LIMITS.nameMax ? undefined : "name";
    const position = textIssue(row.position, TEAM_LIMITS.positionMax, true);
    const consent = row.consent ? undefined : "consent";
    if (name || position || consent || !/^[0-9a-f-]{36}$/.test(row.id)) {
      errors[row.key] = { ...(name ? { name } : {}), ...(position ? { position } : {}), ...(consent ? { consent } : {}) };
    } else {
      payload.push({ id: row.id, name: row.name, position: row.position, photo: row.photo, consent_at: row.consentAt || now.toISOString() });
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, error: null, errors };
  return { ok: true, payload };
}
