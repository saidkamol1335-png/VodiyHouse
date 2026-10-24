import type { CabinetProgramRecord } from "@/lib/calc/cabinet/records";
import type { SiteProgramRecord } from "@/lib/calc/records";
import type { SiteCalcRecord } from "@/lib/calc/siteScreen";
import { bilingualFrom } from "../bilingual";
import { DEMO_RATE } from "../programs/demo";
import { demoClientCalc } from "./demo";

// DEMO /kalkulyator (стенд /dev/kalkulyator): те же программы и ЖК, что у «Расчёта для клиента»,
// но в виде ответа site_calc_screen() — без полей скидки, как их снимает private.site_program;
// квартир нет. Застройщики, программы, блоки и цена м² по умолчанию сверены с сидом через тот же
// преобразователь (tests/db/site-calc.test.ts); планировки — числа мокапа, как у кабинета.

type CabinetRecord = CabinetProgramRecord & { bank: unknown; updated_at: string };

/**
 * Поля — списком, как у private.site_program: кабинетные (скидки, порядок, тумблер, «Условия для
 * клиента») на сайт не уходят вовсе — не нулями, а отсутствием.
 */
function siteProgram(record: CabinetRecord): SiteProgramRecord {
  return {
    id: record.id,
    type: record.type,
    method: record.method,
    bank: record.bank ? bilingualFrom(record.bank) : null,
    min_down_pct: record.min_down_pct,
    terms: record.terms,
    fees: record.fees,
    preset_months: record.preset_months,
    allow_custom_months: record.allow_custom_months,
    over_max_behavior: record.over_max_behavior,
    currency: record.currency,
    blocks_scope: record.blocks_scope,
    block_ids: record.block_ids,
    updated_at: record.updated_at,
    tiers: record.tiers.map((tier) => ({
      min_down_pct: tier.min_down_pct,
      min_months: tier.min_months,
      max_months: tier.max_months,
    })),
  };
}

export function demoSiteCalc(slug: string | null): SiteCalcRecord {
  const cabinet = demoClientCalc(slug);
  const current = cabinet.current!;
  const rate = DEMO_RATE.manual ?? DEMO_RATE.cbu!;
  return {
    rate: { usd_uzs: rate.usdUzs, date: rate.date, source: DEMO_RATE.manual ? "manual" : "cbu" },
    developers: cabinet.developers,
    current: {
      id: current.id,
      slug: current.slug,
      name: current.name,
      checked_at: current.checked_at,
      price_hint: current.price_hint,
      programs: current.programs.map(siteProgram),
      complexes: current.complexes,
    },
  };
}
