import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import type { TotalContext } from "@/components/CalcTotal";
import type { CalcT } from "@vh/shared/calc/text";
import { EMPTY_REALTOR_PARAMS, readRealtorParams } from "@vh/shared/calc/realtorParams";
import ru from "@/messages/ru.json";
import uz from "@/messages/uz.json";
import {
  REALTOR_DEFAULTS,
  type RealtorState,
  paramsOf,
  parseAmount,
  parseNumber,
  stateFrom,
  switchCurrency,
} from "./realtorState";
import { leadRowsOf, telegramOf } from "./realtorText";
import { realtorView } from "./realtorView";
import { realtorSearch } from "./useRealtorState";

// Риелторский калькулятор (PLAN §10, п. 48): строки итога, заявка, Telegram и адрес — на русских и
// узбекских текстах сайта. Пробелы в суммах — неразрывные (Intl), поэтому сравниваем без них.

const RATE = { usdUzs: 12_000, date: "2026-11-04", source: "cbu" as const };

const tRu = createTranslator({ locale: "ru", messages: ru, namespace: "calc" }) as unknown as CalcT;
const tUz = createTranslator({ locale: "uz", messages: uz, namespace: "calc" }) as unknown as CalcT;

const ctx = (state: RealtorState, t: CalcT = tRu, locale: "ru" | "uz" = "ru"): TotalContext => ({
  out: state.outCurrency,
  rate: RATE,
  t,
  locale,
});

const plain = (text: string | null | undefined) => (text ?? "").replace(/[  ]/g, " ");
const view = (state: RealtorState, t?: CalcT, locale?: "ru" | "uz") =>
  realtorView(state, ctx(state, t, locale), RATE);
const row = (state: RealtorState, key: string) =>
  plain(view(state).rows.find((item) => item.key === key)?.value);

describe("итог риелторского калькулятора", () => {
  it("ипотека по умолчанию: 600 млн, взнос 20 %, 15 лет под 17,5 % — платёж, кредит, проценты", () => {
    const result = view(REALTOR_DEFAULTS);
    expect(result.problem).toBeNull();
    expect(plain(result.eyebrow)).toBe("Ипотека · Аннуитетный");
    expect(result.head?.label).toBe("Платёж в месяц");
    expect(plain(result.head?.value)).toBe("7 558 000 сум");
    expect(result.rows.map((item) => item.key)).toEqual([
      "price",
      "down",
      "loan",
      "extra",
      "overpayment",
      "total",
    ]);
    expect(row(REALTOR_DEFAULTS, "loan")).toBe("480 000 000 сум");
  });

  it("дифференцированный: крупно — первый платёж, строкой — последний", () => {
    const result = view({ ...REALTOR_DEFAULTS, method: "differentiated" });
    expect(result.head?.label).toBe("Первый платёж");
    expect(result.rows[0]?.key).toBe("last");
    expect(plain(result.eyebrow)).toBe("Ипотека · Дифференцированный");
  });

  it("рассрочка без наценки — без строк «Наценка» и «Переплата»; с наценкой — с ними", () => {
    const installment = { ...REALTOR_DEFAULTS, tab: "installment" as const, months: 24 };
    const keys = view(installment).rows.map((item) => item.key);
    expect(keys).toEqual(["price", "down", "loan", "total"]);
    expect(plain(view(installment).head?.value)).toBe("20 000 000 сум");
    expect(row({ ...installment, markup: "10" }, "extra")).toBe("48 000 000 сум");
  });

  it("сколько могу купить: 8 млн в месяц, 15 лет, 17,5 % + взнос 120 млн → цена квартиры", () => {
    const afford = { ...REALTOR_DEFAULTS, tab: "afford" as const };
    const result = view(afford);
    expect(result.head?.label).toBe("Квартира по карману до");
    expect(result.rows[0]?.key).toBe("monthly");
    expect(plain(result.rows[0]?.value)).toBe("8 000 000 сум");
    expect(result.rows.some((item) => item.key === "price")).toBe(false);
    expect(plain(result.head?.value)).toMatch(/^\d{3} \d{3} 000 сум$/);
  });

  it("нет стоимости, платежа или ставки — подсказка вместо итога", () => {
    expect(view({ ...REALTOR_DEFAULTS, sum: "" }).problem).toBe("Введите стоимость — посчитаем платёж");
    expect(view({ ...REALTOR_DEFAULTS, tab: "afford", monthly: "0" }).problem).toMatch(/платёж в месяц/);
    expect(view({ ...REALTOR_DEFAULTS, rate: "" }).problem).toBe("Введите ставку банка — посчитаем платёж");
    // У рассрочки ставки банка нет — пустая ставка ей не мешает.
    expect(view({ ...REALTOR_DEFAULTS, tab: "installment", rate: "" }).problem).toBeNull();
  });

  it("ставка 0 % — это ставка, а не «пусто»", () => {
    expect(view({ ...REALTOR_DEFAULTS, rate: "0" }).problem).toBeNull();
    expect(row({ ...REALTOR_DEFAULTS, rate: "0" }, "extra")).toBe("0 сум");
  });

  it("площадь × цена м²: 60 × 10 млн = 600 млн, место в тексте Telegram", () => {
    const state = { ...REALTOR_DEFAULTS, priceMode: "area" as const, area: "64,2", perM2: "7 700 000" };
    expect(row(state, "price")).toBe("494 340 000 сум");
    expect(plain(telegramOf(state, view(state), ctx(state)))).toContain("64,2 м² × 7 700 000 сум");
  });

  it("взнос больше 90 % — посчитано на 90 %, поле об этом скажет", () => {
    const capped = view({ ...REALTOR_DEFAULTS, first: "590 000 000" });
    expect(capped.capped).toBe(true);
    expect(capped.calc?.downPct).toBe(90);
    expect(view(REALTOR_DEFAULTS).capped).toBe(false);
  });

  it("итог в $ по курсу ЦБ — сноска с курсом; ввод в $ — суммы в полях пересчитаны", () => {
    const usdOut = { ...REALTOR_DEFAULTS, outCurrency: "USD" as const };
    expect(plain(view(usdOut).head?.value)).toBe("$630");
    expect(plain(view(usdOut).footnotes.at(-1))).toBe("Курс ЦБ: 1 $ = 12 000,00 сум на 04.11.2026.");
    const usdIn = switchCurrency(REALTOR_DEFAULTS, "USD", RATE);
    expect(plain(usdIn.sum)).toBe("50 000");
    expect(plain(usdIn.first)).toBe("10 000");
    expect(usdIn.outCurrency).toBe("USD");
    expect(switchCurrency(REALTOR_DEFAULTS, "USD", null).sum).toBe(REALTOR_DEFAULTS.sum);
  });

  it("на узбекском: вкладка и строки итога — узбекские", () => {
    const result = view(REALTOR_DEFAULTS, tUz, "uz");
    expect(plain(result.eyebrow)).toBe("Ipoteka · Annuitet");
    expect(result.head?.label).toBe("Oylik to‘lov");
    expect(plain(result.head?.value)).toBe("7 558 000 so‘m");
  });
});

describe("заявка и Telegram", () => {
  it("строк заявки не больше 8 (предел сервера): что считали, стоимость, взнос, срок, ставка, платёж…", () => {
    const rows = leadRowsOf(REALTOR_DEFAULTS, view(REALTOR_DEFAULTS), ctx(REALTOR_DEFAULTS));
    expect(rows.length).toBeLessThanOrEqual(8);
    expect(rows.map((item) => item.label)).toEqual([
      "Что считали",
      "Стоимость",
      "Первоначальный взнос",
      "Срок",
      "Ставка банка",
      "Платёж в месяц",
      "Переплата",
      "Итоговая стоимость",
    ]);
    expect(plain(rows[4]?.value)).toBe("17,5% · Аннуитетный");
    expect(plain(rows[3]?.value)).toBe("15 лет");
  });

  it("сколько могу купить: в заявке — платёж в месяц, цена — один раз", () => {
    const afford = { ...REALTOR_DEFAULTS, tab: "afford" as const };
    const rows = leadRowsOf(afford, view(afford), ctx(afford));
    expect(rows.map((item) => item.label)).toContain("Платёж в месяц");
    expect(rows.filter((item) => item.label === "Квартира по карману до")).toHaveLength(0);
  });

  it("рассрочка: вместо ставки — наценка", () => {
    const installment = { ...REALTOR_DEFAULTS, tab: "installment" as const, markup: "5" };
    const rows = leadRowsOf(installment, view(installment), ctx(installment));
    expect(rows.map((item) => item.label)).toContain("Наценка");
    expect(rows.map((item) => item.label)).not.toContain("Ставка банка");
  });

  it("Telegram: заголовок, строки, срок, платёж, сноска, ссылка, подпись", () => {
    const text = plain(telegramOf(REALTOR_DEFAULTS, view(REALTOR_DEFAULTS), ctx(REALTOR_DEFAULTS), "https://x/ru/kalkulyator?tab=mortgage"));
    const lines = text.split("\n");
    expect(lines[0]).toBe("Ипотека · Аннуитетный");
    expect(text).toContain("Срок: 15 лет");
    expect(text).toContain("Платёж в месяц: 7 558 000 сум");
    expect(text).toContain("Расчёт: https://x/ru/kalkulyator?tab=mortgage");
    expect(lines.at(-1)).toBe("Vodiy House");
  });
});

describe("адрес", () => {
  it("состояние → адрес → состояние: тот же расчёт", () => {
    const state: RealtorState = {
      ...REALTOR_DEFAULTS,
      tab: "afford",
      priceMode: "area",
      area: "64,2",
      rate: "21,5",
      method: "differentiated",
      inCurrency: "USD",
      outCurrency: "USD",
    };
    const search = realtorSearch("utm_source=tg&developer=myb", state);
    expect(search).toContain("utm_source=tg");
    expect(search).toContain("rate=21.5");
    expect(search).toContain("sum=600000000");
    const back = stateFrom(readRealtorParams(new URLSearchParams(search)));
    expect(view(back).head?.value).toBe(view(state).head?.value);
    expect(paramsOf(back)).toEqual(paramsOf(state));
  });

  it("без ключей — значения по умолчанию; поля из адреса — с разрядами", () => {
    expect(stateFrom(EMPTY_REALTOR_PARAMS)).toEqual(REALTOR_DEFAULTS);
    const state = stateFrom(readRealtorParams(new URLSearchParams("first=100000000&rate=17.5")));
    expect(plain(state.first)).toBe("100 000 000");
    expect(state.rate).toBe("17,5");
  });

  it("очищенное поле переживает адрес: пустой взнос не возвращается к 120 млн, пустая ставка — к 17,5 %", () => {
    const state = { ...REALTOR_DEFAULTS, first: "", rate: "" };
    const back = stateFrom(readRealtorParams(new URLSearchParams(realtorSearch("", state))));
    expect(back.first).toBe("");
    expect(back.rate).toBe("");
  });

  it("ссылка in=USD без части сумм — значения по умолчанию в долларах", () => {
    const state = stateFrom(readRealtorParams(new URLSearchParams("in=USD&sum=50000")));
    expect(plain(state.first)).toBe("10 000");
    expect(state.outCurrency).toBe("USD");
    expect(view(state).capped).toBe(false);
  });

  it("суммы: разряды запятой или точкой — не дробь («65,000» — 65 тысяч)", () => {
    expect(parseAmount("65,000")).toBe(65_000);
    expect(parseAmount("1.200.000")).toBe(1_200_000);
    expect(parseAmount("700,5")).toBe(700.5);
    expect(parseNumber("17,")).toBe(17);
  });

  it("числа из полей: разряды, запятая, ноль; мусор — null", () => {
    expect(parseNumber("600 000 000")).toBe(600_000_000);
    expect(parseNumber("17,5")).toBe(17.5);
    expect(parseNumber("0")).toBe(0);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("12a")).toBeNull();
    expect(parseNumber("-5")).toBeNull();
  });
});
