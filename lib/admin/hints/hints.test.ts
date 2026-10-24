import { describe, expect, it } from "vitest";
import { CALC_HINT_DRAFTS } from "@/lib/calc/hints";
import { hintItemsFrom, parseHint } from "./hints";

// Форма подсказки «?» (шаг 2.8): набор — из кода, оба языка обязательны, контактов в тексте нет.

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const filled = {
  slug: "overpayment",
  "term.ru": "Переплата",
  "term.uz": "Ortiqcha to‘lov",
  "text.ru": "Сколько вы заплатите сверх цены квартиры.",
  "text.uz": "Kvartira narxidan ortiq to‘laydiganingiz.",
  active: "on",
};

describe("подсказка «?»: форма", () => {
  it("верная форма — термин, пояснение и «показывать»", () => {
    expect(parseHint(form(filled))).toEqual({
      ok: true,
      value: {
        slug: "overpayment",
        term: { ru: "Переплата", uz: "Ortiqcha to‘lov" },
        text: {
          ru: "Сколько вы заплатите сверх цены квартиры.",
          uz: "Kvartira narxidan ortiq to‘laydiganingiz.",
        },
        isActive: true,
      },
    });
    const off = parseHint(form({ ...filled, active: "" }));
    expect(off.ok && off.value.isActive).toBe(false);
  });

  it("без узбекского, слишком длинно, контакты — ошибка у поля", () => {
    expect(parseHint(form({ ...filled, "text.uz": "" }))).toMatchObject({
      ok: false,
      fieldErrors: { text: "missingUz" },
    });
    expect(parseHint(form({ ...filled, "term.ru": "я".repeat(81) }))).toMatchObject({
      ok: false,
      fieldErrors: { term: "tooLong" },
    });
    expect(
      parseHint(form({ ...filled, "text.ru": "Звоните застройщику: +998 90 123 45 67" })),
    ).toMatchObject({ ok: false, fieldErrors: { text: "contacts" } });
    // Термин тоже на сайте: телефон и t.me в нём — та же ошибка.
    expect(
      parseHint(form({ ...filled, "term.ru": "Рассрочка — +998 90 123 45 67" })),
    ).toMatchObject({ ok: false, fieldErrors: { term: "contacts" } });
    expect(parseHint(form({ ...filled, "term.uz": "Ipoteka t.me/sifat_sales" }))).toMatchObject({
      ok: false,
      fieldErrors: { term: "contacts" },
    });
  });

  it("чужой slug — не форма подсказки калькулятора", () => {
    expect(parseHint(form({ ...filled, slug: "white-box" }))).toEqual({
      ok: false,
      fieldErrors: {},
      unknown: true,
    });
  });

  it("строки справочника — в порядке кода, чужие мимо", () => {
    const records = [
      {
        slug: "white-box",
        term: { ru: "x", uz: "x" },
        text: { ru: "x", uz: "x" },
        is_active: true,
      },
      { slug: "overpayment", ...CALC_HINT_DRAFTS.overpayment, is_active: false },
      { slug: "down-payment", ...CALC_HINT_DRAFTS["down-payment"], is_active: true },
    ];
    expect(hintItemsFrom(records).map((item) => [item.slug, item.isActive])).toEqual([
      ["down-payment", true],
      ["overpayment", false],
    ]);
  });
});
