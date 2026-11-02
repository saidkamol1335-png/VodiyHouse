import type { Currency, ExchangeRate } from "./money";
import { appliesToBlock, type ProgramOption } from "./options";
import type { CalcStock } from "./priceSource";
import { type CalcProgram, isTermsProgram, kindOf } from "./programs";
import { programFromRecord, type SiteProgramRecord } from "./records";

// Запись программы сайта (site_payment_programs: без полей скидки, PLAN §3.13) → программа
// калькулятора. Кабинетная пара — lib/admin/calc/screen.ts (со скидками).

export function siteOptionFrom(record: SiteProgramRecord): ProgramOption<CalcProgram> {
  return {
    id: record.id,
    kind: kindOf(record),
    bankName: record.bank ? { ru: record.bank.ru, uz: record.bank.uz } : null,
    blocksScope: record.blocks_scope,
    blockIds: record.block_ids,
    updatedAt: record.updated_at,
    program: programFromRecord(record),
  };
}

/**
 * Валюты цен, к которым применима программа: её блоки и цена м² по умолчанию (площадь — без блока);
 * нет ни того ни другого — $, как у «Суммы».
 */
function priceCurrencies(stock: CalcStock, option: ProgramOption<CalcProgram>): Set<Currency> {
  const blocks = stock.blocks.filter((block) => appliesToBlock(option, block.id));
  const currencies = new Set(blocks.map((block) => block.currency));
  if (stock.priceHint) currencies.add(stock.priceHint.currency);
  return currencies.size > 0 ? currencies : new Set(["USD"]);
}

/**
 * Решение «Валюта»: без курса программу банка в чужой валюте не посчитать ни для одной цены её
 * блоков — на сайте её нет, вместо неё строка «курс недоступен» (hiddenForRate). Кабинет
 * видит все программы: там «курс недоступен» — в итоге выбранной.
 */
export function pricedOptions(
  options: readonly ProgramOption<CalcProgram>[],
  stock: CalcStock,
  rate: ExchangeRate | null,
) {
  if (rate) return { options: [...options], hiddenForRate: false };
  const priced = options.filter((option) => {
    const currency = isTermsProgram(option.program) ? option.program.currency : null;
    return currency === null || priceCurrencies(stock, option).has(currency);
  });
  return { options: priced, hiddenForRate: priced.length < options.length };
}
