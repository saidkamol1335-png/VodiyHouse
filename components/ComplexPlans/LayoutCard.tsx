"use client";

import { Calculator, Maximize2 } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { Ref } from "react";
import { LeadButton } from "@/components/LeadDialog";
import type { LeadIntent } from "@/components/LeadForm";
import { formatArea, formatPrice } from "@/lib/format";
import type { Locale } from "@/lib/i18n/routing";
import { mediaPublicUrl } from "@/lib/media";
import type { LayoutCard as LayoutCardModel } from "@/lib/site/complex/layouts";

type LayoutCardProps = {
  card: LayoutCardModel;
  open: boolean;
  pending: boolean;
  failed: boolean;
  opener: Ref<HTMLButtonElement>;
  onCalculate: () => void;
  onZoom: () => void;
  /** «Узнать о наличии» (ТЗ 10.1): заявка по этой планировке. */
  ask: LeadIntent;
};

export const drawingSrc = (path: string) => mediaPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", path);

export function useLayoutTitle() {
  const t = useTranslations("complex");
  const locale = useLocale() as Locale;
  return (card: LayoutCardModel) => {
    const { rooms, area } = card.layout;
    const roomsText = rooms <= 4 ? t(`rooms.${rooms as 0 | 1 | 2 | 3 | 4}`) : t("rooms.more", { n: rooms });
    return t("layouts.card", { rooms: roomsText, area: formatArea(area, locale) });
  };
}

function leftBadge(card: LayoutCardModel) {
  const { left } = card;
  if (left.kind === "none") return { key: "none" as const, tone: "none", n: 0 };
  if (left.kind === "inStock") return { key: "inStock" as const, tone: "ok", n: 0 };
  return { key: "left" as const, tone: left.few ? "few" : "ok", n: left.count };
}

/**
 * Карточка планировки (мокап .plan; телефон — .pl): чертёж (нажатие — крупно), «1-комн. · 42,5 м²»
 * и остаток, блок и этажи, цена «от» и за м², «Платёж от», «Рассчитать платёж» и «Узнать о
 * наличии» (мокап .plan__btns).
 */
export function LayoutCard({ card, open, pending, failed, opener, onCalculate, onZoom, ask }: LayoutCardProps) {
  const t = useTranslations("complex.layouts");
  const title = useLayoutTitle()(card);
  const { layout } = card;
  const modifier = open ? " complex-layout--open" : card.left.kind === "none" ? " complex-layout--none" : "";
  return (
    <article className={`complex-layout${modifier}`} data-layout-id={layout.id}>
      <button type="button" className="complex-layout__drawing" aria-label={t("zoom", { title })} onClick={onZoom}>
        {layout.drawing ? (
          <Image src={drawingSrc(layout.drawing.path)} alt={title} fill sizes="(max-width: 760px) 116px, 300px" className="complex-layout__image" />
        ) : null}
        <span className="complex-layout__zoom" aria-hidden="true">
          <Maximize2 size={14} strokeWidth={2} />
        </span>
      </button>
      <LayoutBody card={card} title={title} />
      <div className="complex-layout__actions">
        {card.calculable ? (
          <button ref={opener} type="button" className="complex-layout__calc" aria-expanded={open} disabled={pending} onClick={onCalculate}>
            <Calculator size={15} strokeWidth={2} aria-hidden />
            {/* Открытый расчёт — «Свернуть» (мокап pcClose): повторное нажатие закрывает его. */}
            <span className="complex-layout__calc-full">{pending ? t("loading") : open ? t("collapse") : t("calculate")}</span>
            <span className="complex-layout__calc-short">{pending ? t("loading") : open ? t("collapse") : t("calculateShort")}</span>
          </button>
        ) : null}
        <LeadButton intent={{ ...ask, context: `${ask.context} · ${title}` }} variant="ghost" size="sm" className="complex-layout__ask" />
        {failed ? (
          <p className="complex-layout__failed" role="alert">
            {t("failed")}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function LayoutBody({ card, title }: { card: LayoutCardModel; title: string }) {
  const t = useTranslations("complex.layouts");
  const locale = useLocale() as Locale;
  const badge = leftBadge(card);
  const { floors } = card.layout;
  const money = (amount: number) => formatPrice(amount, card.currency, locale);
  const meta = floors
    ? floors.from === floors.to
      ? t("metaFloor", { block: card.blockName, floor: floors.from })
      : t("metaFloors", { block: card.blockName, from: floors.from, to: floors.to })
    : t("meta", { block: card.blockName });
  return (
    <div className="complex-layout__body">
      <div className="complex-layout__top">
        <h3 className="complex-layout__title">{title}</h3>
        <span className={`complex-layout__left complex-layout__left--${badge.tone}`}>{t(badge.key, { n: badge.n })}</span>
      </div>
      <p className="complex-layout__meta">{meta}</p>
      <p className="complex-layout__price">
        {card.price ? (
          <>
            <b>{t("priceFrom", { price: money(card.price.amount) })}</b>
            <span>{t("perM2From", { price: money(card.price.perM2) })}</span>
          </>
        ) : (
          // Всё продано — «Нет в наличии» (мокап plNone), не «по запросу»: узнавать нечего.
          <b>{card.left.kind === "none" ? t("noneTitle") : t("priceOnRequest")}</b>
        )}
      </p>
      {card.payment ? <p className="complex-layout__monthly">{t("monthlyFrom", { price: money(card.payment) })}</p> : null}
    </div>
  );
}
