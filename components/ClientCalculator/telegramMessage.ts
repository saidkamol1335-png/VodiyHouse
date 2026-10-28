import { type AbstractIntlMessages, createTranslator } from "next-intl";
import type { CalcLocale, CalcT } from "@/lib/calc/text";
import type { CalcSnapshot } from "@/components/PaymentCalculator/PaymentCalculator";
import { calcTelegramText, type TelegramSource } from "@/components/PaymentCalculator/telegramText";
import type { CabinetProgram } from "@/lib/calc/cabinet/discounts";
import type ru from "@/messages/ru.json";
import { discountDecorator, type DiscountT } from "./cabinetExtras";

// Сообщение для Telegram на языке клиента (решение фазы 2): кабинет — на русском, текст — RU или
// UZ, со строками скидки и без ссылки (на сайте числа без скидки). Узбекские calc и строки скидки
// приходят с сервера (в браузер кабинета uz.json не уходит).

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

export function telegramMessage(
  snapshot: CalcSnapshot<CabinetProgram>,
  source: Omit<TelegramSource, "link">,
  locale: CalcLocale,
  translators: Translators,
): string | null {
  const context = { ...snapshot.context, t: translators.calc, locale };
  return calcTelegramText(snapshot.view, source, context, discountDecorator(translators.discount));
}
