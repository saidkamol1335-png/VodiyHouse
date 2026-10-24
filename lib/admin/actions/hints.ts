"use server";

import { contentDbErrorCode } from "@/lib/admin/developers/errors";
import { type HintActionResult, parseHint } from "@/lib/admin/hints/hints";
import { requireActionViewer } from "@/lib/admin/session";
import { expireDictionaries } from "@/lib/cache";

// «Справочники → Подсказки «?»» (шаг 2.8): правит руководитель (PLAN §5); права ещё раз
// проверяет RLS справочника hints, журнал — его триггер аудита.

/** Термин, пояснение RU | UZ и «показывать «?»» одной подсказки; набор подсказок не меняется. */
export async function saveHintAction(formData: FormData): Promise<HintActionResult> {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return { status: "error", error: guard.code, fieldErrors: {} };
  const parsed = parseHint(formData);
  if (!parsed.ok) {
    return {
      status: "error",
      error: parsed.unknown ? "invalid" : null,
      fieldErrors: parsed.fieldErrors,
    };
  }
  const { slug, term, text, isActive } = parsed.value;
  const { data, error } = await guard.supabase
    .from("hints")
    .update({ term, text, is_active: isActive })
    .eq("slug", slug)
    .select("id");
  if (error) return { status: "error", error: contentDbErrorCode(error), fieldErrors: {} };
  if (!data?.length) return { status: "error", error: "notFound", fieldErrors: {} };
  // Подсказки читает сайт (кэш справочников) — новый текст виден сразу.
  expireDictionaries();
  return { status: "done", at: Date.now() };
}
