"use client";

import { ArrowRight, Play } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import { useMotion, useReveal } from "@/lib/motion";
import type { QuoteWord, ReviewPhoto, Star } from "@/lib/site/reviews/model";
import { useActiveRow, useKey } from "./useReviewsMotion";

export type ReviewRow = {
  id: string;
  name: string;
  role: string;
  rating: string;
  ratingLabel: string;
  stars: Star[];
  words: QuoteWord[];
  photo: ReviewPhoto | null;
  youtubeId: string | null;
  complex: { href: string; name: string } | null;
};

export type ReviewsText = {
  title: string;
  barLeft: string;
  count: string;
  average: string;
  averageLabel: string;
  averageStars: Star[];
  barRight: string;
  cta: string;
  ctaHref: string;
  play: string;
  photoAlt: string;
  keyAlt: string;
};

/** Кадры ключа для lite, телефона и без WebGL — из той же сцены (scripts/frames/key-stills.mjs). */
const KEY_STILL = "/assets/key/1.webp";

/**
 * Сцена отзывов. Ключ — в липкой зоне по центру (full, ≥ 768 px, есть WebGL): Three.js грузится, когда
 * блок в одном экране от окна. Строки идут поверх; активная — у центра экрана: цитата загорается по
 * словам. lite — без Three.js: статичный кадр ключа в шапке, строки — простое проявление, цитаты яркие.
 */
export function ReviewsStage({ rows, text }: { rows: ReviewRow[]; text: ReviewsText }) {
  const tier = useMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = useActiveRow(tier, sectionRef, rows.length);
  useKey(tier, { sectionRef, canvasRef });
  return (
    <section ref={sectionRef} className="reviews" aria-labelledby="reviews-title">
      <ReviewsHead text={text} />
      <div className="reviews__body">
        <div className="reviews__stage" aria-hidden>
          <span className="reviews__glow" />
          <canvas ref={canvasRef} className="reviews__canvas" />
        </div>
        <ol className="reviews__list container">
          {rows.map((row, index) => (
            <Row key={row.id} row={row} active={active === index} text={text} index={index} />
          ))}
        </ol>
        <div className="reviews__cta container">
          <Link href={text.ctaHref} className="button button--primary reviews__cta-link">
            {text.cta}
            <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ReviewsHead({ text }: { text: ReviewsText }) {
  return (
    <div className="reviews__head container">
      <div className="reviews__heading">
        <h2 id="reviews-title" className="reviews__title">
          {text.title}
        </h2>
        {/* eslint-disable-next-line @next/next/no-img-element -- кадр с прозрачным фоном, размер фиксирован CSS */}
        <img
          className="reviews__still"
          src={KEY_STILL}
          alt={text.keyAlt}
          width={640}
          height={150}
          loading="lazy"
          decoding="async"
        />
      </div>
      <p className="reviews__bar">
        <span className="reviews__bar-side">{text.barLeft}</span>
        <span className="reviews__rating">
          <span>{text.count}</span>
          <Stars stars={text.averageStars} label={text.averageLabel} />
          <span>{text.average}</span>
        </span>
        <span className="reviews__bar-side reviews__bar-side--end">{text.barRight}</span>
      </p>
    </div>
  );
}

function Row({
  row,
  active,
  text,
  index,
}: {
  row: ReviewRow;
  active: boolean;
  text: ReviewsText;
  index: number;
}) {
  const reveal = useReveal<HTMLLIElement>();
  return (
    <li
      ref={reveal}
      className={active ? "reviews__row reviews__row--active" : "reviews__row"}
      data-row={index}
    >
      <RowText row={row} />
      {row.photo || row.youtubeId ? (
        <div className="reviews__media">
          {row.youtubeId ? (
            <Video id={row.youtubeId} label={text.play} />
          ) : (
            <Photo photo={row.photo!} alt={text.photoAlt} />
          )}
        </div>
      ) : null}
    </li>
  );
}

function RowText({ row }: { row: ReviewRow }) {
  return (
    <div className="reviews__text">
      <p className="reviews__stars">
        <Stars stars={row.stars} label={row.ratingLabel} />
        <span className="reviews__score" aria-hidden>
          {row.rating}
        </span>
      </p>
      <blockquote className="reviews__quote">
        {row.words.map((word, wordIndex) => (
          <span
            key={wordIndex}
            className={word.accent ? "reviews__word reviews__accent" : "reviews__word"}
            style={{ ["--w" as string]: wordIndex }}
          >
            {`${word.text} `}
          </span>
        ))}
      </blockquote>
      <p className="reviews__author">
        <b className="reviews__name">{row.name}</b>
        <span className="reviews__role">
          {row.role}
          {row.complex ? (
            <>
              {" · "}
              <Link href={row.complex.href} className="reviews__complex">
                {row.complex.name}
              </Link>
            </>
          ) : null}
        </span>
      </p>
    </div>
  );
}

function Photo({ photo, alt }: { photo: ReviewPhoto; alt: string }) {
  return (
    <Image
      className="reviews__photo"
      src={photo.src}
      alt={alt}
      width={photo.width}
      height={photo.height}
      sizes="(max-width: 767px) 92vw, (max-width: 1023px) 34vw, 22vw"
      placeholder={photo.blur ? "blur" : "empty"}
      blurDataURL={photo.blur ?? undefined}
    />
  );
}

/** Видео — постер с кнопкой; плеер youtube-nocookie грузится только по нажатию. */
function Video({ id, label }: { id: string; label: string }) {
  const [playing, setPlaying] = useState(false);
  if (playing) {
    return (
      <iframe
        // Кнопка-постер исчезла — фокус переходит в плеер, а не на <body>.
        ref={(node) => node?.focus()}
        className="reviews__player"
        src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
        title={label}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return (
    <button
      type="button"
      className="reviews__poster"
      aria-label={label}
      onClick={() => setPlaying(true)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- постер YouTube, внешний адрес */}
      <img
        src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
        alt=""
        loading="lazy"
        decoding="async"
      />
      <span className="reviews__play">
        <Play size={22} strokeWidth={1.8} aria-hidden />
      </span>
    </button>
  );
}

function Stars({ stars, label }: { stars: Star[]; label: string }) {
  return (
    <span className="reviews__stars-row" role="img" aria-label={label}>
      {stars.map((star, index) => (
        <span key={index} className={`reviews__star reviews__star--${star}`} aria-hidden />
      ))}
    </span>
  );
}
