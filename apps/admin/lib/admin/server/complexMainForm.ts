import "server-only";
import { getTranslations } from "next-intl/server";
import { locationOptions } from "../complexes/options";
import type { ComplexRecord } from "../complexes/record";
import { complexTabHref } from "../complexes/tabs";
import { ADMIN_ROUTES } from "../nav";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readDeveloperOptions, readFloorsRange } from "./complexes";
import { readDictionary } from "./developers";

// Поля ЖК, разнесённые по вкладкам «Основное», «О ЖК», «Расположение», «Документы и проверки»
// (экран 3): одни и те же списки выбора и этажность для формы любой из них.

export async function complexMainFormProps(complex: ComplexRecord) {
  const t = await getTranslations("admin.complexes");
  const supabase = await createSupabaseServerClient();
  const [developers, locations, floors] = await Promise.all([
    readDeveloperOptions(supabase),
    readDictionary(supabase, "locations"),
    readFloorsRange(supabase, complex.id),
  ]);
  const current =
    !complex.developerId || developers.some((developer) => developer.id === complex.developerId)
      ? developers
      : [{ id: complex.developerId, name: complex.developerName }, ...developers];
  const floorsText = floors
    ? floors.min === floors.max
      ? t("floorsValue", { min: floors.min })
      : t("floorsRange", floors)
    : null;
  return {
    complex,
    developers: current,
    locations: locationOptions(locations, complex.locationId, {
      city: t("fields.locationGroups.city"),
      district: t("fields.locationGroups.district"),
    }),
    floors: floorsText,
    blocksHref: complexTabHref(`${ADMIN_ROUTES.complexes}/${complex.id}`, "blocks"),
  };
}
