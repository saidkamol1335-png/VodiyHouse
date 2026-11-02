"use server";

import { contentDbErrorCode } from "@/lib/admin/developers/errors";
import {
  journalPage,
  JOURNAL_PAGE,
  type JournalLoadResult,
  type JournalRecord,
  type JournalScope,
} from "@/lib/admin/journal/format";
import { requireActionViewer } from "@/lib/admin/session";

// «Показать ещё» в журнале застройщика, ЖК и в «Настройки → Журнал»: следующая страница от
// последней показанной строки. Разделы — руководителю (PLAN §7).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isScopeId = (id: unknown) => id === null || (typeof id === "string" && UUID.test(id));

export async function loadJournalAction(
  scope: JournalScope,
  before: number,
): Promise<JournalLoadResult> {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return { status: "error", error: guard.code };
  if (
    !isScopeId(scope?.developerId) ||
    !isScopeId(scope?.complexId) ||
    !Number.isSafeInteger(before) ||
    before < 1
  ) {
    return { status: "error", error: "invalid" };
  }
  const { data, error } = await guard.supabase.rpc("journal_entries", {
    p_developer: scope.developerId,
    p_complex: scope.complexId,
    p_before: before,
    p_limit: JOURNAL_PAGE,
  });
  if (error) return { status: "error", error: contentDbErrorCode(error) };
  return { status: "ok", page: journalPage((data ?? []) as JournalRecord[]) };
}
