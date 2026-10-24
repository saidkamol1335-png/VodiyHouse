import { type AbstractIntlMessages, createTranslator } from "next-intl";
import {
  type CalcLocale,
  type CalcT,
  programName,
  termText,
} from "@/components/PaymentCalculator/calcText";
import { footnotes, totalView } from "@/components/PaymentCalculator/outputParts";
import type { CalcSnapshot } from "@/components/PaymentCalculator/PaymentCalculator";
import { telegramText } from "@/components/PaymentCalculator/telegramText";
import type { CabinetProgram } from "@/lib/calc/cabinet/discounts";
import type { CalcStock } from "@/lib/calc/priceSource";
import { formatPrice } from "@/lib/format";
import type ru from "@/messages/ru.json";
import { discountDecorator, type DiscountT } from "./cabinetExtras";

// Сообщение для Telegram на языке клиента (решение фазы 2): кабинет — на русском, текст — RU или
// UZ. Узбекские calc и строки скидки приходят с сервера (в браузер кабинета uz.json не уходит).

export type Translators = { calc: CalcT; discount: DiscountT };

export function uzTranslators(messages: AbstractIntlMessages): Translators {
  const typed = messages as unknown as typeof ru;
  return {
    calc: createTranslator({
      locale: "uz",
      messages: typed,
      namespace: "calc",
    }) as unknown as CalcT,
    discount: createTranslator({
      locale: "uz",
      messages: typed,
      namespace: "admin.calcTelegram",
    }) as unknown as DiscountT,
  };
}

const AREA = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

/** Где: «Shodlik, блок A · кв. 88, 12 эт., 78 м²», «64,2 м² × $700»; сумма — без строки. */
function placeOf(
  snapshot: CalcSnapshot<CabinetProgram>,
  stock: CalcStock,
  t: CalcT,
  locale: CalcLocale,
) {
  const { price } = snapshot.view;
  const unit = stock.units.find((item) => item.id === price.unitId);
  const layout = stock.layouts.find((item) => item.id === price.layoutId);
  const block = stock.blocks.find((item) => item.id === (unit?.blockId ?? layout?.blockId));
  const place = block
    ? t("price.unitGroup", { complex: block.complexName[locale], block: block.name })
    : "";
  const area = AREA.format(price.areaM2 ?? 0);
  if (price.mode === "unit" && unit)
    return t("telegram.unit", { place, number: unit.number, floor: unit.floor, area });
  if (price.mode === "layout" && layout) {
    return t("telegram.layout", { place, rooms: t("price.rooms", { count: layout.rooms }), area });
  }
  if (price.mode === "area" && price.perM2) {
    return t("telegram.area", { area, perM2: formatPrice(price.perM2, price.currency, locale) });
  }
  return null;
}

export function telegramMessage(
  snapshot: CalcSnapshot<CabinetProgram>,
  input: { stock: CalcStock; developerName: string; actualAt: string | null },
  locale: CalcLocale,
  translators: Translators,
): string | null {
  const { view } = snapshot;
  const calc = view.result?.ok ? view.result.calculation : null;
  if (!view.selected || !calc) return null;
  const t = translators.calc;
  const context = { ...snapshot.context, t, locale };
  const total = totalView(view, context, discountDecorator(translators.discount));
  if (!total.head) return null;
  return telegramText(
    {
      title: `${programName(view.selected, t, locale)} — ${input.developerName}`,
      place: placeOf(snapshot, input.stock, t, locale),
      head: total.head,
      rows: total.rows,
      term: calc.months > 0 ? termText(calc.months, t) : null,
      footnotes: footnotes(view, { t, rate: context.rate, actualAt: input.actualAt }),
    },
    t,
  );
}
