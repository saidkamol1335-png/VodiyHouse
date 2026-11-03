"use client";

import { Check, Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import { unitChecklist, unitPreview } from "@/lib/admin/units/unitChecklist";
import type { UnitsLayout } from "@/lib/admin/units/types";
import type { UnitDraft } from "@/lib/admin/units/unitForm";
import type { UnitRecord } from "@vh/shared/units";
import { formatArea, formatPrice, formatPricePerM2 } from "@vh/shared/format";

type UnitCompletenessProps = {
  unit: UnitRecord;
  draft: UnitDraft;
  layouts: readonly UnitsLayout[];
  currency: "USD" | "UZS";
  blockName: string;
};

/**
 * Экран 5 (PLAN §10, п. 27): живой чек-лист «квартира на сайте» из 5 пунктов — по черновику формы,
 * до сохранения, — и превью карточки, как её увидит посетитель. Пункты — подписи к полям формы.
 */
export function UnitCompleteness({ unit, draft, layouts, currency, blockName }: UnitCompletenessProps) {
  const t = useTranslations("admin.complexes.units.checklist");
  const layout = layouts.find((item) => item.id === draft.layoutId) ?? null;
  const items = unitChecklist(unit, draft, layout);
  const done = items.filter((item) => item.ok).length;
  const preview = unitPreview(draft, layout);
  return (
    <aside className="unit-edit__aside" aria-label={t("label")}>
      <p className="unit-edit__aside-title">{t("summary", { done, total: items.length })}</p>
      <ul className="unit-edit__checklist">
        {items.map((item) => (
          <li key={item.key} className={item.ok ? "unit-edit__check unit-edit__check--ok" : "unit-edit__check"}>
            {item.ok ? <Check size={14} aria-label={t("done")} /> : <Circle size={12} aria-label={t("todo")} />}
            {t(`items.${item.key}`)}
          </li>
        ))}
      </ul>
      <div className="unit-edit__card" aria-label={t("preview")}>
        <p className="unit-edit__card-kicker">{t("previewKicker", { block: blockName, floor: unit.floor })}</p>
        <p className="unit-edit__card-title">
          {layout
            ? t("previewTitle", { rooms: layout.rooms, area: formatArea(layout.area) })
            : t("previewNoLayout")}
        </p>
        <p className="unit-edit__card-price">
          {preview.total !== null ? formatPrice(preview.total, currency) : t("previewNoPrice")}
          {preview.perM2 !== null ? <span> · {formatPricePerM2(preview.perM2, currency)}</span> : null}
        </p>
        <p className={done === items.length ? "unit-edit__card-state unit-edit__card-state--on" : "unit-edit__card-state"}>
          {done === items.length ? t("onSite") : t("offSite")}
        </p>
      </div>
    </aside>
  );
}
