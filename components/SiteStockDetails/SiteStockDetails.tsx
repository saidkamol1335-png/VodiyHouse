import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { BlockStock, RoomOffer, SiteStockComplex } from "@/lib/admin/home/siteStock";
import { formatArea, formatPrice } from "@/lib/format";

type Translate = ReturnType<typeof useTranslations<"admin.home.stock">>;

type SiteStockDetailsProps = {
  id: string;
  complex: SiteStockComplex;
  /** «Фергана · застройщик»: на телефоне строка его не показывает (Г5 C) — он здесь. */
  where: string;
  unitsHref: string;
  hidden: boolean;
};

/** Раскрытие строки (Г3 B): ответ клиенту без перехода — типы с «от», блоки, «Квартиры →». */
export function SiteStockDetails({ id, complex, where, unitsHref, hidden }: SiteStockDetailsProps) {
  const t = useTranslations("admin.home.stock");
  return (
    <div id={id} className="site-stock-details" hidden={hidden}>
      <p className="site-stock-details__where">{where}</p>
      <div className="site-stock-details__section site-stock-details__section--types">
        <h3 className="site-stock-details__label">{t("types")}</h3>
        <OfferList offers={complex.offers} unassigned={complex.unassigned} t={t} />
      </div>
      {complex.blocks.length > 0 ? (
        <div className="site-stock-details__section">
          <h3 className="site-stock-details__label">{t("blocks")}</h3>
          <p className="site-stock-details__blocks">
            {complex.blocks.map((block) => blockText(block, t)).join(" · ")}
          </p>
          {complex.unassigned > 0 ? (
            <p className="site-stock-details__note">
              {t("unassigned", { count: complex.unassigned })}
            </p>
          ) : null}
        </div>
      ) : null}
      <Link className="site-stock-details__link" href={unitsHref}>
        {t("toUnits")}
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </div>
  );
}

type OfferListProps = { offers: readonly RoomOffer[]; unassigned: number; t: Translate };

function OfferList({ offers, unassigned, t }: OfferListProps) {
  if (offers.length === 0) {
    // Свободные есть, но без планировки — не «распродано».
    return (
      <p className="site-stock-details__none">{t(unassigned > 0 ? "noTypesYet" : "noneFree")}</p>
    );
  }
  return (
    <ul className="site-stock-details__offers">
      {offers.map((offer) => (
        <li key={offer.group} className="site-stock-details__offer">
          <span className="site-stock-details__type">{t(`type.${offer.group}`)}</span>
          {/* На телефоне — одной строкой с переносом, на десктопе — колонками таблицы. */}
          <span className="site-stock-details__facts">
            <span className="site-stock-details__free">{freeText(offer, t)}</span>
            <span className="site-stock-details__price">{priceText(offer, t)}</span>
            <span className="site-stock-details__area">
              {offer.areaFrom === null ? "" : t("areaFrom", { area: formatArea(offer.areaFrom) })}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** «22»; у типа по планировкам — «18+» (известные в блоках со списком) или «по планировкам». */
function freeText(offer: RoomOffer, t: Translate): string {
  if (offer.free !== null) return t("free", { count: offer.free });
  return offer.known > 0 ? t("freeKnown", { count: offer.known }) : t("byLayouts");
}

/** «от $40 270», в двух валютах — «от $37 200 · от 450 000 000 сум»; без цен — «по запросу». */
function priceText(offer: RoomOffer, t: Translate): string {
  if (offer.prices.length === 0) return t("priceOnRequest");
  return offer.prices
    .map((price) => t("priceFrom", { price: formatPrice(price.amount, price.currency) }))
    .join(" · ");
}

/** «Бл. A: 12»; без списка квартир — «по планировкам» или «нет в наличии». */
function blockText(block: BlockStock, t: Translate): string {
  const free =
    block.free !== null
      ? t("free", { count: block.free })
      : t(block.available ? "byLayouts" : "blockNone");
  return t("block", { name: block.name, free });
}
