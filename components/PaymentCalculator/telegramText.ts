import type { TotalHead, TotalRow } from "@/components/CalcTotal";
import type { CalcT } from "./calcText";

// Текст «Скопировать для Telegram» (решение фазы 2): один шаблон на кабинет и сайт — название,
// где, строки итога, срок и платёж, сноски, подпись. В кабинете — на языке клиента (RU | UZ).

export type TelegramInput = {
  title: string;
  /** «ЖК Shodlik, блок A · кв. 88» или «64,2 м² × $700» */
  place: string | null;
  head: TotalHead;
  rows: readonly TotalRow[];
  /** «17 мес.»; у 100 % оплаты — null */
  term: string | null;
  footnotes: readonly string[];
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
    t("telegram.signature"),
  ]
    .filter((text): text is string => text !== null)
    .join("\n");
}
