"use client";

import { Phone } from "lucide-react";
import { getImageProps } from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import { LeadButton } from "@/components/LeadDialog";
import { formatPhone, phoneHref } from "@/lib/contacts";
import type { Locale } from "@/lib/i18n/routing";
import { mediaPublicUrl } from "@/lib/media";
import type { CatalogPhoto } from "@/lib/site/catalog/records";
import type { ShowcaseAd } from "@/lib/site/showcase/records";
import { useAdView } from "@/lib/site/showcase/useAdView";

type AdBannerProps = {
  ad: ShowcaseAd;
  /** Телефон Vodiy House (+998…); нет — у «телефонной» рекламы кнопка заявки. */
  phone: string | null;
  /**
   * slide — слайдер на главной; slot — место в сетке каталога (вся строка); top — над списком каталога
   * (п. 13, 20.11): и на телефоне — тонкая картинка 3:1, «не такой толстый».
   */
  variant: "slide" | "slot" | "top";
  /** false — повтор той же рекламы ниже в каталоге: показ (ad_view) уже засчитан первым баннером. */
  countView?: boolean;
};

/** Баннер на ПК не шире контейнера (1200 px), на телефоне — во всю ширину. */
const SIZES = "(max-width: 1240px) 100vw, 1200px";
const PHONE_MEDIA = "(max-width: 640px)";

const srcOf = (photo: CatalogPhoto) => mediaPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", photo.path);

/**
 * Реклама — баннер (правки 15.11, п. 4 + 13): картинка для ПК и для телефона (`<picture>`), метка
 * «Reklama», под картинкой — рекламодатель (застройщик или другая компания, 20.11) и одна кнопка: телефон Vodiy House или «Ariza qoldirish»
 * (заявка типа «Реклама»). Контактов застройщика нет (ТЗ 1.2): на файле их нет — руководитель отмечает
 * это при загрузке. Показ — ad_view, заявка — ad_click, звонок — phone_click с рекламой (data-track-entity).
 */
export function AdBanner({ ad, phone, variant, countView = true }: AdBannerProps) {
  const t = useTranslations("showcase.banner");
  const locale = useLocale() as Locale;
  const root = useRef<HTMLElement>(null);
  useAdView(root, countView ? ad.id : null);
  const alt = ad.title[locale];
  const mobile = variant === "top" ? null : ad.bannerMobile;
  const {
    props: { srcSet: desktopSet, ...image },
  } = getImageProps({ src: srcOf(ad.banner), alt, width: ad.banner.width, height: ad.banner.height, sizes: SIZES });
  const mobileSet = mobile
    ? getImageProps({ src: srcOf(mobile), alt, width: mobile.width, height: mobile.height, sizes: "100vw" }).props.srcSet
    : null;
  const classes = ["ad-banner", `ad-banner--${variant}`, mobile ? "ad-banner--phone-art" : null].filter(Boolean).join(" ");
  return (
    <article ref={root} className={classes} data-track-entity={`ad:${ad.id}`} aria-label={t("label", { advertiser: ad.advertiser })}>
      <div className="ad-banner__media">
        <picture>
          {mobileSet ? <source media={PHONE_MEDIA} srcSet={mobileSet} sizes="100vw" /> : null}
          {/* eslint-disable-next-line jsx-a11y/alt-text -- alt приходит в image из getImageProps */}
          <img {...image} srcSet={desktopSet} className="ad-banner__image" loading={variant === "top" ? "eager" : "lazy"} decoding="async" />
        </picture>
        <span className="ad-banner__tag">{t("tag")}</span>
      </div>
      <div className="ad-banner__bar">
        <p className="ad-banner__advertiser">{ad.advertiser}</p>
        <AdBannerCta ad={ad} phone={phone} alt={alt} />
      </div>
    </article>
  );
}

/** Кнопка под баннером: телефон Vodiy House (tel:) или заявка «Реклама» — с рекламодателем и названием. */
function AdBannerCta({ ad, phone, alt }: { ad: ShowcaseAd; phone: string | null; alt: string }) {
  const t = useTranslations("showcase.banner");
  return (
    <div className="ad-banner__cta">
      {ad.cta === "phone" && phone ? (
        <a href={phoneHref(phone)} className="button button--primary ad-banner__call">
          <Phone size={16} strokeWidth={2} aria-hidden />
          <span>{t("call")}</span>
          <span className="ad-banner__number">{formatPhone(phone)}</span>
        </a>
      ) : (
        <span className="ad-banner__lead" data-track="ad_click">
          <LeadButton
            intent={{
              type: "ad",
              object: ad.developer ? { developer: ad.developer.slug } : {},
              context: ad.advertiser,
              // Менеджеру — чья реклама и какая (рекламодатель может быть не застройщиком, 20.11).
              promo: { title: `${ad.advertiser} · ${alt}` },
            }}
          />
        </span>
      )}
    </div>
  );
}
