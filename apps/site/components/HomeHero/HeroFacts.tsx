import type { CSSProperties, ReactNode } from "react";
import type { HeroStat, HeroText } from "./types";

type HeroFactsProps = {
  text: HeroText;
  /** «Найдено сейчас» (HeroQuickPick) — плашка справа от цифр. */
  found: ReactNode;
  /** id подписи «иллюстративный характер»: на неё ссылается группа рендеров. */
  noteId: string;
};

/**
 * Полоса под горизонтом: диск-горизонт с подписью «Визуализации носят иллюстративный характер» и
 * «Найдено сейчас»; три «бесплатно» вошли в строку под заголовком (правки 15.11, п. 2). Цифры каталога (у квартир — точка «live») — под кнопками, в HeroCopy
 * (правки 15.11, п. 1). Цвет диска — фон страницы.
 */
export function HeroFacts({ text, found, noteId }: HeroFactsProps) {
  return (
    <div className="home-hero__ledger">
      <div className="home-hero__horizon">
        <div className="home-hero__disc" aria-hidden="true" />
        <p id={noteId} className="home-hero__note">
          {text.slides.note}
        </p>
      </div>
      {found ? <div className="home-hero__facts-row">{found}</div> : null}
    </div>
  );
}

/** Число над подписью на экране; в разметке подпись (dt) первая — так читает диктор. */
export function HeroStats({ stats, label }: { stats: readonly HeroStat[]; label: string }) {
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
