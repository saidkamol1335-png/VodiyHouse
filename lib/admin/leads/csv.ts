import { createTranslator } from "next-intl";
import { formatDateTime, formatPhone } from "@/lib/format";
import ru from "@/messages/ru.json";
import { deliveryOf, sourceText, type LeadRow } from "./screen";

// Выгрузка «Заявок» в CSV: точка с запятой и BOM — Excel с русской раскладкой открывает файл по
// двойному щелчку без мастера импорта; кавычки внутри — удвоением (RFC 4180).

const t = createTranslator({ locale: "ru", messages: ru, namespace: "admin.leads" });

const cell = (value: string | number) => {
  const text = String(value);
  // Ячейка, начатая «=», «+», «-», «@», — формула в Excel: чужой ввод (имя, метки) ею не станет.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Телефон — проверенное поле (+998 и 9 цифр): текстом-формулой ="+998901234567", без видимого
 *  апострофа общей защиты; Excel и Таблицы показывают номер как есть, а не число 9,98E+11. */
const phoneCell = (phone: string) => `"=""${formatPhone(phone) ?? ""}"""`;

/** Строки выборки; truncatedAt — выборка больше потолка: последняя строка говорит, что файл неполный. */
export function leadsCsv(rows: readonly LeadRow[], truncatedAt?: number): string {
  const columns = ["number", "when", "client", "type", "complex", "source", "status", "manager", "delivery"] as const;
  const titles = columns.map((key) => t(`columns.${key}`));
  titles.splice(3, 0, t("card.phone"));
  const lines = rows.map((row) => {
    const before = [row.number, formatDateTime(new Date(row.createdAt)), row.name];
    const after = [
      t(`types.${row.type}`),
      row.subject.complex?.ru ?? "",
      sourceText(row.source) ?? t("sourceDirect"),
      t(`statuses.${row.status}`),
      row.assigned?.name ?? "",
      (["telegram", "sheet"] as const).map((channel) => `${t(`channels.${channel}`)}: ${t(`delivery.states.${deliveryOf(row, channel)}`)}`).join(", "),
    ];
    return [...before.map(cell), phoneCell(row.phone), ...after.map(cell)].join(";");
  });
  const truncated = truncatedAt !== undefined ? [cell(t("csvLimit", { count: truncatedAt }))] : [];
  return `﻿${[titles.map(cell).join(";"), ...lines, ...truncated].join("\r\n")}\r\n`;
}
