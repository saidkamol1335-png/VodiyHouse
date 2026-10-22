import { useTranslations } from "next-intl";
import type { UnitRowView } from "@/lib/admin/units/rowView";
import { formatArea } from "@/lib/format";

// Ячейки строки квартиры: что пусто — серым словом («без планировки», «без цены», «—»).

export function LayoutCell({ view }: { view: UnitRowView }) {
  const t = useTranslations("admin.complexes.units");
  if (!view.layout)
    return (
      <td className="units-row__layout units-row__layout--none" role="cell">
        {t("list.noLayout")}
      </td>
    );
  const { rooms, area, variant } = view.layout;
  const label = t("layoutLabel", { rooms, area: formatArea(area) });
  return (
    <td className="units-row__layout" role="cell">
      {variant ? `${label} · ${t("layoutVariant", { n: variant })}` : label}
    </td>
  );
}

/** «$37 200 · $620/м²»; у брони и проданной — серым: сайт эту цену не видит. */
export function PriceCell({ view }: { view: UnitRowView }) {
  const t = useTranslations("admin.complexes.units.list");
  if (view.total === null && view.perM2 === null)
    return (
      <td className="units-row__price units-row__price--none" role="cell">
        {t("noPrice")}
      </td>
    );
  const muted = view.muted ? " units-row__price--muted" : "";
  return (
    <td className={`units-row__price${muted}`} role="cell">
      {view.total ? <span className="units-row__total">{view.total}</span> : null}
      {view.total && view.perM2 ? <span className="units-row__sep"> · </span> : null}
      {view.perM2 ? <span className="units-row__per-m2">{view.perM2}</span> : null}
    </td>
  );
}

export function FinishingCell({ view }: { view: UnitRowView }) {
  const t = useTranslations("admin.complexes.units.list");
  const { finishing } = view;
  if (!finishing)
    return (
      <td className="units-row__finishing units-row__finishing--none" role="cell">
        {t("noFinishing")}
      </td>
    );
  const inherited = finishing.inherited ? " units-row__finishing--inherited" : "";
  return (
    <td className={`units-row__finishing${inherited}`} role="cell">
      {finishing.inherited ? t("inherited", { name: finishing.name }) : finishing.name}
    </td>
  );
}
