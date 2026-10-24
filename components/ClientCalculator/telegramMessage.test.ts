import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import type { CalcT } from "@/components/PaymentCalculator/calcText";
import type { CalcSnapshot } from "@/components/PaymentCalculator/PaymentCalculator";
import { demoClientCalc } from "@/lib/admin/calc/demo";
import { clientCalcFrom } from "@/lib/admin/calc/screen";
import { DEMO_PROGRAMS_SCREEN } from "@/lib/admin/programs/demo";
import { effectiveRate } from "@/lib/admin/programs/types";
import type { CabinetProgram } from "@/lib/calc/cabinet/discounts";
import { CABINET_ENGINE } from "@/lib/calc/cabinet/engine";
import { EMPTY_CALC_PARAMS } from "@/lib/calc/params";
import { calculatorView } from "@/lib/calc/view";
import { pickMessages } from "@/lib/i18n/clientMessages";
import ru from "@/messages/ru.json";
import uz from "@/messages/uz.json";
import type { DiscountT } from "./cabinetExtras";
import { telegramMessage, uzTranslators } from "./telegramMessage";

// Текст для Telegram (решение фазы 2) на DEMO стенда: кв. 88, $57 880, взнос 50 % → −6 %,
// 18 мес. — числа мокапа r1; по-русски и по-узбекски, со строками скидки кабинета.

const NBSP = /[  ]/g;
const rate = effectiveRate(DEMO_PROGRAMS_SCREEN.rate);
const current = clientCalcFrom(demoClientCalc("demo-sifat"), rate).current!;
const unit88 = current.data.stock.units.find((unit) => unit.number === "88")!;

function messageIn(locale: "ru" | "uz") {
  const translators =
    locale === "uz"
      ? uzTranslators(pickMessages(uz, ["calc", "admin.calcTelegram"]))
      : {
          calc: createTranslator({
            locale: "ru",
            messages: ru,
            namespace: "calc",
          }) as unknown as CalcT,
          discount: createTranslator({
            locale: "ru",
            messages: ru,
            namespace: "admin.calcTelegram",
          }) as unknown as DiscountT,
        };
  const params = { ...EMPTY_CALC_PARAMS, unit: unit88.id, downPct: 50 };
  const view = calculatorView(CABINET_ENGINE, current.data, params, true);
  const snapshot = {
    view,
    context: { out: view.outCurrency, rate, t: translators.calc, locale },
  } as unknown as CalcSnapshot<CabinetProgram>;
  const input = {
    stock: current.data.stock,
    developerName: current.name,
    actualAt: current.checkedAt,
  };
  return telegramMessage(snapshot, input, locale, translators)?.replace(NBSP, " ");
}

describe("текст для Telegram", () => {
  it("по-русски: программа, квартира, строки скидки, срок, платёж, сноски", () => {
    expect(messageIn("ru")).toBe(
      [
        "Рассрочка от застройщика — Farg‘ona Sifat Qurilish",
        "Shodlik, блок A · кв. 88, 12 эт., 78 м²",
        "",
        "Цена по прайсу: $57 880",
        "Скидка за взнос 50% (6%): −$3 473",
        "Цена со скидкой: $54 407",
        "Первоначальный взнос · 50%: $27 204",
        "Остаток (без наценки · 18 мес.): $27 204",
        "Итоговая стоимость: $54 407",
        "Срок: 18 мес.",
        "Платёж в месяц: $1 511",
        "",
        "Расчёт иллюстративный и не является предложением банка.",
        "Условия актуальны на 01.10.2026.",
        "Vodiy House",
      ].join("\n"),
    );
  });

  it("по-узбекски — те же числа, узбекские строки и «so‘m» нигде не по-русски", () => {
    const text = messageIn("uz")!;
    expect(text).toContain("Quruvchidan muddatli to‘lov — Farg‘ona Sifat Qurilish");
    expect(text).toContain("Shodlik, A blok · 88-kv., 12-qavat, 78 m²");
    expect(text).toContain("50% boshlang‘ich to‘lov uchun chegirma (6%): −$3 473");
    expect(text).toContain("Oylik to‘lov: $1 511");
    expect(text).not.toMatch(/[а-яё]/i);
  });
});
