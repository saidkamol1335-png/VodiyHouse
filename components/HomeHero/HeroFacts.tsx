import { Check } from "lucide-react";
import type { ReactNode } from "react";
import type { HeroStat, HeroText } from "./types";

type HeroFactsProps = {
  text: HeroText;
  /** Цифры из каталога; пусто — каталог не прочитался, экран без цифр. */
  stats: readonly HeroStat[];
  /** «Найдено сейчас» (HeroQuickPick) — компактная плашка справа от цифр. */
  found: ReactNode;
};

/**
 * Низ экрана: три «бесплатно» с галочками, цифры каталога (у квартир — точка «live») и «Найдено
 * сейчас». На десктопе — поверх ролика внизу, на планшете и телефоне — полосой под роликом (мокап Mobile).
 */
export function HeroFacts({ text, stats, found }: HeroFactsProps) {
  return (
    <div className="home-hero__facts">
      <ul className="home-hero__perks">
        {text.perks.map((perk) => (
          <li key={perk} className="home-hero__perk">
            <Check size={16} aria-hidden="true" />
            {perk}
          </li>
        ))}
      </ul>
      {stats.length > 0 || found ? (
        <div className="home-hero__row">
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
    <dl className="home-hero__stats" aria-label={label}>
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
