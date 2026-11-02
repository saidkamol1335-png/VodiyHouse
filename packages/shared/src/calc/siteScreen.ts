import type { CalcProgram } from "./programs";
import { rateFromRecord, type RateRecord, type SiteProgramRecord } from "./records";
import { pricedOptions, siteOptionFrom } from "./siteOptions";
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

function currentData(
  record: SiteCalcRecord,
  current: NonNullable<SiteCalcRecord["current"]>,
): CalcData<CalcProgram> {
  const stock = stockFrom(current.complexes, [], current.price_hint);
  const rate = rateFromRecord(record.rate);
  const { options, hiddenForRate } = pricedOptions(
    current.programs.map(siteOptionFrom),
    stock,
    rate,
  );
  return { options, stock, rate, hiddenForRate };
}

export function siteCalcFrom(record: SiteCalcRecord): SiteCalcScreen {
  const current = record.current;
  return {
    developers: record.developers.map(({ id, slug, name }) => ({ id, slug, name })),
    current: current && {
      id: current.id,
      slug: current.slug,
      name: current.name,
      checkedAt: current.checked_at,
      data: currentData(record, current),
    },
  };
}
