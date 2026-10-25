import { createTranslator } from "next-intl";
import { formatDateTime } from "@/lib/format";
import ru from "@/messages/ru.json";
import { deliveryOf, sourceText, type LeadRow } from "./screen";

// Выгрузка «Заявок» в CSV: точка с запятой и BOM — Excel с русской раскладкой открывает файл по
// двойному щелчку без мастера импорта; кавычки внутри — удвоением (RFC 4180).

const t = createTranslator({ locale: "ru", messages: ru, namespace: "admin.leads" });

const cell = (value: string | number) => {
  const text = String(value);
  // Ячейка, начатая «=», «+», «-», «@», — формула в Excel: телефон «+998…» и чужой ввод ею не станут.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function leadsCsv(rows: readonly LeadRow[]): string {
  const columns = ["number", "when", "client", "type", "complex", "source", "status", "manager", "delivery"] as const;
  const titles = columns.map((key) => t(`columns.${key}`));
  titles.splice(3, 0, t("card.phone"));
  const lines = rows.map((row) =>
    [
      row.number,
      formatDateTime(new Date(row.createdAt)),
      row.name,
      row.phone,
      t(`types.${row.type}`),
      row.subject.complex?.ru ?? "",
      sourceText(row.source) ?? t("sourceDirect"),
      t(`statuses.${row.status}`),
      row.assigned?.name ?? "",
      (["telegram", "sheet"] as const).map((channel) => `${t(`channels.${channel}`)}: ${t(`delivery.states.${deliveryOf(row, channel)}`)}`).join(", "),
    ].map(cell).join(";"),
  );
  return `﻿${[titles.map(cell).join(";"), ...lines].join("\r\n")}\r\n`;
}
