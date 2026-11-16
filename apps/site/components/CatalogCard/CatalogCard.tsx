"use client";

import { Check, MapPin, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { FavoriteButton } from "@/components/FavoriteButton";
import { LeadButton } from "@/components/LeadDialog";
import type { LeadIntent } from "@/components/LeadForm";
import { ShareButton } from "@/components/ShareButton";
import { useSiteContacts } from "@/components/SiteContacts";
import { TelegramButton } from "@/components/TelegramButton";
import type { LocalizedText } from "@/lib/contacts";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { formatMonthName } from "@vh/shared/format";
import { complexRoute } from "@/lib/routes";
import { cardDeadline, cardPays, cardPrice, cardRoomTypes } from "@/lib/site/catalog/card";
import type { CatalogComplex, SiteCatalog } from "@/lib/site/catalog/records";
import { CardFacts, CardPayChips, CardPriceRow, CardSoonRow, CardTypes } from "./CardDetails";
import { CardMedia, type CardFrame } from "./CardMedia";

type CatalogCardProps = {
  complex: CatalogComplex;
  catalog: SiteCatalog;
  /** Первые карточки первого экрана: обложка грузится сразу (LCP). */
  preload?: boolean;
  /** Бейдж спецпредложения (витрина, 3.16б) — пилюля на фото перед классом. */
  badge?: LocalizedText | null;
};

/** Кадры карточки: обложка, кадр стройки из последнего отчёта (мокап cardShots), остальные фото ЖК. */
function cardFrames(complex: CatalogComplex, caption: string): CardFrame[] {
  const [cover, ...rest] = complex.photos;
  if (!cover || !complex.progress) return complex.photos;
  return [cover, { ...complex.progress.photo, caption, alt: { ru: caption, uz: caption } }, ...rest];
}

/**
 * Карточка ЖК каталога (мокап .jc): фото, застройщик и «Проверено Vodiy House», название — ссылка
 * на всю карточку, адрес и ориентир, срок, этажность и отделка, типы с остатком, способы оплаты,
 * цена «от» в валюте блока (Ф6) и за м², заявка менеджеру и Telegram (правки 15.11, п. 9 и 12).
 * Без скидок (PLAN §3.13). Связь — только Vodiy House.
 */
export function CatalogCard({ complex, catalog, preload = false, badge = null }: CatalogCardProps) {
  const t = useTranslations("catalog.card");
  const locale = useLocale() as Locale;
  const { phone } = useSiteContacts();
  const developer = catalog.developers.find((entry) => entry.id === complex.developerId);
  const name = t("name", { name: complex.name[locale] });
  // «Проверено Vodiy House» (И1): разрешение и земля проверены.
  const verified = Boolean(complex.checked.permit && complex.checked.land);
  const floors = Math.max(0, ...complex.blocks.map((block) => block.floorsTotal ?? 0)) || null;
  const finishings = [...new Set(complex.blocks.flatMap((block) => (block.finishing ? [block.finishing.name[locale]] : [])))];
  const soon = complex.state === "soon";
  return (
    <article className="catalog-card" data-track-entity={`complex:${complex.id}`}>
      <CardMedia photos={cardFrames(complex, t("progressCaption", { month: formatMonthName(complex.progress?.month ?? "", locale) }))} alt={name} preload={preload} badges={<CardBadges complex={complex} badge={badge} />} tools={<CardTools complex={complex} name={name} />} />
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
        {soon ? null : <CardTypes types={cardRoomTypes(complex)} />}
        <CardPayChips pays={cardPays(complex, developer)} />
        <div className="catalog-card__bottom">
          {soon ? <CardSoonRow phone={phone} /> : <CardPriceRow price={cardPrice(complex, catalog)} />}
          <CardButtons intent={{ type: "callback", object: { complex: complex.slug }, context: name }} />
        </div>
      </div>
    </article>
  );
}

/** Пилюли на фото: бейдж спецпредложения (витрина) перед классом ЖК (мокап .jc__badges). */
function CardBadges({ complex, badge }: { complex: CatalogComplex; badge: LocalizedText | null }) {
  const t = useTranslations("catalog.card");
  const locale = useLocale() as Locale;
  return (
    <>
      {complex.state === "soon" ? <span className="catalog-card__soon">{t("soonBadge")}</span> : null}
      {badge ? <span className="catalog-card__promo">{badge[locale]}</span> : null}
      {complex.class ? <span className="catalog-card__class">{t(`class.${complex.class}`)}</span> : null}
    </>
  );
}

/** Сердце и «Поделиться» на фото — над растянутой ссылкой карточки. */
function CardTools({ complex, name }: { complex: CatalogComplex; name: string }) {
  const locale = useLocale() as Locale;
  const address = [complex.location?.name[locale], complex.address?.[locale]].filter(Boolean).join(", ");
  return (
    <>
      <FavoriteButton slug={complex.slug} name={name} />
      <ShareButton share={{ path: `/${locale}${complexRoute(complex.slug)}`, title: name, text: address, photo: complex.photos[0] ?? null }} />
    </>
  );
}

/**
 * Одна кнопка — заявка менеджеру Vodiy House — и значок Telegram (правки 15.11, п. 12: «одной кнопки
 * хватит»; было «Показать телефон», «Перезвоните мне» и Telegram, ТЗ 6.2). Текст кнопки временный —
 * TODO-заказчик: согласовать. Над растянутой ссылкой карточки; связь — только Vodiy House (правило 1.2).
 */
function CardButtons({ intent }: { intent: LeadIntent }) {
  const t = useTranslations("lead.buttons");
  const tCard = useTranslations("catalog.card");
  return (
    <div className="catalog-card__buttons">
      <LeadButton intent={intent} size="sm" className="catalog-card__ask">
        {tCard("askManager")}
      </LeadButton>
      <TelegramButton object={intent.object ?? {}} className="catalog-card__telegram" aria-label={t("telegram")}>
        <Send size={16} strokeWidth={1.9} aria-hidden />
      </TelegramButton>
    </div>
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
          <MapPin className="catalog-card__landmark-icon" size={14} strokeWidth={1.9} aria-hidden />
          <span>{parts.join(" · ")}</span>
        </p>
      ) : null}
    </>
  );
}
