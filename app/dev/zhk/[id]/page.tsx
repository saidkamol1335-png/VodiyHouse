import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ComplexMainForm } from "@/components/ComplexMainForm";
import { DEMO_DEVELOPER_OPTIONS } from "@/lib/admin/complexes/demo";
import { demoComplex } from "@/lib/admin/complexes/demoPage";
import { locationOptions } from "@/lib/admin/complexes/options";
import { complexTabHref } from "@/lib/admin/complexes/tabs";
import { SEED_DICTIONARIES } from "@/lib/admin/dictionaries/seed";
import { demoSaveComplexMainAction } from "../actions";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета
// (docs: instant-navigation) — иначе меню и вкладки (usePathname) вне <Suspense> падают.
export const instant = false;

/** Вкладка «Основное» на DEMO: этажность Shodlik — по блокам сида (12 этажей). */
export default async function DevComplexMainPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = demoComplex((await params).id);
  if (!complex) notFound();
  const t = await getTranslations("admin.complexes");
  return (
    <ComplexMainForm
      key={complex.id}
      complex={complex}
      action={demoSaveComplexMainAction}
      developers={DEMO_DEVELOPER_OPTIONS}
      locations={locationOptions(SEED_DICTIONARIES.locations, complex.locationId, {
        city: t("fields.locationGroups.city"),
        district: t("fields.locationGroups.district"),
      })}
      floors={complex.address ? t("floorsValue", { min: 12 }) : null}
      blocksHref={complexTabHref(`/dev/zhk/${complex.id}`, "blocks")}
    />
  );
}
