"use server";

import { redirect } from "next/navigation";
import { parseComplexCreate } from "@/lib/admin/complexes/create";
import { DEMO_COMPLEX_ROWS } from "@/lib/admin/complexes/demo";
import { demoComplex, demoReadiness } from "@/lib/admin/complexes/demoPage";
import { parseComplexMain } from "@/lib/admin/complexes/mainForm";
import { missingOf } from "@/lib/admin/complexes/readiness";
import type {
  ComplexStatusResult,
  CreateComplexResult,
  SaveComplexMainResult,
} from "@/lib/admin/complexes/types";
import { bilingualHasContact } from "@/lib/admin/contactGuard";
import { readText, readUuid } from "@/lib/admin/credentials";
import { archiveConfirmed, canMove } from "@/lib/admin/developers/publication";
import { isPublicationStatus } from "@/lib/admin/publicationFilter";

// Подделка Supabase для стенда /dev/zhk: настоящие проверки форм и правила статуса, без базы.
// DEMO не меняется — стенд показывает ответы действий (как /dev/zastroyshchiki).

function devOnly() {
  if (process.env.NODE_ENV === "production") throw new Error("Стенд только для разработки");
}

/** Создание ведёт на черновик DEMO — у стенда нет базы, куда положить новый ЖК. */
export async function demoCreateComplexAction(formData: FormData): Promise<CreateComplexResult> {
  devOnly();
  const parsed = parseComplexCreate(formData);
  if (!parsed.ok) {
    return { status: "error", error: null, fieldErrors: parsed.fieldErrors, fields: parsed.fields };
  }
  if (bilingualHasContact(parsed.value.name)) {
    return { status: "error", error: "contacts", fieldErrors: {}, fields: parsed.fields };
  }
  const draft = DEMO_COMPLEX_ROWS.find((row) => row.status === "draft") ?? DEMO_COMPLEX_ROWS[0]!;
  redirect(`/dev/zhk/${draft.id}`);
}

export async function demoSaveComplexMainAction(
  formData: FormData,
): Promise<SaveComplexMainResult> {
  devOnly();
  const parsed = parseComplexMain(formData);
  if (!parsed.ok) {
    return {
      status: "error",
      error: null,
      fieldErrors: parsed.fieldErrors,
      fields: parsed.fields,
      broken: [],
    };
  }
  return { status: "saved", at: Date.now() };
}

/** Правила — как у настоящего действия; фото и чертежей у DEMO нет, поэтому публикации их не хватает. */
export async function demoSetComplexStatusAction(formData: FormData): Promise<ComplexStatusResult> {
  devOnly();
  const complex = demoComplex(readUuid(formData) ?? "");
  const to = readText(formData, "to");
  const fail = (
    error: "invalid" | "statusMove" | "confirmName" | "rule12",
  ): ComplexStatusResult => ({
    status: "error",
    error,
    missing: [],
  });
  if (!complex || !to || !isPublicationStatus(to)) return fail("invalid");
  if (!canMove(complex.status, to)) return fail("statusMove");
  const confirm = readText(formData, "confirm") ?? "";
  if (
    to === "archived" &&
    !Object.values(complex.name).some((name) => archiveConfirmed(confirm, name))
  ) {
    return fail("confirmName");
  }
  if (to === "published") {
    if (readText(formData, "rule12") !== "on") return fail("rule12");
    const missing = missingOf(demoReadiness(complex));
    if (missing.length > 0) return { status: "error", error: "notReady", missing };
  }
  return { status: "done", to, at: Date.now() };
}
