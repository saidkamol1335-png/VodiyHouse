import { useTranslations } from "next-intl";
import type { UnitRowView } from "@/lib/admin/units/rowView";
import { formatArea } from "@vh/shared/format";
import type { UnitRecord } from "@vh/shared/units";
import { InlinePrice } from "./InlinePrice";

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

/**
 * «$37 200 · $620/м²»; у брони и проданной — серым: сайт эту цену не видит. Тому, кто правит
 * квартиры, цена — кнопка: правка прямо в строке (экран 4).
 */
export function PriceCell({ view, unit }: { view: UnitRowView; unit: UnitRecord }) {
  const t = useTranslations("admin.complexes.units.list");
  if (view.total === null && view.perM2 === null)
    return (
      <td className="units-row__price units-row__price--none" role="cell">
        <InlinePrice unit={unit}>{t("noPrice")}</InlinePrice>
      </td>
    );
  const muted = view.muted ? " units-row__price--muted" : "";
  return (
    <td className={`units-row__price${muted}`} role="cell">
      <InlinePrice unit={unit}>
        {view.total ? <span className="units-row__total">{view.total}</span> : null}
        {view.total && view.perM2 ? <span className="units-row__sep"> · </span> : null}
        {view.perM2 ? <span className="units-row__per-m2">{view.perM2}</span> : null}
      </InlinePrice>
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

/** «На сайте» (экран 4): галочка или чего не хватает — «нет цены · нет чертежа». */
export function SiteCell({ view }: { view: UnitRowView }) {
  const t = useTranslations("admin.complexes.units.list");
  if (view.siteGaps.length === 0)
    return (
      <td className="units-row__site units-row__site--on" role="cell">
        <span className="units-row__prefix">{t("card.site")} </span>
        {t("site.on")}
      </td>
    );
  return (
    <td className="units-row__site" role="cell">
      <span className="units-row__prefix">{t("card.site")} </span>
      {view.siteGaps.map((gap) => t(`site.gaps.${gap}`)).join(" · ")}
    </td>
  );
}
