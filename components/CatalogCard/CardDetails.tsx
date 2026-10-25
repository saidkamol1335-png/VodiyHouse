"use client";

import { useLocale, useTranslations } from "next-intl";
import { Badge, type BadgeTone } from "@/components/Badge";
import { formatArea, formatPrice } from "@/lib/format";
import type { Locale } from "@/lib/i18n/routing";
import type { CardDeadline, CardPays, CardPrice, CardRoomType } from "@/lib/site/catalog/card";

// Строки тела карточки ЖК (мокап .jc__facts, .jc__types, .jc__pays, .jc__price): только вывод —
// числа считает lib/site/catalog/card.ts.

/** «Мало осталось» — янтарная плашка, как в мокапе (3 и меньше). */
const FEW_LEFT = 3;

function useRoomsLabel() {
  const t = useTranslations("catalog.card");
  return (rooms: number) => (rooms <= 4 ? t(`rooms.${rooms as 0 | 1 | 2 | 3 | 4}`) : t("rooms.more", { n: rooms }));
}

export function CardFacts({ deadline, floors, finishings }: { deadline: CardDeadline; floors: number | null; finishings: string[] }) {
  const t = useTranslations("catalog.card");
  const quarter = deadline?.kind === "until" ? t("quarter", { q: deadline.quarter, year: deadline.year }) : null;
  const deadlineText =
    deadline?.kind === "built" ? t("built") : deadline?.partlyBuilt ? t("partBuilt", { q: quarter ?? "" }) : quarter;
  return (
    <p className="catalog-card__facts">
      {deadlineText ? (
        <span>
          {t("deadline")}: <b className="catalog-card__fact-value">{deadlineText}</b>
        </span>
      ) : null}
      {floors ? <span>{t("floors", { n: floors })}</span> : null}
      {finishings.length > 0 ? <span>{finishings.join(" / ")}</span> : null}
    </p>
  );
}

function leftBadge(type: CardRoomType): { tone: BadgeTone; key: "left" | "leftUnknown" | "leftNone" } {
  if (!type.available) return { tone: "line", key: "leftNone" };
  if (type.free === null) return { tone: "ok", key: "leftUnknown" };
  return { tone: type.free <= FEW_LEFT ? "amber" : "ok", key: "left" };
}

export function CardTypes({ types }: { types: CardRoomType[] }) {
  const t = useTranslations("catalog.card");
  const locale = useLocale() as Locale;
  const roomsLabel = useRoomsLabel();
  return (
    <ul className="catalog-card__types">
      {types.map((type) => {
        const badge = leftBadge(type);
        const label = type.areaFrom === null
          ? roomsLabel(type.rooms)
          : t("typeFrom", { rooms: roomsLabel(type.rooms), area: formatArea(type.areaFrom, locale) });
        return (
          <li key={type.rooms} className="catalog-card__type">
            <span>{label}</span>
            <Badge tone={badge.tone} size="sm">
              {t(badge.key, { n: type.free ?? 0 })}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}

export function CardPayChips({ pays }: { pays: CardPays }) {
  const t = useTranslations("catalog.card");
  const locale = useLocale() as Locale;
  const chips = [
    ...(pays.full ? [t("payFull")] : []),
    ...(pays.installmentMonths ? [t("installmentUpTo", { n: pays.installmentMonths })] : []),
    ...pays.banks.map((bank) => bank[locale]),
  ];
  if (chips.length === 0) return null;
  return (
    <p className="catalog-card__pays">
      {chips.map((chip) => (
        <Badge key={chip} tone="line" size="sm">
          {chip}
        </Badge>
      ))}
    </p>
  );
}

export function CardPriceRow({ price }: { price: CardPrice | null }) {
  const t = useTranslations("catalog.card");
  const locale = useLocale() as Locale;
  if (!price) return <p className="catalog-card__price">{t("priceOnRequest")}</p>;
  const money = (amount: number) => formatPrice(amount, price.currency, locale);
  return (
    <>
      <p className="catalog-card__price">
        <span className="catalog-card__amount">{t("priceFrom", { price: money(price.amount) })}</span>
        {price.perM2 ? <span className="catalog-card__per-m2">{t("perM2From", { price: money(price.perM2) })}</span> : null}
      </p>
      {price.payment ? <p className="catalog-card__monthly">{t("monthlyFrom", { price: money(price.payment) })}</p> : null}
    </>
  );
}
