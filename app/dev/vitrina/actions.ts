"use server";

import { devOnly } from "../devOnly";
import { redirect } from "next/navigation";
import { readText } from "@/lib/admin/credentials";
import { NEW_SHOWCASE_ID, showcaseItemHref, showcaseListHref } from "@/lib/admin/nav";
import { parseAd, type AdErrors, type AdFields } from "@/lib/admin/showcase/adForm";
import { parseCollection, type CollectionErrors, type CollectionFields } from "@/lib/admin/showcase/collectionForm";
import { DEMO_FIRST_IDS } from "@/lib/admin/showcase/demo";
import { parseSpecial, type SpecialErrors, type SpecialFields } from "@/lib/admin/showcase/specialForm";
import type { DeleteShowcaseResult, SaveShowcaseResult } from "@/lib/admin/showcase/types";
import { DEV_SHOWCASE_BASE } from "./base";

// Подделка базы для стенда /dev/vitrina: настоящие проверки форм (переводы, правило 1.2, «нет
// скидок», период, ЖК), без записи. Новая запись ведёт на первую DEMO-запись своего вида.

const isNew = (formData: FormData) => (readText(formData, "id") ?? NEW_SHOWCASE_ID) === NEW_SHOWCASE_ID;

export async function demoSaveSpecialAction(formData: FormData): Promise<SaveShowcaseResult<SpecialFields, SpecialErrors>> {
  devOnly();
  const parsed = parseSpecial(formData);
  if (!parsed.ok) return { status: "error", error: null, fieldErrors: parsed.fieldErrors, fields: parsed.fields };
  if (isNew(formData)) redirect(showcaseItemHref("special", DEMO_FIRST_IDS.special, DEV_SHOWCASE_BASE));
  return { status: "saved", at: Date.now() };
}

export async function demoSaveCollectionAction(
  formData: FormData,
): Promise<SaveShowcaseResult<CollectionFields, CollectionErrors>> {
  devOnly();
  const parsed = parseCollection(formData);
  if (!parsed.ok) return { status: "error", error: null, fieldErrors: parsed.fieldErrors, fields: parsed.fields };
  if (isNew(formData)) redirect(showcaseItemHref("collection", DEMO_FIRST_IDS.collection, DEV_SHOWCASE_BASE));
  return { status: "saved", at: Date.now() };
}

export async function demoSaveAdAction(formData: FormData): Promise<SaveShowcaseResult<AdFields, AdErrors>> {
  devOnly();
  const parsed = parseAd(formData);
  if (!parsed.ok) return { status: "error", error: null, fieldErrors: parsed.fieldErrors, fields: parsed.fields };
  if (isNew(formData)) redirect(showcaseItemHref("ad", DEMO_FIRST_IDS.ad, DEV_SHOWCASE_BASE));
  return { status: "saved", at: Date.now() };
}

/** «Удалить» на стенде — переход в список: DEMO не меняется. */
export async function demoDeleteShowcaseAction(formData: FormData): Promise<DeleteShowcaseResult> {
  devOnly();
  const owner = readText(formData, "owner");
  if (owner !== "special" && owner !== "collection" && owner !== "ad") return { status: "error", error: "invalid" };
  if (readText(formData, "confirm") !== "on") return { status: "error", error: "confirmName" };
  redirect(showcaseListHref(owner, DEV_SHOWCASE_BASE));
}
