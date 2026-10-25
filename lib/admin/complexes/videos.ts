import { readText } from "../credentials";
import { bilingualFrom, bilingualIssue, bilingualOrNull, readBilingual, type BilingualIssue, type BilingualValue } from "../bilingual";
import { bilingualHasContact } from "../contactGuard";

// Вкладка «Видео» (ТЗ 7.5, Ф4): ролики YouTube по порядку, первое — крупно. Ссылку вставляют как
// есть — в базе только id ролика (11 знаков): плеер сайт собирает сам, по клику (youtube-nocookie).
// Пределы — как check и save_complex_videos в миграции 20261025180000.

export const VIDEO_LIMITS = { maxRows: 6, titleMax: 80 } as const;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);
// Пути с id ролика: /shorts/<id>, /embed/<id>, /live/<id>, /v/<id>.
const ID_PATHS = new Set(["shorts", "embed", "live", "v"]);

/** «https://youtu.be/<id>?t=5», «youtube.com/watch?v=<id>», «/shorts/<id>», сам id → id; иначе null. */
export function youtubeIdFrom(raw: string): string | null {
  const text = raw.trim();
  if (YOUTUBE_ID.test(text)) return text;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const [first, second] = url.pathname.split("/").filter(Boolean);
  let id: string | null | undefined = null;
  if (host === "youtu.be") id = first;
  else if (YOUTUBE_HOSTS.has(host)) id = first === "watch" ? url.searchParams.get("v") : first && ID_PATHS.has(first) ? second : null;
  return id && YOUTUBE_ID.test(id) ? id : null;
}

export type VideoDraft = { key: string; link: string; title: BilingualValue };
export type VideoIssue = "youtube" | "duplicate" | "contacts" | BilingualIssue;
/** Ошибки по строке (key): ссылка и подпись. */
export type VideoErrors = Record<string, Partial<Record<"link" | "title", VideoIssue>>>;
export type VideoPayload = { youtube_id: string; title: BilingualValue | null };

export type VideosParse =
  | { ok: true; payload: VideoPayload[] }
  | { ok: false; error: "tooMany" | "rule12" }
  | { ok: false; error: null; errors: VideoErrors };

export const videoField = (key: string, part: "link" | "title") => `video-${key}-${part}`;

export function newVideoDraft(): VideoDraft {
  return { key: crypto.randomUUID(), link: "", title: { ru: "", uz: "" } };
}

export type VideoRecord = { youtube_id: string; title: unknown };

/** Сохранённые видео → строки вкладки: ссылка — короткая youtu.be, её можно открыть и проверить. */
export function videoDrafts(records: readonly VideoRecord[]): VideoDraft[] {
  return records.map((record) => ({
    key: record.youtube_id,
    link: `https://youtu.be/${record.youtube_id}`,
    title: bilingualFrom(record.title),
  }));
}

/** Строка без ссылки и подписи — пустая, её не шлём (как незаполненная строка «Добавить»). */
const isBlank = (row: VideoDraft) => !row.link.trim() && !row.title.ru && !row.title.uz;

function videoErrors(row: VideoDraft, id: string | null, seen: Set<string>) {
  const errors: Partial<Record<"link" | "title", VideoIssue>> = {};
  if (!id) errors.link = "youtube";
  else if (seen.has(id)) errors.link = "duplicate";
  const title = bilingualIssue(row.title, { max: VIDEO_LIMITS.titleMax });
  if (title) errors.title = title;
  else if (bilingualHasContact(row.title)) errors.title = "contacts";
  return errors;
}

/** Поля: videoKey (по строке, в порядке на сайте), video-<key>-link, video-<key>-title.ru|uz. */
export function parseVideos(formData: FormData): VideosParse {
  const rows = formData.getAll("videoKey").map((key) => String(key)).map((key) => ({
    key,
    link: (readText(formData, videoField(key, "link")) ?? "").trim(),
    title: readBilingual(formData, videoField(key, "title")),
  }));
  const filled = rows.filter((row) => !isBlank(row));
  if (filled.length > VIDEO_LIMITS.maxRows) return { ok: false, error: "tooMany" };
  const errors: VideoErrors = {};
  const seen = new Set<string>();
  const payload: VideoPayload[] = [];
  for (const row of filled) {
    const id = youtubeIdFrom(row.link);
    const rowErrors = videoErrors(row, id, seen);
    if (id) seen.add(id);
    if (Object.keys(rowErrors).length > 0) errors[row.key] = rowErrors;
    else payload.push({ youtube_id: id!, title: bilingualOrNull(row.title) });
  }
  if (Object.keys(errors).length > 0) return { ok: false, error: null, errors };
  // Правило 1.2: плеер показывает канал ролика, превью и концовку — руководитель отмечает, что
  // контактов застройщика там нет, при каждом сохранении списка с роликами (как у загрузки фото).
  if (payload.length > 0 && readText(formData, "rule12") !== "on") return { ok: false, error: "rule12" };
  return { ok: true, payload };
}
