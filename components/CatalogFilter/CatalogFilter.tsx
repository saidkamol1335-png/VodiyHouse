"use client";

import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { FilterChips, FilterPills } from "@/components/FilterPills";
import { SelectField } from "@/components/SelectField";
import type { Locale } from "@/lib/i18n/routing";
import { NO_FILTER, PAYMENT_KINDS, ROOM_CHIPS, type CatalogFilter as Filter, type DeadlineFilter } from "@/lib/site/catalog/filter";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { PriceRange } from "./PriceRange";

type CatalogFilterProps = {
  catalog: SiteCatalog;
  filter: Filter;
  onChange: (next: Filter) => void;
  /** Сколько ЖК подходит — на кнопке «Показать N ЖК». */
  found: number;
  /** Телефон: фильтр на весь экран открыт. */
  open: boolean;
  onClose: () => void;
  /** «Показать N ЖК»: к результатам (и закрыть экран фильтра на телефоне). */
  onShow: () => void;
};

/** Чипов «до года» — как в мокапе («до 2026», «до 2027», «до 2028»): ближайшие годы сдачи каталога. */
const DEADLINE_YEARS = 3;

/** Годы сдачи строящихся блоков каталога — из данных, а не из часов: страница собирается заранее. */
function deadlineYears(catalog: SiteCatalog): number[] {
  const years = catalog.complexes.flatMap((c) => c.blocks.flatMap((b) => (b.buildStatus === "building" && b.deadline ? [b.deadline.year] : [])));
  return [...new Set(years)].sort((a, b) => a - b).slice(0, DEADLINE_YEARS);
}

/**
 * Фильтр каталога (мокап .flt): на десктопе — две строки над результатами, на телефоне — экран
 * целиком с «Показать N ЖК» внизу. Значения применяются сразу (выдача пересчитывается в браузере).
 */
export function CatalogFilter({ catalog, filter, onChange, found, open, onClose, onShow }: CatalogFilterProps) {
  const t = useTranslations("catalog.filter");
  const set = (patch: Partial<Filter>) => onChange({ ...filter, ...patch });
  const touched = JSON.stringify({ ...filter, sort: NO_FILTER.sort }) !== JSON.stringify(NO_FILTER);
  return (
    <aside className={open ? "catalog-filter catalog-filter--open" : "catalog-filter"} aria-label={t("label")}>
      <div className="catalog-filter__top">
        <b>{t("label")}</b>
        <button type="button" className="catalog-filter__close" aria-label={t("close")} onClick={onClose}>
          <X size={20} strokeWidth={1.8} aria-hidden />
        </button>
      </div>
      <div className="catalog-filter__row">
        <RoomsAndPrice filter={filter} set={set} />
        <PlaceAndPayment catalog={catalog} filter={filter} set={set} />
      </div>
      <div className="catalog-filter__row catalog-filter__row--second">
        <DeadlineAndMore catalog={catalog} filter={filter} set={set} />
        <div className="catalog-filter__actions">
          {touched ? (
            <Button variant="ghost" size="sm" onClick={() => onChange({ ...NO_FILTER, sort: filter.sort })}>
              {t("reset")}
            </Button>
          ) : null}
          <Button size="sm" className="catalog-filter__show" onClick={onShow} disabled={found === 0}>
            {t("show", { n: found })}
          </Button>
        </div>
      </div>
    </aside>
  );
}

type SectionProps = { filter: Filter; set: (patch: Partial<Filter>) => void };

function Section({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={["catalog-filter__section", className].filter(Boolean).join(" ")}>
      <span className="catalog-filter__title">{title}</span>
      {children}
    </div>
  );
}

function RoomsAndPrice({ filter, set }: SectionProps) {
  const t = useTranslations("catalog");
  const roomLabel = (rooms: number) => (rooms === 0 ? t("card.rooms.0") : rooms === 4 ? "4+" : String(rooms));
  return (
    <>
      <Section title={t("filter.rooms")}>
        <FilterChips label={t("filter.rooms")} chips={ROOM_CHIPS.map((rooms) => ({ key: rooms, label: roomLabel(rooms) }))} value={filter.rooms} onChange={(rooms) => set({ rooms: [...rooms].sort((a, b) => a - b) })} />
      </Section>
      <Section title={t("filter.price")} className="catalog-filter__section--price">
        <PriceRange min={filter.priceMin} max={filter.priceMax} onChange={(priceMin, priceMax) => set({ priceMin, priceMax })} />
      </Section>
    </>
  );
}

function PlaceAndPayment({ catalog, filter, set }: SectionProps & { catalog: SiteCatalog }) {
  const t = useTranslations("catalog.filter");
  const locale = useLocale() as Locale;
  const locations = new Map(catalog.complexes.flatMap((c) => (c.location ? [[c.location.slug, c.location.name[locale]] as const] : [])));
  return (
    <>
      <div className="catalog-filter__section catalog-filter__section--select">
        <SelectField id="catalog-location" label={t("location")} className="catalog-filter__select" value={filter.locations[0] ?? ""} placeholder={t("locationAll")} options={[...locations].map(([value, label]) => ({ value, label }))} onChange={(event) => set({ locations: event.target.value ? [event.target.value] : [] })} />
      </div>
      <Section title={t("payment")}>
        <FilterChips label={t("payment")} chips={PAYMENT_KINDS.map((kind) => ({ key: kind, label: t(`payments.${kind}`) }))} value={filter.payments} onChange={(payments) => set({ payments })} />
      </Section>
    </>
  );
}

function DeadlineAndMore({ catalog, filter, set }: SectionProps & { catalog: SiteCatalog }) {
  const t = useTranslations("catalog.filter");
  const locale = useLocale() as Locale;
  const years = deadlineYears(catalog);
  const pills = [
    { key: "any", label: t("deadlineAny") },
    { key: "built", label: t("deadlineBuilt") },
    ...years.map((year) => ({ key: String(year), label: t("deadlineUpTo", { year }) })),
  ];
  const finishings = new Map(catalog.complexes.flatMap((c) => c.blocks.flatMap((b) => (b.finishing ? [[b.finishing.slug, b.finishing.name[locale]] as const] : []))));
  const toDeadline = (key: string): DeadlineFilter => (key === "any" || key === "built" ? key : Number(key));
  return (
    <>
      <Section title={t("deadline")}>
        <FilterPills label={t("deadline")} pills={pills} value={String(filter.deadline)} onChange={(key) => set({ deadline: toDeadline(key) })} />
      </Section>
      <div className="catalog-filter__section catalog-filter__section--select">
        <SelectField id="catalog-developer" label={t("developer")} className="catalog-filter__select" value={filter.developers[0] ?? ""} placeholder={t("developerAll")} options={catalog.developers.map((d) => ({ value: d.slug, label: d.name }))} onChange={(event) => set({ developers: event.target.value ? [event.target.value] : [] })} />
      </div>
      <Section title={t("finishing")}>
        <FilterChips label={t("finishing")} chips={[...finishings].map(([key, label]) => ({ key, label }))} value={filter.finishings} onChange={(finishings) => set({ finishings })} />
      </Section>
    </>
  );
}
