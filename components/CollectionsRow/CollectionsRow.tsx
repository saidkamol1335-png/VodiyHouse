"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import { SitePhoto } from "@/components/SitePhoto";
import type { Locale } from "@/lib/i18n/routing";
import { getMotionTier } from "@/lib/motion";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { collectionComplexes, collectionCount, coverOf } from "@/lib/site/showcase/model";
import type { ShowcaseCollection } from "@/lib/site/showcase/records";

type CollectionsRowProps = {
  catalog: SiteCatalog;
  collections: readonly ShowcaseCollection[];
  /** id применённой подборки — её карточка отмечена. */
  selected: string | null;
  onPick: (collection: ShowcaseCollection) => void;
};

const SIZES = "(max-width: 760px) 82vw, 440px";

/** Где лента: у края стрелка и затухание с той стороны прячутся; all — всё влезло, стрелок нет. */
type Edge = "start" | "middle" | "end" | "all";

function edgeOf(node: HTMLElement): Edge {
  const max = node.scrollWidth - node.clientWidth;
  if (max <= 2) return "all";
  if (node.scrollLeft <= 2) return "start";
  return node.scrollLeft >= max - 2 ? "end" : "middle";
}

/** Край ленты — при прокрутке и смене ширины (ResizeObserver сообщает и первый размер). */
function useEdge(track: RefObject<HTMLUListElement | null>) {
  const [edge, setEdge] = useState<Edge>("start");
  const update = () => {
    if (track.current) setEdge(edgeOf(track.current));
  };
  useEffect(() => {
    const node = track.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setEdge(edgeOf(node)));
    observer.observe(node);
    return () => observer.disconnect();
  }, [track]);
  return { edge, update };
}

/**
 * Подборки ЖК (мокап .sec + .collx/.coll): заголовок раздела и лента тёмных карточек-фото с
 * прокруткой, затуханием по краям и стрелками. Клик применяет подборку к каталогу ниже
 * (CatalogResults), выбранная карточка отмечена. Плавная прокрутка — только в full (§3).
 */
export function CollectionsRow({ catalog, collections, selected, onPick }: CollectionsRowProps) {
  const t = useTranslations("showcase.collections");
  const track = useRef<HTMLUListElement>(null);
  const { edge, update } = useEdge(track);
  const step = (direction: -1 | 1) => {
    const node = track.current;
    const card = node?.firstElementChild;
    if (!node || !(card instanceof HTMLElement)) return;
    const gap = parseFloat(getComputedStyle(node).columnGap) || 0;
    node.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: getMotionTier() === "full" ? "smooth" : "auto" });
  };
  return (
    <section className="collections" aria-labelledby="collections-title">
      <div className="collections__head">
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <div id="collections-title" className="collections__title">
          <Heading level={2} accent={t("titleAccent")}>
            {t("title")}
          </Heading>
        </div>
        <p className="collections__lead">{t("lead")}</p>
      </div>
      <div className="collections__viewport" data-edge={edge}>
        <ul ref={track} className="collections__row" aria-label={t("label")} onScroll={update}>
          {collections.map((collection, index) => (
            <CollectionCard key={collection.id} catalog={catalog} collection={collection} index={index} selected={collection.id === selected} onPick={onPick} />
          ))}
        </ul>
        <button type="button" className="collections__arrow collections__arrow--prev" aria-label={t("prev")} onClick={() => step(-1)}>
          <ArrowLeft size={22} strokeWidth={2} aria-hidden />
        </button>
        <button type="button" className="collections__arrow collections__arrow--next" aria-label={t("next")} onClick={() => step(1)}>
          <ArrowRight size={22} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </section>
  );
}

type CollectionCardProps = {
  catalog: SiteCatalog;
  collection: ShowcaseCollection;
  index: number;
  selected: boolean;
  onPick: (collection: ShowcaseCollection) => void;
};

/** Карточка (мокап .coll__c): фото первого ЖК или своя обложка, «01 · 4 ЖК», название, «N квартир в продаже». */
function CollectionCard({ catalog, collection, index, selected, onPick }: CollectionCardProps) {
  const t = useTranslations("showcase.collections");
  const locale = useLocale() as Locale;
  const count = collectionCount(catalog, collection);
  const cover = coverOf(collection.cover, collectionComplexes(catalog, collection));
  return (
    <li className="collections__item">
      <button
        type="button"
        className={selected ? "collections__card collections__card--on" : "collections__card"}
        aria-pressed={selected}
        data-collection={collection.slug}
        onClick={() => onPick(collection)}
      >
        {cover ? <SitePhoto photo={cover} alt="" frame="phone" sizes={SIZES} className="collections__photo" /> : null}
        <span className="collections__top">
          <span>{String(index + 1).padStart(2, "0")}</span>
          <span>{t("complexes", { n: count.complexes })}</span>
        </span>
        <span className="collections__name">{collection.title[locale]}</span>
        <span className="collections__bottom">
          <span>{count.partial ? t("flatsMin", { n: count.flats }) : t("flats", { n: count.flats })}</span>
          <span className="collections__go" aria-hidden="true">
            <ArrowRight size={16} strokeWidth={2} />
          </span>
        </span>
      </button>
    </li>
  );
}
