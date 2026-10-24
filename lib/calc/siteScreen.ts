import type { CalcProgram } from "./programs";
import { rateFromRecord, type RateRecord, type SiteProgramRecord } from "./records";
import { siteOptionFrom } from "./siteOptions";
import { type ComplexRecord, type PriceHintRecord, stockFrom } from "./stockRecords";
import type { CalcData } from "./view";

// Ответ site_calc_screen() (20261024100000_payment_programs.sql) → данные /kalkulyator. Полей
// скидки в записи нет вовсе (PLAN §3.13); квартир нет — расчёт квартиры получит её цену сам (2.7).

export type SiteCalcRecord = {
  rate: RateRecord | null;
  developers: { id: string; slug: string; name: string }[];
  current: {
    id: string;
    slug: string;
    name: string;
    checked_at: string | null;
    price_hint: PriceHintRecord;
    programs: SiteProgramRecord[];
    complexes: ComplexRecord[];
  } | null;
};

export type SiteCalcDeveloper = { id: string; slug: string; name: string };

export type SiteCalcScreen = {
  developers: SiteCalcDeveloper[];
  current: (SiteCalcDeveloper & { checkedAt: string | null; data: CalcData<CalcProgram> }) | null;
};

export function siteCalcFrom(record: SiteCalcRecord): SiteCalcScreen {
  const current = record.current;
  return {
    developers: record.developers.map(({ id, slug, name }) => ({ id, slug, name })),
    current: current && {
      id: current.id,
      slug: current.slug,
      name: current.name,
      checkedAt: current.checked_at,
      data: {
        options: current.programs.map(siteOptionFrom),
        stock: stockFrom(current.complexes, [], current.price_hint),
        rate: rateFromRecord(record.rate),
      },
    },
  };
}
