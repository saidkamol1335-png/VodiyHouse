import { getTranslations } from "next-intl/server";
import { ComplexMainForm } from "@/components/ComplexMainForm";
import { saveComplexMainAction } from "@/lib/admin/actions/complexes";
import { locationOptions } from "@/lib/admin/complexes/options";
import { complexTabHref } from "@/lib/admin/complexes/tabs";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { complexForTab } from "@/lib/admin/server/complexPage";
import { readDeveloperOptions, readFloorsRange } from "@/lib/admin/server/complexes";
import { readDictionary } from "@/lib/admin/server/developers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** Вкладка «Основное» (И1–И3): «О ЖК», «Расположение», «Проверено Vodiy House». */
export default async function ComplexMainPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = await complexForTab(params);
  if (!complex) return null;
  const t = await getTranslations("admin.complexes");
  const supabase = await createSupabaseServerClient();
  const [developers, locations, floors] = await Promise.all([
    readDeveloperOptions(supabase),
    readDictionary(supabase, "locations"),
    readFloorsRange(supabase, complex.id),
  ]);
  const current = developers.some((developer) => developer.id === complex.developerId)
    ? developers
    : [{ id: complex.developerId, name: complex.developerName }, ...developers];
  const floorsText = floors
    ? floors.min === floors.max
      ? t("floorsValue", { min: floors.min })
      : t("floorsRange", floors)
    : null;
  return (
    <ComplexMainForm
      key={complex.id}
      complex={complex}
      action={saveComplexMainAction}
      developers={current}
      locations={locationOptions(locations, complex.locationId, {
        city: t("fields.locationGroups.city"),
        district: t("fields.locationGroups.district"),
      })}
      floors={floorsText}
      blocksHref={complexTabHref(`${ADMIN_ROUTES.complexes}/${complex.id}`, "blocks")}
    />
  );
}
