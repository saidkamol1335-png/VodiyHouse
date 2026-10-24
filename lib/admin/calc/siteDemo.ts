import type { CabinetProgramRecord } from "@/lib/calc/cabinet/records";
import type { SiteProgramRecord } from "@/lib/calc/records";
import type { SiteCalcRecord } from "@/lib/calc/siteScreen";
import { bilingualFrom } from "../bilingual";
import { DEMO_RATE } from "../programs/demo";
import { demoClientCalc } from "./demo";

// DEMO /kalkulyator (стенд /dev/kalkulyator): те же программы и ЖК, что у «Расчёта для клиента»,
// но в виде ответа site_calc_screen() — без полей скидки, как их снимает private.site_program;
// квартир нет. Сверено с сидом: tests/db/site-calc.test.ts.

type CabinetRecord = CabinetProgramRecord & { bank: unknown; updated_at: string };

function siteProgram(record: CabinetRecord): SiteProgramRecord {
  // Поля кабинета (скидки, порядок, тумблер) на сайт не уходят вовсе — не нулями, а отсутствием.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { developer_id, bank_id, discount_pct, is_active, sort, created_at, tiers, bank, ...rest } =
    record;
  return {
    ...rest,
    bank: bank ? bilingualFrom(bank) : null,
    tiers: tiers.map((tier) => ({
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
