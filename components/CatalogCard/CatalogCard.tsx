"use client";

import { Check, MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PhoneButton } from "@/components/PhoneButton";
import { useSiteContacts } from "@/components/SiteContacts";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { complexRoute } from "@/lib/routes";
import { cardDeadline, cardPays, cardPrice, cardRoomTypes } from "@/lib/site/catalog/card";
import type { CatalogComplex, SiteCatalog } from "@/lib/site/catalog/records";
import { CardFacts, CardPayChips, CardPriceRow, CardTypes } from "./CardDetails";
import { CardMedia } from "./CardMedia";

type CatalogCardProps = {
  complex: CatalogComplex;
  catalog: SiteCatalog;
  /** Первые карточки первого экрана: обложка грузится сразу (LCP). */
  preload?: boolean;
};

/**
 * Карточка ЖК каталога (мокап .jc): фото, застройщик и «Проверено Vodiy House», название — ссылка
 * на всю карточку, адрес и ориентир, срок, этажность и отделка, типы с остатком, способы оплаты,
 * цена «от» в валюте блока (Ф6) и «Платёж от». Без скидок (PLAN §3.13). Связь — только Vodiy House.
 */
export function CatalogCard({ complex, catalog, preload = false }: CatalogCardProps) {
  const t = useTranslations("catalog.card");
  const locale = useLocale() as Locale;
  const { phone } = useSiteContacts();
  const developer = catalog.developers.find((entry) => entry.id === complex.developerId);
  const name = t("name", { name: complex.name[locale] });
  // «Проверено Vodiy House» (И1): разрешение и земля проверены.
  const verified = Boolean(complex.checked.permit && complex.checked.land);
  const floors = Math.max(0, ...complex.blocks.map((block) => block.floorsTotal ?? 0)) || null;
  const finishings = [...new Set(complex.blocks.flatMap((block) => (block.finishing ? [block.finishing.name[locale]] : [])))];
  return (
    <article className="catalog-card">
      <CardMedia
        photos={complex.photos}
        alt={name}
        preload={preload}
        badges={<span className="catalog-card__class">{t(`class.${complex.class}`)}</span>}
      />
      <div className="catalog-card__body">
        <p className="catalog-card__top">
          <span className="catalog-card__developer">{developer?.name}</span>
          {verified ? (
            <span className="catalog-card__verified" title={t("verified")} role="img" aria-label={t("verified")}>
              <Check size={12} strokeWidth={3} aria-hidden />
            </span>
          ) : null}
        </p>
        <h3 className="catalog-card__name">
          <Link href={complexRoute(complex.slug)} className="catalog-card__link">
            {name}
          </Link>
        </h3>
        <CardPlace complex={complex} />
        <CardFacts deadline={cardDeadline(complex)} floors={floors} finishings={finishings} />
        <CardTypes types={cardRoomTypes(complex)} />
        <CardPayChips pays={cardPays(complex, developer)} />
        <div className="catalog-card__bottom">
          <CardPriceRow price={cardPrice(complex, catalog)} />
          {phone ? <PhoneButton phone={phone} className="catalog-card__phone" /> : null}
        </div>
      </div>
    </article>
  );
}

function CardPlace({ complex }: { complex: CatalogComplex }) {
  const t = useTranslations("catalog.card");
  const locale = useLocale() as Locale;
  const address = [complex.location?.name[locale], complex.address?.[locale]].filter(Boolean).join(", ");
  const landmark = complex.landmark?.[locale];
  const parts = [
    landmark ? t("landmark", { mark: landmark }) : null,
    complex.minutesToCenter ? t("toCenter", { n: complex.minutesToCenter }) : null,
  ].filter(Boolean);
  return (
    <>
      {address ? <p className="catalog-card__address">{address}</p> : null}
      {parts.length > 0 ? (
        <p className="catalog-card__landmark">
          <MapPin size={14} strokeWidth={1.9} aria-hidden />
          <span>{parts.join(" · ")}</span>
        </p>
      ) : null}
    </>
  );
}
