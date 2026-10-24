import type { TotalContext, TotalHead, TotalRow } from "@/components/CalcTotal";
import type { CalcStock } from "@/lib/calc/priceSource";
import type { CalcProgram } from "@/lib/calc/programs";
import type { CalcView } from "@/lib/calc/view";
import type { Currency } from "@/lib/calc/money";
import { formatAmount } from "@/lib/format";
import { type CalcLocale, type CalcT, programName, termText } from "./calcText";
import { type DecorateRows, footnotes, totalView } from "./outputParts";

// Текст «Скопировать для Telegram» (решение фазы 2): один шаблон на кабинет и сайт — название,
// где, строки итога, срок и платёж, сноски, подпись. В кабинете — на языке клиента (RU | UZ);
// на сайте — ещё ссылка на этот расчёт (параметры в адресе).

export type TelegramInput = {
  title: string;
  /** «ЖК Shodlik, блок A · кв. 88» или «64,2 м² × $700» */
  place: string | null;
  head: TotalHead;
  rows: readonly TotalRow[];
  /** «17 мес.»; у 100 % оплаты — null */
  term: string | null;
  footnotes: readonly string[];
  /** Ссылка на расчёт — только сайт (в кабинете числа со скидкой, ссылка их не повторит). */
  link?: string;
};

export function telegramText(input: TelegramInput, t: CalcT): string {
  const line = (label: string, value: string, note?: string) =>
    t("telegram.line", { label: note ? `${label} (${note})` : label, value });
  return [
    input.title,
    input.place,
    "",
    ...input.rows.map((row) => line(row.label, row.value, row.note)),
    input.term ? t("telegram.term", { term: input.term }) : null,
    line(input.head.label, input.head.value),
    "",
    ...input.footnotes,
    input.link ? t("telegram.link", { url: input.link }) : null,
    t("telegram.signature"),
  ]
    .filter((text): text is string => text !== null)
    .join("\n");
}

const AREA = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

/** Цена м², как её набрали (700,5 — не 01): без округления шагом вывода. */
const typedPrice = (amount: number, currency: Currency, t: CalcT) =>
  currency === "USD"
    ? `${t("currency.usd")}${formatAmount(amount)}`
    : `${formatAmount(amount)} ${t("currency.uzs")}`;

/** Где: «Shodlik, блок A · кв. 88, 12 эт., 78 м²», «64,2 м² × $700»; сумма — без строки. */
export function telegramPlace<P extends CalcProgram>(
  view: CalcView<P>,
  stock: CalcStock,
  t: CalcT,
  locale: CalcLocale,
): string | null {
  const { price } = view;
  const unit = stock.units.find((item) => item.id === price.unitId);
  const layout = stock.layouts.find((item) => item.id === price.layoutId);
  const block = stock.blocks.find((item) => item.id === (unit?.blockId ?? layout?.blockId));
  const place = block
    ? t("price.unitGroup", { complex: block.complexName[locale], block: block.name })
    : "";
  const area = price.areaM2 === null ? null : AREA.format(price.areaM2);
  if (price.mode === "unit" && unit) {
    const base = { place, number: unit.number, floor: unit.floor };
    // Квартира без планировки — без площади, а не «0 м²».
    return area === null ? t("telegram.unitNoArea", base) : t("telegram.unit", { ...base, area });
  }
  if (price.mode === "layout" && layout) {
    const rooms = t("price.rooms", { count: layout.rooms });
    return t("telegram.layout", { place, rooms, area: AREA.format(layout.area) });
  }
  if (price.mode === "area" && price.perM2 && area !== null) {
    return t("telegram.area", { area, perM2: typedPrice(price.perM2, price.currency, t) });
  }
  return null;
}

export type TelegramSource = {
  stock: CalcStock;
  developerName: string;
  actualAt: string | null;
  link?: string;
};

/** Сообщение по состоянию калькулятора; нечего копировать (нет программы или расчёта) — null. */
export function calcTelegramText<P extends CalcProgram>(
  view: CalcView<P>,
  source: TelegramSource,
  context: TotalContext,
  decorate?: DecorateRows,
): string | null {
  const calc = view.result?.ok ? view.result.calculation : null;
  if (!view.selected || !calc) return null;
  const { t, locale } = context;
  const total = totalView(view, context, decorate);
  if (!total.head) return null;
  return telegramText(
    {
      title: `${programName(view.selected, t, locale)} — ${source.developerName}`,
      place: telegramPlace(view, source.stock, t, locale),
      head: total.head,
      rows: total.rows,
      term: calc.months > 0 ? termText(calc.months, t) : null,
      footnotes: footnotes(view, { t, rate: context.rate, actualAt: source.actualAt }),
      link: source.link,
    },
    t,
  );
}
