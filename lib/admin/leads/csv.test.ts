import { describe, expect, it } from "vitest";
import { leadsCsv } from "./csv";
import type { LeadRow } from "./screen";

// Выгрузка «Заявок»: телефон без видимого апострофа, защита от формул у свободного текста,
// пометка «файл неполный» на потолке.

const row = (patch: Partial<LeadRow> = {}): LeadRow => ({
  id: "id-1",
  number: 1045,
  createdAt: "2026-10-25T09:30:00Z",
  type: "callback",
  name: "Азиз",
  phone: "+998901234567",
  subject: {},
  source: {},
  status: "new",
  assigned: null,
  repeat: false,
  deliveries: [],
  ...patch,
});

const lines = (csv: string) => csv.replace(/^﻿/, "").trim().split("\r\n");

describe("leadsCsv", () => {
  it("BOM, шапка и строка; телефон — текстом-формулой без апострофа", () => {
    const csv = leadsCsv([row()]);
    expect(csv.startsWith("﻿")).toBe(true);
    const [, line] = lines(csv);
    expect(line).toContain('"=""+998901234567"""');
    expect(line).not.toContain("'+998");
  });

  it("имя с «=» — не формула; кавычки и «;» — в кавычках", () => {
    const [, line] = lines(leadsCsv([row({ name: '=HYPERLINK("x";"y")' })]));
    expect(line).toContain(`"'=HYPERLINK(""x"";""y"")"`);
  });

  it("выборка больше потолка — последняя строка «файл неполный»; без пометки — нет", () => {
    expect(lines(leadsCsv([row(), row({ number: 1046 })], 2)).at(-1)).toContain("Файл неполный");
    expect(lines(leadsCsv([row(), row({ number: 1046 })]))).toHaveLength(3);
  });
});
