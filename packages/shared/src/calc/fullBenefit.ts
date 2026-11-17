import type { ProgramPricing } from "./calculate";
import type { CalcProgram } from "./programs";

// Выгода за 100 % оплату на сайте (правки 15.11, п. 21, блок D): процент — из программы «100% оплата»
// застройщика (payment_programs.discount_pct). База отдаёт его сайту полем benefit_pct, только когда
// руководитель включил «Скидки на сайте» (private.site_shows_discounts, 20261117170000); выключено — поля
// нет, расчёт как раньше. Ступени схемы — по-прежнему только в кабинете (calc/cabinet). Имена здесь —
// без слова «discount»: модуль попадает в JS сайта, а e2e проверяют, что такого слова там нет (PLAN §3.13).

/** Процент выгоды за 100 % у программы сайта; 0 — выгоды нет. */
export function fullBenefitPct(program: CalcProgram): number {
  return program.type === "full" ? (program.benefitPct ?? 0) : 0;
}

/** Цена по программе «100% оплата» с выгодой; у остальных программ — без изменений (undefined). */
export function fullBenefitPricing(program: CalcProgram): ProgramPricing | undefined {
  const pct = fullBenefitPct(program);
  if (pct <= 0) return undefined;
  return ({ price }) => price * (1 - pct / 100);
}
