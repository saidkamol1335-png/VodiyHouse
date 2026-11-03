import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bilingualHasContact } from "@/lib/admin/contactGuard";
import { contentDbErrorCode, type ContentErrorCode } from "@/lib/admin/developers/errors";
import { progressPublishedText, type ProgressNotice } from "@/lib/admin/progress/notify";
import {
  INCOMING_BUCKET,
  INCOMING_PATH_PATTERN,
  MEDIA_BUCKET,
  PROGRESS_PHOTO_PATH_PATTERN,
  PROGRESS_VIDEO_BUCKET,
  PROGRESS_VIDEO_PATH_PATTERN,
} from "@/lib/media";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { removeProgressFiles } from "./mediaFiles";
import { notifyAuthor } from "./progressNotify";
import { clientVideoUrl } from "./progressOverview";

// Публикация отчёта (фаза E, п. 13): загрузки до проверки — в приватном incoming; руководитель публикует —
// база назначает адреса копий (progress_publish_files), сервер секретным ключом копирует файлы в media и
// progress-video, база переключает пути (publish_progress_report). Сбой — созданные копии без ссылок
// удаляются; incoming остаётся до следующей попытки.

type CopyFile = { from: string; to: string; bucket: string };
type Planned = { version: string; files: CopyFile[] };
type Done = {
  id: string;
  complex_id: string;
  author_id: string | null;
  is_unit: boolean;
  slug: string;
  incoming: string[];
  notice: ProgressNotice;
};

export type PublishOutcome = { ok: true; complexId: string } | { ok: false; error: ContentErrorCode };

const TARGET: Record<string, RegExp> = {
  [MEDIA_BUCKET]: PROGRESS_PHOTO_PATH_PATTERN,
  [PROGRESS_VIDEO_BUCKET]: PROGRESS_VIDEO_PATH_PATTERN,
};

/** Пара копии: из incoming в свой бакет, папка того же ЖК — иначе сервер ничего не копирует. */
export function isSafeCopy(file: CopyFile): boolean {
  const target = TARGET[file.bucket];
  return Boolean(
    target &&
      INCOMING_PATH_PATTERN.test(file.from) &&
      target.test(file.to) &&
      file.from.split("/")[1] === file.to.split("/")[1] &&
      file.from.endsWith(file.to.slice(file.to.lastIndexOf("."))),
  );
}

const copyOnce = (admin: SupabaseClient, file: CopyFile) =>
  admin.storage.from(INCOMING_BUCKET).copy(file.from, file.to, { destinationBucket: file.bucket });

const isExists = (error: { message: string; statusCode?: string | number; status?: number }) =>
  Number(error.statusCode ?? error.status) === 409 || /exists/i.test(error.message);

/**
 * Копии секретным ключом. Адрес уже занят (прошлая попытка или файл, подложенный по известному адресу) —
 * он заменяется нашей копией: база примет только копию сервера (без владельца).
 */
async function copyAll(admin: SupabaseClient, files: readonly CopyFile[], created: string[]): Promise<boolean> {
  for (const file of files) {
    let { error } = await copyOnce(admin, file);
    if (error && isExists(error)) {
      await admin.storage.from(file.bucket).remove([file.to]);
      ({ error } = await copyOnce(admin, file));
    }
    if (error) {
      console.error("[progress] копия не создана", { from: file.from, error: error.message });
      return false;
    }
    created.push(file.to);
  }
  return true;
}

/** Откат: созданные копии, на которые база не ссылается, — удалить. */
async function rollback(admin: SupabaseClient, created: readonly string[]): Promise<void> {
  if (created.length === 0) return;
  const { data, error } = await admin.rpc("progress_public_refs", { p_paths: created });
  if (error) return console.error("[progress] откат копий не проверен", error.message);
  const kept = new Set((data ?? []) as string[]);
  await removeProgressFiles(admin, created.filter((path) => !kept.has(path)));
}

type PublishInput = { id: string; checked: boolean; version: string; actorId: string };

/**
 * «Опубликовать на сайте»: правило 1.2 в комментарии → адреса копий → копии → переключение путей →
 * уборка incoming, сообщение автору. supabase — сессия руководителя, admin — секретный ключ.
 */
export async function publishProgress(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  { id, checked, version, actorId }: PublishInput,
): Promise<PublishOutcome> {
  const { data: report, error: readError } = await supabase
    .from("progress_reports")
    .select("comment")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { ok: false, error: contentDbErrorCode(readError) };
  if (!report) return { ok: false, error: "notFound" };
  if (bilingualHasContact(report.comment as { ru: string; uz: string })) return { ok: false, error: "contacts" };

  const planned = await supabase.rpc("progress_publish_files", { p_id: id, p_checked: checked, p_version: version });
  if (planned.error) return { ok: false, error: contentDbErrorCode(planned.error) };
  const { version: next, files } = planned.data as Planned;
  if (!files.every(isSafeCopy)) return { ok: false, error: "invalid" };

  const created: string[] = [];
  if (!(await copyAll(admin, files, created))) {
    await rollback(admin, created);
    return { ok: false, error: "copyFailed" };
  }
  const published = await supabase.rpc("publish_progress_report", { p_id: id, p_checked: checked, p_version: next });
  if (published.error) {
    await rollback(admin, created);
    return { ok: false, error: contentDbErrorCode(published.error) };
  }
  const done = published.data as Done;
  await removeProgressFiles(admin, done.incoming);
  await notifyAuthor(
    done.author_id,
    actorId,
    progressPublishedText(done.notice, clientVideoUrl({ isUnit: done.is_unit, id: done.id, slug: done.slug })),
  ).catch(() => false);
  return { ok: true, complexId: done.complex_id };
}

/** То же с секретным ключом сервера — для действия руководителя (после свежей проверки Auth). */
export async function publishProgressAsHead(supabase: SupabaseClient, input: PublishInput): Promise<PublishOutcome> {
  return publishProgress(supabase, createSupabaseAdminClient(), input);
}
