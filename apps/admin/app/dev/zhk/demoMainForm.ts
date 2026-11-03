import { getTranslations } from "next-intl/server";
import { DEMO_DEVELOPER_OPTIONS } from "@/lib/admin/complexes/demo";
import { locationOptions } from "@/lib/admin/complexes/options";
import type { ComplexRecord } from "@/lib/admin/complexes/record";
import { complexTabHref } from "@/lib/admin/complexes/tabs";
import { SEED_DICTIONARIES } from "@/lib/admin/dictionaries/seed";
import { demoSaveComplexMainAction } from "./actions";

/** Поля ЖК вкладок «Основное», «О ЖК», «Расположение», «Документы и проверки» на DEMO. */
export async function demoMainFormProps(complex: ComplexRecord, base: string) {
  const t = await getTranslations("admin.complexes");
  return {
    complex,
    action: demoSaveComplexMainAction,
    developers: DEMO_DEVELOPER_OPTIONS,
    locations: locationOptions(SEED_DICTIONARIES.locations, complex.locationId, {
      city: t("fields.locationGroups.city"),
      district: t("fields.locationGroups.district"),
    }),
    // Этажность Shodlik — по блокам сида (12 этажей).
    floors: complex.address ? t("floorsValue", { min: 12 }) : null,
    blocksHref: complexTabHref(`${base}/${complex.id}`, "blocks"),
  };
}
