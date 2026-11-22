import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import type { CalcT } from "@vh/shared/calc/text";
import { formatAmount } from "@vh/shared/format";
import ru from "@/messages/ru.json";
import { REALTOR_DEFAULTS, type RealtorState } from "./realtorState";
import { realtorView } from "./realtorView";
import { UYSOT_AFFORD, UYSOT_INSTALLMENT, UYSOT_MORTGAGE } from "./uysotCases";

// /kalkulyator против uysot.uz: 27 расчётов, снятых с живой страницы uysot (uysotCases.ts), через весь
// путь нашей страницы — поля как набраны → realtorView → строки итога. Совпадать должно до сума.

const t = createTranslator({ locale: "ru", messages: ru, namespace: "calc" }) as unknown as CalcT;
const context = { out: "UZS" as const, rate: null, t, locale: "ru" as const };

/** Число из строки итога: «1 305 930 315 сум» → 1305930315. */
const amountOf = (text: string | null | undefined) => Number((text ?? "").replace(/\D/g, ""));

function ours(state: RealtorState) {
  const view = realtorView(state, context, null);
  const row = (key: string) => amountOf(view.rows.find((item) => item.key === key)?.value);
  return { head: amountOf(view.head?.value), loan: row("loan"), interest: row("extra"), total: row("total") };
}

const base = (patch: Partial<RealtorState>): RealtorState => ({ ...REALTOR_DEFAULTS, method: "annuity", markup: "0", ...patch });
const money = (value: number) => formatAmount(value);
const rate = (value: number) => String(value).replace(".", ",");

describe("/kalkulyator = uysot.uz · Ипотека", () => {
  it.each(UYSOT_MORTGAGE.map((item) => [`${money(item.price)} · ${money(item.down)} · ${item.years} лет · ${item.ratePct}%`, item] as const))(
    "%s",
    (_, item) => {
      const result = ours(base({ tab: "mortgage", sum: money(item.price), first: money(item.down), years: item.years, rate: rate(item.ratePct) }));
      expect([result.head, result.loan, result.interest, result.total]).toEqual(item.expect);
    },
  );
});

describe("/kalkulyator = uysot.uz · Рассрочка", () => {
  it.each(UYSOT_INSTALLMENT.map((item) => [`${money(item.price)} · ${money(item.down)} · ${item.years} лет`, item] as const))(
    "%s",
    (_, item) => {
      const result = ours(base({ tab: "installment", sum: money(item.price), first: money(item.down), months: item.years * 12 }));
      expect([result.head, result.total]).toEqual(item.expect);
    },
  );
});

describe("/kalkulyator = uysot.uz · Сколько могу купить («Оплата»)", () => {
  it.each(UYSOT_AFFORD.map((item) => [`${money(item.monthly)} в месяц · ${money(item.down)} · ${item.years} лет · ${item.ratePct}%`, item] as const))(
    "%s",
    (_, item) => {
      const result = ours(base({ tab: "afford", monthly: money(item.monthly), first: money(item.down), years: item.years, rate: rate(item.ratePct) }));
      expect([result.head, result.loan, result.interest, result.total]).toEqual(item.expect);
    },
  );
});

describe("сроки uysot вводятся и у нас", () => {
  it("рассрочка до 20 лет (240 мес.) — по адресу и полю, как у uysot", async () => {
    const { REALTOR_LIMITS } = await import("@vh/shared/calc/realtor");
    const { readRealtorParams } = await import("@vh/shared/calc/realtorParams");
    expect(REALTOR_LIMITS.months.max).toBeGreaterThanOrEqual(240);
    expect(readRealtorParams(new URLSearchParams("tab=installment&months=240")).months).toBe(240);
  });
});
