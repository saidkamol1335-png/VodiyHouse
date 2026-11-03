import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FAQ_LIMITS, faqDrafts, faqField, parseFaq } from "./faq";

// «Частые вопросы» (п. 21): пределы — как private.valid_faq в миграции; контакты застройщика — нет.
const MIGRATION = readFileSync(
  path.resolve(import.meta.dirname, "../../../../../supabase/migrations/20261103120000_complex_faq.sql"),
  "utf8",
);

function form(rows: Record<string, { q: [string, string]; a: [string, string] }>): FormData {
  const data = new FormData();
  for (const [key, row] of Object.entries(rows)) {
    data.append("faqKey", key);
    data.set(`${faqField(key, "q")}.ru`, row.q[0]);
    data.set(`${faqField(key, "q")}.uz`, row.q[1]);
    data.set(`${faqField(key, "a")}.ru`, row.a[0]);
    data.set(`${faqField(key, "a")}.uz`, row.a[1]);
  }
  return data;
}

describe("частые вопросы ЖК", () => {
  it("пределы совпадают с базой", () => {
    expect(MIGRATION).toContain(`jsonb_array_length(p_faq) <= ${FAQ_LIMITS.maxRows}`);
    expect(MIGRATION).toContain(`('q', ${FAQ_LIMITS.questionMax}), ('a', ${FAQ_LIMITS.answerMax})`);
  });

  it("пустые строки не шлются, неполные и с контактами — ошибки по строке", () => {
    const parsed = parseFaq(
      form({
        a: { q: ["Есть парковка?", "Avtoturargoh bormi?"], a: ["Да", "Ha"] },
        b: { q: ["", ""], a: ["", ""] },
        c: { q: ["Только ру", ""], a: ["Звоните +998 90 123 45 67", "Qo‘ng‘iroq qiling +998 90 123 45 67"] },
      }),
    );
    expect(parsed).toMatchObject({ ok: false, errors: { c: { q: "missingUz", a: "contacts" } } });
    expect(parseFaq(form({ a: { q: ["В", "S"], a: ["О", "J"] } }))).toEqual({
      ok: true,
      payload: [{ q: { ru: "В", uz: "S" }, a: { ru: "О", uz: "J" } }],
    });
  });

  it("сохранённые пары → строки формы", () => {
    expect(faqDrafts([{ q: { ru: "В", uz: "S" }, a: { ru: "О", uz: "J" } }])).toEqual([
      { key: "saved-0", q: { ru: "В", uz: "S" }, a: { ru: "О", uz: "J" } },
    ]);
    expect(faqDrafts(null)).toEqual([]);
  });
});
