import { useTranslations } from "next-intl";
import { AdminTabs } from "@/components/AdminTabs";
import { complexTabHref, UNITS_SCREEN } from "@/lib/admin/complexes/tabs";

/** «Список · Фасад» экрана «Квартиры» (экран 4, PLAN §10 п. 22): вид — отдельным адресом. */
export function UnitsScreenSwitch({ base }: { base: string }) {
  const t = useTranslations("admin.complexes.unitsScreen");
  return (
    <AdminTabs
      label={t("label")}
      className="units-screen-switch"
      tabs={[
        { segment: UNITS_SCREEN.list, href: complexTabHref(base, "units"), label: t("list") },
        { segment: UNITS_SCREEN.facade, href: complexTabHref(base, "facade"), label: t("facade") },
      ]}
    />
  );
}
