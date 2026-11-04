import { Check } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { HeroStat, HeroText } from "./types";

type HeroFactsProps = {
  text: HeroText;
  /** Цифры из каталога; пусто — каталог не прочитался, экран без цифр. */
  stats: readonly HeroStat[];
  /** «Найдено сейчас» (HeroQuickPick) — плашка справа от цифр. */
  found: ReactNode;
  /** id подписи «иллюстративный характер»: на неё ссылается группа рендеров. */
  noteId: string;
};

/**
 * Полоса под горизонтом: диск-горизонт с подписью «Визуализации носят иллюстративный характер»
 * (__horizon — в сцене опускается, освобождая место рамкам), три «бесплатно» (уходят), цифры каталога
 * (у квартир — точка «live») и «Найдено сейчас». Цвет диска — фон страницы.
 */
export function HeroFacts({ text, stats, found, noteId }: HeroFactsProps) {
  return (
    <div className="home-hero__ledger">
      <div className="home-hero__horizon">
        <div className="home-hero__disc" aria-hidden="true" />
        <p id={noteId} className="home-hero__note">
          {text.slides.note}
        </p>
      </div>
      <ul className="home-hero__perks">
        {text.perks.map((perk) => (
          <li key={perk} className="home-hero__perk">
            <Check size={15} aria-hidden="true" />
            {perk}
          </li>
        ))}
      </ul>
      {stats.length > 0 || found ? (
        <div className="home-hero__facts-row">
          {stats.length > 0 ? <HeroStats stats={stats} label={text.statsLabel} /> : null}
          {found}
        </div>
      ) : null}
    </div>
  );
}

/** Число над подписью на экране; в разметке подпись (dt) первая — так читает диктор. */
function HeroStats({ stats, label }: { stats: readonly HeroStat[]; label: string }) {
  return (
    <dl
      className="home-hero__stats"
      aria-label={label}
      style={{ "--n": stats.length } as CSSProperties}
    >
      {stats.map((item) => (
        <div
          key={item.key}
          className={
            item.key === "flats" ? "home-hero__stat home-hero__stat--live" : "home-hero__stat"
          }
        >
          <dt className="home-hero__stat-label">{item.label}</dt>
          <dd className="home-hero__stat-value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
