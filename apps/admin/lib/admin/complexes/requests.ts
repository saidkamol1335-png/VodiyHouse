import type { PublicationStatus } from "../publication";

// «Запросить у руководителя» (PLAN §10, пп. 6, 25): менеджер просит опубликовать, вернуть на сайт,
// скрыть или убрать в архив; руководитель делает это сам (запрос закрывается «выполнен») или
// отклоняет с причиной. Открытый запрос на ЖК один — таблица publication_requests (фаза B).

export const REQUEST_KINDS = ["publish", "unhide", "hide", "archive"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
export type RequestStatus = "pending" | "done" | "declined" | "cancelled";

export const REQUEST_NOTE_MAX = 300;

export type PublicationRequest = {
  id: string;
  complexId: string;
  kind: RequestKind;
  status: RequestStatus;
  note: string | null;
  answer: string | null;
  requestedAt: string;
  resolvedAt: string | null;
  requestedBy: string | null;
  /** Имя автора — из профилей команды; null — сотрудника удалили. */
  requesterName: string | null;
};

export const isRequestKind = (value: unknown): value is RequestKind =>
  typeof value === "string" && (REQUEST_KINDS as readonly string[]).includes(value);

/** Какие запросы подходят к состоянию ЖК — как проверка request_publication в базе. */
export function requestKindsFor(status: PublicationStatus): RequestKind[] {
  switch (status) {
    case "draft":
      return ["publish", "archive"];
    case "hidden":
      return ["unhide", "archive"];
    case "published":
      return ["hide", "archive"];
    case "archived":
      return [];
  }
}

export type RequestRecord = {
  id: string;
  complex_id: string;
  kind: string;
  status: string;
  note: string | null;
  answer: string | null;
  requested_at: string;
  resolved_at: string | null;
  requested_by: string | null;
  requester?: { full_name: string } | null;
};

const STATUSES: readonly RequestStatus[] = ["pending", "done", "declined", "cancelled"];

export function parseRequests(records: readonly RequestRecord[]): PublicationRequest[] {
  return records.flatMap((record) =>
    isRequestKind(record.kind) && (STATUSES as readonly string[]).includes(record.status)
      ? [
          {
            id: record.id,
            complexId: record.complex_id,
            kind: record.kind,
            status: record.status as RequestStatus,
            note: record.note,
            answer: record.answer,
            requestedAt: record.requested_at,
            resolvedAt: record.resolved_at,
            requestedBy: record.requested_by,
            requesterName: record.requester?.full_name ?? null,
          },
        ]
      : [],
  );
}

/** Ответ действий запроса; notified — ушло ли сообщение руководителю в Telegram. */
export type RequestResult =
  | { status: "idle" }
  | { status: "done"; at: number; notified?: boolean }
  | { status: "error"; error: string };

const KIND_TEXT: Record<RequestKind, string> = {
  publish: "опубликовать",
  unhide: "вернуть на сайт",
  hide: "скрыть с сайта",
  archive: "убрать в архив",
};

/**
 * Сообщение руководителю: кто, что и почему, ссылка на «Публикацию». Кнопок действий нет (п. 25):
 * нажатие в чате нельзя надёжно связать со входом в кабинет — решает руководитель в кабинете.
 */
export function requestTelegramText(input: {
  kind: RequestKind;
  complexName: string;
  requester: string | null;
  note: string | null;
  url: string;
}): string {
  const who = input.requester ?? "Менеджер";
  const lines = [`🔔 ${who} просит ${KIND_TEXT[input.kind]} ЖК «${input.complexName}».`];
  if (input.note) lines.push(`Причина: ${input.note}`);
  lines.push(`Открыть: ${input.url}`);
  return lines.join("\n");
}

/** Запись take_publication_reminders(): запрос без ответа больше суток. */
export type RequestReminder = {
  id: string;
  complex_id: string;
  kind: RequestKind;
  note: string | null;
  requested_at: string;
  complex: string;
  requester: string | null;
};

/** «Ждут руководителя больше суток: …» — строка на запрос со ссылкой на «Публикацию». */
export function requestReminderText(items: readonly RequestReminder[], link: (complexId: string) => string): string {
  const lines = items.map(
    (item) => `• ${item.complex} — ${KIND_TEXT[item.kind] ?? item.kind} (${item.requester ?? "менеджер"}): ${link(item.complex_id)}`,
  );
  return [`⏳ Запросы менеджеров ждут руководителя больше суток (${items.length}):`, ...lines].join("\n");
}

/** Запись take_drafts_digest(): черновик старше 14 дней и пункты минимума, которых не хватает. */
export type DraftDigestItem = { id: string; name: string; created_at: string; missing: string[] };

const REQUIREMENT_TEXT: Record<string, string> = {
  address: "адрес",
  point: "точка на карте",
  developer: "застройщик",
  renders: "рендеры",
  blocks: "блок со сроком",
  payment: "программа оплаты",
};

/** Недельная сводка: «Черновики дольше 14 дней: 3 ЖК» и чего не хватает каждому. */
export function draftsDigestText(items: readonly DraftDigestItem[], link: (complexId: string) => string): string {
  const lines = items.map((item) => {
    const missing = item.missing.map((key) => REQUIREMENT_TEXT[key] ?? key).join(", ");
    return `• ${item.name} — не хватает: ${missing || "ничего, можно публиковать"}. ${link(item.id)}`;
  });
  return [`📝 Черновики дольше 14 дней: ${items.length} ЖК.`, ...lines].join("\n");
}
