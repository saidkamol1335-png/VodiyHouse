"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { LiveStatus } from "@/components/LiveStatus";
import { SiteStockRow } from "@/components/SiteStockRow";
import { complexTabHref } from "@/lib/admin/complexes/tabs";
import { siteStockTotal, type SiteStock } from "@/lib/admin/home/siteStock";
import { useLiveStock, type SiteStockRead } from "@/lib/admin/home/useLiveStock";

type SiteStockPanelProps = {
  /** Цифры страницы сервера; null — сервер не прочитал, панель прочитает сама. */
  initial: SiteStock | null;
  read: SiteStockRead;
  /** Раздел «ЖК» (/admin/zhk или стенд): «Квартиры →» ведёт на вкладку «Квартиры» ЖК. */
  complexesHref: string;
};

/** «Остатки по ЖК» (мокап, Г1 B): итог крупно в шапке, строки ЖК на сайте, «live» (Г4 A). */
export function SiteStockPanel({ initial, read, complexesHref }: SiteStockPanelProps) {
  const t = useTranslations("admin.home.stock");
  const { stock, live, readAt, flashes } = useLiveStock(initial, read);
  return (
    <section className="site-stock" aria-labelledby="site-stock-title">
      <header className="site-stock__head">
        <div className="site-stock__intro">
          <h2 id="site-stock-title" className="site-stock__title">
            {t("title")}
          </h2>
          <p className="site-stock__lead">{t("lead")}</p>
        </div>
        <div className="site-stock__live">
          <LiveStatus live={live} readAt={readAt} />
        </div>
        {stock && stock.complexes.length > 0 ? <StockTotal stock={stock} /> : null}
      </header>
      <StockRows stock={stock} flashes={flashes} complexesHref={complexesHref} />
    </section>
  );
}

/** «176 свободных квартир на сайте · в 4 ЖК» — как карточка «Свободно на сайте» мокапа. */
function StockTotal({ stock }: { stock: SiteStock }) {
  const t = useTranslations("admin.home.stock");
  const total = siteStockTotal(stock);
  return (
    <p className="site-stock__total">
      <span className="site-stock__total-value">
        {t(total.partial ? "totalPartial" : "total", { count: total.free })}
      </span>
      <span className="site-stock__total-caption">
        {t("totalCaption", { count: total.free, complexes: stock.complexes.length })}
      </span>
    </p>
  );
}

type StockRowsProps = {
  stock: SiteStock | null;
  flashes: Readonly<Record<string, number>>;
  complexesHref: string;
};

function StockRows({ stock, flashes, complexesHref }: StockRowsProps) {
  const t = useTranslations("admin");
  const [openId, setOpenId] = useState<string | null>(null);
  if (stock === null) return <p className="site-stock__empty">{t("home.stock.unread")}</p>;
  if (stock.complexes.length === 0) {
    return <p className="site-stock__empty">{t("home.stock.empty")}</p>;
  }
  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));
  return (
    <>
      <ul className="site-stock__rows" aria-label={t("home.stock.rowsLabel")}>
        {stock.complexes.map((complex) => (
          <SiteStockRow
            key={complex.id}
            complex={complex}
            open={complex.id === openId}
            onToggle={toggle}
            flash={flashes[complex.id] ?? 0}
            unitsHref={complexTabHref(`${complexesHref}/${complex.id}`, "units")}
          />
        ))}
      </ul>
      {stock.complexes.some((complex) => complex.stock.partial) ? (
        <p className="site-stock__footnote">{t("complexes.stock.partialHint")}</p>
      ) : null}
    </>
  );
}
