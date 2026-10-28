"use client";

import { ArrowRight, Check, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { type CSSProperties, useId, useState } from "react";
import { SitePhoto } from "@/components/SitePhoto";
import { initialsOf } from "@/lib/format";
import { Link } from "@/lib/i18n/navigation";
import { developerRoute } from "@/lib/routes";
import type { CatalogPhoto } from "@/lib/site/catalog/records";
import { markTone, searchDevelopers } from "@/lib/site/developers/model";

export type DeveloperRow = {
  slug: string;
  name: string;
  logo: CatalogPhoto | null;
  foundedYear: number | null;
  /** Опубликованных ЖК на сайте. */
  complexes: number;
  /** Все проверки Vodiy House пройдены хотя бы по одному ЖК (ТЗ 8.4). */
  verified: boolean;
};

/** Знак без логотипа — монограмма названия на цветной плитке (мокап SiteDevs: цвет у каждого свой). */
export function DeveloperMark({ name, logo, className }: { name: string; logo: CatalogPhoto | null; className: string }) {
  return logo ? (
    <SitePhoto photo={logo} alt="" frame="card" sizes="56px" className={className} />
  ) : (
    <span
      className={`${className} ${className}--mark`}
      style={{ "--mark-bg": `var(--developer-mark-${markTone(name)})` } as CSSProperties}
      aria-hidden="true"
    >
      {initialsOf(name.replace(/[‘’']/g, ""))}
    </span>
  );
}

/**
 * Список застройщиков (мокап SiteDevs / MobDevs, ТЗ 8.1): поиск по названию на месте, строка —
 * знак, название с галочкой «Проверено», «N новостроек на сайте», «с YYYY года», стрелка.
 */
export function DevelopersList({ rows }: { rows: readonly DeveloperRow[] }) {
  const t = useTranslations("developers");
  const [query, setQuery] = useState("");
  const searchId = useId();
  const shown = searchDevelopers(rows, query);
  return (
    <div className="developers-list">
      <div className="developers-list__search">
        <Search size={18} strokeWidth={1.8} aria-hidden="true" />
        <label htmlFor={searchId} className="sr-only">
          {t("search")}
        </label>
        <input
          id={searchId}
          type="search"
          autoComplete="off"
          placeholder={t("search")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {shown.length === 0 ? (
        <p className="developers-list__empty" role="status">
          {t("nothing")}
        </p>
      ) : (
        <ul className="developers-list__rows">
          {shown.map((row) => (
            <li key={row.slug}>
              <DeveloperRowLink row={row} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Строка списка — ссылка на страницу застройщика. */
function DeveloperRowLink({ row }: { row: DeveloperRow }) {
  const t = useTranslations("developers");
  return (
    <Link className="developers-list__row" href={developerRoute(row.slug)}>
      <DeveloperMark name={row.name} logo={row.logo} className="developers-list__logo" />
      <span className="developers-list__text">
        <b className="developers-list__name">
          {row.name}
          {row.verified ? (
            <span className="developers-list__verified">
              <Check size={11} strokeWidth={3} aria-hidden="true" />
              <span className="sr-only">{t("verified")}</span>
            </span>
          ) : null}
        </b>
        <span className="developers-list__complexes">
          {t("complexes", { n: row.complexes })}
          {/* Телефон (MobDevs): год в той же строке, через точку; на десктопе — своя колонка справа. */}
          {row.foundedYear ? <span className="developers-list__inline-since"> · {t("since", { year: row.foundedYear })}</span> : null}
        </span>
      </span>
      {row.foundedYear ? <span className="developers-list__since">{t("since", { year: row.foundedYear })}</span> : null}
      <ArrowRight size={18} strokeWidth={1.8} className="developers-list__arrow" aria-hidden="true" />
    </Link>
  );
}
