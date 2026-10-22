"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type RefObject } from "react";
import { LiveStatus } from "@/components/LiveStatus";
import { SiteStockRow } from "@/components/SiteStockRow";
import { complexTabHref } from "@/lib/admin/complexes/tabs";
import type { LiveStock } from "@/lib/admin/home/liveStock";
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
  const live = useLiveStock(initial, read);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { stock } = live;
  return (
    <section className="site-stock" aria-labelledby="site-stock-title">
      <header className="site-stock__head">
        <div className="site-stock__intro">
          {/* tabIndex -1: сюда уходит фокус, если открытую строку убрало перечитывание. */}
          <h2 id="site-stock-title" className="site-stock__title" ref={titleRef} tabIndex={-1}>
            {t("title")}
          </h2>
          <p className="site-stock__lead">{t("lead")}</p>
        </div>
        <div className="site-stock__live">
          <LiveStatus live={live.live} readAt={live.readAt} halted={live.halted} />
        </div>
        {stock && stock.complexes.length > 0 ? <StockTotal stock={stock} /> : null}
      </header>
      <StockRows live={live} complexesHref={complexesHref} titleRef={titleRef} />
    </section>
  );
}

/** «176 свободных квартир на сайте · в 4 ЖК» — как карточка «Свободно на сайте» мокапа. */
function StockTotal({ stock }: { stock: SiteStock }) {
  const t = useTranslations("admin.home.stock");
  const total = siteStockTotal(stock);
  const complexes = stock.complexes.length;
  // Числа нет ни у одного типа (все блоки без списка квартир): «0+» читалось бы как «почти пусто».
  if (total.free === 0 && total.partial) {
    return (
      <p className="site-stock__total">
        <span className="site-stock__total-value site-stock__total-value--words">
          {t("totalByLayouts")}
        </span>
        <span className="site-stock__total-caption">
          {t("totalByLayoutsCaption", { complexes })}
        </span>
      </p>
    );
  }
  return (
    <p className="site-stock__total">
      <span className="site-stock__total-value">
        {t(total.partial ? "totalPartial" : "total", { count: total.free })}
      </span>
      <span className="site-stock__total-caption">
        {t("totalCaption", { count: total.free, complexes })}
      </span>
    </p>
  );
}

type StockRowsProps = {
  live: LiveStock;
  complexesHref: string;
  titleRef: RefObject<HTMLHeadingElement | null>;
};

function StockRows({ live, complexesHref, titleRef }: StockRowsProps) {
  const t = useTranslations("admin");
  const { stock, flashes } = live;
  const openId = useOpenRow(stock, titleRef);
  if (stock === null) {
    return (
      <p className="site-stock__empty">
        {t(live.halted ? "home.stock.unreadHalted" : "home.stock.unread")}
      </p>
    );
  }
  if (stock.complexes.length === 0) {
    return <p className="site-stock__empty">{t("home.stock.empty")}</p>;
  }
  return (
    <>
      <ul className="site-stock__rows" aria-label={t("home.stock.rowsLabel")}>
        {stock.complexes.map((complex) => (
          <SiteStockRow
            key={complex.id}
            complex={complex}
            open={complex.id === openId.value}
            onToggle={openId.toggle}
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

/**
 * Открыта одна строка. Перечитывание убрало открытый ЖК (сняли с сайта) — строка закрыта и,
 * вернувшись, сама не раскроется; фокус, оставшийся в ней, — на заголовок панели, не в никуда.
 */
function useOpenRow(stock: SiteStock | null, titleRef: RefObject<HTMLHeadingElement | null>) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [lostCount, setLostCount] = useState(0);
  if (openId !== null && stock && !stock.complexes.some((complex) => complex.id === openId)) {
    setOpenId(null);
    setLostCount((count) => count + 1);
  }
  // Номер обработанной потери: повторный показ страницы (Activity) не должен отбирать фокус.
  const handled = useRef(0);
  useEffect(() => {
    if (lostCount === handled.current) return;
    handled.current = lostCount;
    if (document.activeElement === document.body) titleRef.current?.focus();
  }, [lostCount, titleRef]);
  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));
  return { value: openId, toggle };
}
