"use server";

import {
  isRequestKind,
  REQUEST_NOTE_MAX,
  requestTelegramText,
  type RequestResult,
} from "@/lib/admin/complexes/requests";
import { complexTabHref } from "@/lib/admin/complexes/tabs";
import { readText, readUuid } from "@/lib/admin/credentials";
import { contentDbErrorCode } from "@/lib/admin/developers/errors";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { adminOrigin } from "@/lib/admin/origin";
import { requireActionViewer } from "@/lib/admin/session";
import { sendTelegram, telegramConfig } from "@/lib/leads/server/channels";

// «Запросить у руководителя» (PLAN §10, пп. 6, 25). Права ещё раз проверяет база:
// request_publication — только менеджер, resolve_publication_request — отклоняет руководитель,
// отзывает автор.

const headGuard = () => requireActionViewer(["head"]);

const fail = (error: string): RequestResult => ({ status: "error", error });

function noteOf(formData: FormData): string | null | "tooLong" {
  const note = (readText(formData, "note") ?? "").trim();
  if (!note) return null;
  return note.length > REQUEST_NOTE_MAX ? "tooLong" : note;
}

/** Менеджер просит руководителя; сообщение в Telegram со ссылкой на «Публикацию». */
export async function requestPublicationAction(formData: FormData): Promise<RequestResult> {
  const guard = await requireActionViewer(["manager"]);
  if (!guard.ok) return fail(guard.code);
  const id = readUuid(formData);
  const kind = readText(formData, "kind");
  const note = noteOf(formData);
  if (!id || !isRequestKind(kind)) return fail("invalid");
  if (note === "tooLong") return fail("noteTooLong");

  const { error } = await guard.supabase.rpc("request_publication", {
    p_complex: id,
    p_kind: kind,
    p_note: note,
  });
  if (error) return fail(contentDbErrorCode(error));

  const config = telegramConfig();
  if (!config) return { status: "done", at: Date.now(), notified: false };
  const { data } = await guard.supabase.from("complexes").select("name").eq("id", id).maybeSingle();
  const name = ((data?.name ?? {}) as { ru?: string }).ru ?? "";
  const url = `${adminOrigin()}${complexTabHref(`${ADMIN_ROUTES.complexes}/${id}`, "publication")}`;
  const sent = await sendTelegram(
    config,
    config.alertChatId,
    requestTelegramText({ kind, complexName: name, requester: guard.viewer.name, note, url }),
  );
  if (!sent.ok) console.error("[requests] сообщение руководителю не ушло", sent.error);
  return { status: "done", at: Date.now(), notified: sent.ok };
}

/** Менеджер отзывает свой открытый запрос. */
export async function cancelPublicationRequestAction(formData: FormData): Promise<RequestResult> {
  const guard = await requireActionViewer(["manager"]);
  if (!guard.ok) return fail(guard.code);
  const request = readUuid(formData, "request");
  if (!request) return fail("invalid");
  const { error } = await guard.supabase.rpc("resolve_publication_request", {
    p_request: request,
    p_status: "cancelled",
  });
  return error ? fail(contentDbErrorCode(error)) : { status: "done", at: Date.now() };
}

/** Руководитель отклоняет с причиной — менеджер видит её во вкладке «Публикация». */
export async function declinePublicationRequestAction(formData: FormData): Promise<RequestResult> {
  const guard = await headGuard();
  if (!guard.ok) return fail(guard.code);
  const request = readUuid(formData, "request");
  const answer = (readText(formData, "answer") ?? "").trim();
  if (!request) return fail("invalid");
  if (!answer) return fail("answerRequired");
  if (answer.length > REQUEST_NOTE_MAX) return fail("noteTooLong");
  const { error } = await guard.supabase.rpc("resolve_publication_request", {
    p_request: request,
    p_status: "declined",
    p_answer: answer,
  });
  return error ? fail(contentDbErrorCode(error)) : { status: "done", at: Date.now() };
}
