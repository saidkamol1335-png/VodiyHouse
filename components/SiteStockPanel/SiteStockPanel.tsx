"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FocusEvent, type RefObject } from "react";
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
  return <SiteStockView live={useLiveStock(initial, read)} complexesHref={complexesHref} />;
}

/** Та же панель над чужим живым чтением: главная делит его с карточкой «Свободно на сайте». */
export function SiteStockView({ live, complexesHref }: { live: LiveStock; complexesHref: string }) {
  const t = useTranslations("admin.home.stock");
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

/**
 * «176 свободных квартир на сайте · в 4 ЖК» — как карточка «Свободно на сайте» мокапа. «0» и
 * «0+» читались бы как «почти пусто»: без числа у всех типов — «по планировкам»; свободные только
 * без планировки — их число с пояснением.
 */
function StockTotal({ stock }: { stock: SiteStock }) {
  const t = useTranslations("admin.home.stock");
  const total = siteStockTotal(stock);
  const complexes = stock.complexes.length;
  const extra = total.unassigned > 0 ? t("totalUnassignedSuffix", { count: total.unassigned }) : "";
  if (total.free === 0 && total.partial) {
    const caption = t("totalByLayoutsCaption", { complexes }) + extra;
    return <TotalView value={t("totalByLayouts")} caption={caption} words />;
  }
  if (total.free === 0 && total.unassigned > 0) {
    const caption = t("totalUnassignedCaption", { count: total.unassigned, complexes });
    return <TotalView value={t("total", { count: total.unassigned })} caption={caption} />;
  }
  const value = t(total.partial ? "totalPartial" : "total", { count: total.free });
  return (
    <TotalView
      value={value}
      caption={t("totalCaption", { count: total.free, complexes }) + extra}
    />
  );
}

type TotalViewProps = { value: string; caption: string; words?: boolean };

function TotalView({ value, caption, words = false }: TotalViewProps) {
  return (
    <p className="site-stock__total">
      <span
        className={
          words
            ? "site-stock__total-value site-stock__total-value--words"
            : "site-stock__total-value"
        }
      >
        {value}
      </span>
      <span className="site-stock__total-caption">{caption}</span>
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
  const openId = useOpenRow(stock);
  const focus = useFocusRescue(stock, titleRef);
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
      <ul
        className="site-stock__rows"
        aria-label={t("home.stock.rowsLabel")}
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
      >
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
 * вернувшись, сама не раскроется.
 */
function useOpenRow(stock: SiteStock | null) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (openId !== null && stock && !stock.complexes.some((complex) => complex.id === openId)) {
    setOpenId(null);
  }
  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));
  return { value: openId, toggle };
}

const rowIdOf = (target: EventTarget) =>
  target instanceof Element
    ? (target.closest("[data-complex-id]")?.getAttribute("data-complex-id") ?? null)
    : null;

/**
 * Фокус был в строке ЖК (открытой или нет), а перечитывание её убрало — фокус на заголовок панели,
 * а не в никуда. Удаление элемента в фокусе даёт blur без relatedTarget — такой уход не считаем.
 */
function useFocusRescue(stock: SiteStock | null, titleRef: RefObject<HTMLHeadingElement | null>) {
  const focused = useRef<string | null>(null);
  useEffect(() => {
    const id = focused.current;
    if (id === null || !stock || stock.complexes.some((complex) => complex.id === id)) return;
    focused.current = null;
    if (document.activeElement === document.body) titleRef.current?.focus();
  }, [stock, titleRef]);
  return {
    onFocus: (event: FocusEvent) => {
      focused.current = rowIdOf(event.target);
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      const next = event.relatedTarget;
      if (next && !event.currentTarget.contains(next as Node)) focused.current = null;
    },
  };
}
