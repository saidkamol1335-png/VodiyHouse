"use client";

import { SitePhoto } from "@/components/SitePhoto";
import { Link } from "@/lib/i18n/navigation";
import { complexRoute } from "@/lib/routes";
import type { ProjectWidth } from "@/lib/site/home/projects";
import type { JkGalleryCard, JkGalleryOffer } from "./JkGalleryTrack";

const SIZES: Record<ProjectWidth, string> = {
  base: "(max-width: 767px) 86vw, 60vw",
  wide: "(max-width: 767px) 86vw, 70vw",
};

/** Карточка ленты: фото, название и предложение под ним, подписи в углах. */
export function GalleryCard({ card }: { card: JkGalleryCard }) {
  return (
    <li className={`jk-gallery__card jk-gallery__card--${card.width}`}>
      <Link href={complexRoute(card.slug)} className="jk-gallery__link">
        {/* Имя ссылки — название (видимое уходит в параллакс и скрыто от диктора) и подписи в углах. */}
        <span className="sr-only">{card.label}</span>
        <span className="jk-gallery__media">
          <SitePhoto
            photo={card.photo}
            alt={card.alt}
            frame="cover"
            sizes={SIZES[card.width]}
            className="jk-gallery__photo"
          />
        </span>
        <span className="jk-gallery__caption" aria-hidden>
          <span className="jk-gallery__title">{card.name}</span>
          {card.offer ? <GalleryOffer offer={card.offer} /> : null}
        </span>
        <Meta corner="tl" value={card.meta.place} />
        <Meta corner="tr" value={card.meta.developer} />
        <Meta corner="bl" value={card.meta.price} />
        <Meta corner="br" value={card.meta.deadline} />
      </Link>
    </li>
  );
}

/** Предложение под названием: бейдж, заголовок, текст (на телефоне — без него) и срок. */
function GalleryOffer({ offer }: { offer: JkGalleryOffer }) {
  return (
    <span className={`jk-gallery__offer${offer.badge ? " jk-gallery__offer--special" : ""}`}>
      {offer.badge ? <span className="jk-gallery__badge">{offer.badge}</span> : null}
      <span className="jk-gallery__offer-title">{offer.title}</span>
      {offer.text ? <span className="jk-gallery__offer-text">{offer.text}</span> : null}
      {offer.until ? (
        <span className={`jk-gallery__until${offer.hot ? " jk-gallery__until--hot" : ""}`}>
          {offer.until}
        </span>
      ) : null}
    </span>
  );
}

function Meta({ corner, value }: { corner: "tl" | "tr" | "bl" | "br"; value: string | null }) {
  if (!value) return null;
  return <span className={`jk-gallery__meta jk-gallery__meta--${corner}`}>{value}</span>;
}

