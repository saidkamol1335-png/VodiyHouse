"use server";

import { devOnly } from "../devOnly";
import {
  parseDictionaryItem,
  readDictionaryKey,
  readItemId,
  readOrder,
} from "@/lib/admin/dictionaries/definitions";
import { SEED_DICTIONARIES } from "@/lib/admin/dictionaries/seed";
import type { DictionaryActionResult } from "@/lib/admin/dictionaries/types";
import { type HintActionResult, parseHint } from "@/lib/admin/hints/hints";

// Подделка для стенда /dev/spravochniki: настоящие проверки, без базы. Удаление ведёт себя как
// remove_dictionary_item: «Фергана» стоит у DEMO-ЖК — она скрывается, остальное удаляется.

const USED_SLUGS = new Set(["fergana"]);

const invalid: DictionaryActionResult = { status: "error", error: "invalid", fieldErrors: {} };
const done = (outcome?: "deleted" | "hidden"): DictionaryActionResult => ({
  status: "done",
  at: Date.now(),
  outcome,
});

function checkItem(formData: FormData): DictionaryActionResult {
  const key = readDictionaryKey(formData);
  if (!key) return invalid;
  const parsed = parseDictionaryItem(key, formData);
  return parsed.ok ? done() : { status: "error", error: null, fieldErrors: parsed.fieldErrors };
}

export async function demoAddDictionaryItemAction(
  formData: FormData,
): Promise<DictionaryActionResult> {
  devOnly();
  return checkItem(formData);
}

export async function demoUpdateDictionaryItemAction(
  formData: FormData,
): Promise<DictionaryActionResult> {
  devOnly();
  return readItemId(formData) ? checkItem(formData) : invalid;
}

export async function demoSetDictionaryItemActiveAction(
  formData: FormData,
): Promise<DictionaryActionResult> {
  devOnly();
  return readDictionaryKey(formData) && readItemId(formData) ? done() : invalid;
}

export async function demoRemoveDictionaryItemAction(
  formData: FormData,
): Promise<DictionaryActionResult> {
  devOnly();
  const key = readDictionaryKey(formData);
  const id = readItemId(formData);
  const item = key && id ? SEED_DICTIONARIES[key].find((entry) => entry.id === id) : undefined;
  if (!item) return { status: "error", error: "notFound", fieldErrors: {} };
  return done(USED_SLUGS.has(item.slug) ? "hidden" : "deleted");
}

export async function demoReorderDictionaryAction(
  formData: FormData,
): Promise<DictionaryActionResult> {
  devOnly();
  return readDictionaryKey(formData) && readOrder(formData) ? done() : invalid;
}

/** Подсказка «?»: те же проверки, что у saveHintAction, без базы. */
export async function demoSaveHintAction(formData: FormData): Promise<HintActionResult> {
  devOnly();
  const parsed = parseHint(formData);
  if (parsed.ok) return { status: "done", at: Date.now() };
  return {
    status: "error",
    error: parsed.unknown ? "invalid" : null,
    fieldErrors: parsed.fieldErrors,
  };
}
