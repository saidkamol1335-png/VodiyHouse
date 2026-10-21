"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { readText } from "@/lib/admin/credentials";
import { contentDbErrorCode, type ContentErrorCode } from "@/lib/admin/developers/errors";
import {
  DICTIONARIES,
  dictionaryRow,
  parseDictionaryItem,
  readDictionaryKey,
  readItemId,
  readOrder,
  type DictionaryItemInput,
  type DictionaryKey,
} from "@/lib/admin/dictionaries/definitions";
import type { DictionaryActionResult } from "@/lib/admin/dictionaries/types";
import { requireActionViewer } from "@/lib/admin/session";
import { expireDictionaries } from "@/lib/cache";
import { contentSlug } from "@/lib/slug";

// «Настройки → Справочники» (решение Д6): правит руководитель (PLAN §5), права ещё раз
// проверяют RLS справочников и функции базы.

const MAX_SLUG_TRIES = 20;
const UNIQUE_VIOLATION = "23505";

const fail = (error: ContentErrorCode): DictionaryActionResult => ({
  status: "error",
  error,
  fieldErrors: {},
});
const done = (outcome?: "deleted" | "hidden"): DictionaryActionResult => ({
  status: "done",
  at: Date.now(),
  outcome,
});

type Target = { supabase: SupabaseClient; key: DictionaryKey };

type Guard = Awaited<ReturnType<typeof requireActionViewer>>;

/** Руководитель и известный справочник — или готовый отказ. */
function target(guard: Guard, formData: FormData): Target | DictionaryActionResult {
  if (!guard.ok) return fail(guard.code);
  const key = readDictionaryKey(formData);
  return key ? { supabase: guard.supabase, key } : fail("invalid");
}

const isTarget = (value: Target | DictionaryActionResult): value is Target => "key" in value;

async function nextSortOf({ supabase, key }: Target): Promise<number | ContentErrorCode> {
  const { data, error } = await supabase
    .from(key)
    .select("sort")
    .order("sort", { ascending: false })
    .limit(1);
  if (error) return contentDbErrorCode(error);
  return Number((data?.[0] as { sort?: number } | undefined)?.sort ?? 0) + 10;
}

/** Адрес — из узбекского названия (латиница); занят — -2, -3… */
async function insertItem(
  at: Target,
  input: DictionaryItemInput,
  sort: number,
): Promise<ContentErrorCode | null> {
  const base = contentSlug(input.name.uz, DICTIONARIES[at.key].slugFallback);
  for (let attempt = 1; attempt <= MAX_SLUG_TRIES; attempt += 1) {
    const slug = attempt === 1 ? base : `${base}-${attempt}`;
    const { error } = await at.supabase
      .from(at.key)
      .insert({ ...dictionaryRow(at.key, input), slug, sort });
    if (!error) return null;
    if (error.code !== UNIQUE_VIOLATION) return contentDbErrorCode(error);
  }
  return "duplicate";
}

/** «+ Добавить» — в конец списка. */
export async function addDictionaryItemAction(formData: FormData): Promise<DictionaryActionResult> {
  const guard = await requireActionViewer(["head"]);
  const at = target(guard, formData);
  if (!isTarget(at)) return at;
  const parsed = parseDictionaryItem(at.key, formData);
  if (!parsed.ok) return { status: "error", error: null, fieldErrors: parsed.fieldErrors };

  const sort = await nextSortOf(at);
  if (typeof sort !== "number") return fail(sort);
  const error = await insertItem(at, parsed.value, sort);
  if (error) return fail(error);
  expireDictionaries();
  return done();
}

/** Правка на месте: название, второе поле, вид (город / район). Адрес не меняется. */
export async function updateDictionaryItemAction(
  formData: FormData,
): Promise<DictionaryActionResult> {
  const guard = await requireActionViewer(["head"]);
  const at = target(guard, formData);
  if (!isTarget(at)) return at;
  const id = readItemId(formData);
  if (!id) return fail("notFound");
  const parsed = parseDictionaryItem(at.key, formData);
  if (!parsed.ok) return { status: "error", error: null, fieldErrors: parsed.fieldErrors };

  const { data, error } = await at.supabase
    .from(at.key)
    .update(dictionaryRow(at.key, parsed.value))
    .eq("id", id)
    .select("id");
  if (error) return fail(contentDbErrorCode(error));
  if (!data?.length) return fail("notFound");
  expireDictionaries();
  return done();
}

/** «Скрыть» / «Показать»: скрытое не видно на сайте, но остаётся у ЖК. */
export async function setDictionaryItemActiveAction(
  formData: FormData,
): Promise<DictionaryActionResult> {
  const guard = await requireActionViewer(["head"]);
  const at = target(guard, formData);
  if (!isTarget(at)) return at;
  const id = readItemId(formData);
  if (!id) return fail("notFound");

  const active = readText(formData, "active") === "true";
  const { data, error } = await at.supabase
    .from(at.key)
    .update({ is_active: active })
    .eq("id", id)
    .select("id");
  if (error) return fail(contentDbErrorCode(error));
  if (!data?.length) return fail("notFound");
  expireDictionaries();
  return done();
}

/** «Удалить»: неиспользуемое удаляется, используемое — скрывается (ответ говорит, что сделано). */
export async function removeDictionaryItemAction(
  formData: FormData,
): Promise<DictionaryActionResult> {
  const guard = await requireActionViewer(["head"]);
  const at = target(guard, formData);
  if (!isTarget(at)) return at;
  const id = readItemId(formData);
  if (!id) return fail("notFound");

  const { data, error } = await at.supabase.rpc("remove_dictionary_item", {
    p_dictionary: at.key,
    p_id: id,
  });
  if (error) return fail(contentDbErrorCode(error));
  expireDictionaries();
  return done(data === "hidden" ? "hidden" : "deleted");
}

/** Порядок перетаскиванием — весь список id. */
export async function reorderDictionaryAction(formData: FormData): Promise<DictionaryActionResult> {
  const guard = await requireActionViewer(["head"]);
  const at = target(guard, formData);
  if (!isTarget(at)) return at;
  const order = readOrder(formData);
  if (!order) return fail("invalid");

  const { error } = await at.supabase.rpc("reorder_dictionary", {
    p_dictionary: at.key,
    p_ids: order,
  });
  if (error) return fail(contentDbErrorCode(error));
  expireDictionaries();
  return done();
}
