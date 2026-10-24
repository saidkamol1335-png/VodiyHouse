// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DICTIONARY_KEYS,
  dictionaryColumns,
  dictionaryRow,
  nextSort,
  parseDictionaryItem,
  parseDictionaryItems,
  readItemId,
  readOrder,
} from "./definitions";

const MIGRATION = readFileSync(
  path.resolve(
    import.meta.dirname,
    // Последнее определение private.dictionary_table — фаза 2 добавила банки.
    "../../../supabase/migrations/20261024100000_payment_programs.sql",
  ),
  "utf8",
);

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.append(name, value);
  return data;
}

describe("справочники", () => {
  it("тот же список, что принимает база (private.dictionary_table)", () => {
    expect(MIGRATION).toContain(
      `p_dictionary in (${DICTIONARY_KEYS.map((key) => `'${key}'`).join(", ")})`,
    );
  });

  it("колонки — только свои: вид у городов, пояснение у документов, «что входит» у отделки", () => {
    expect(dictionaryColumns("locations")).toBe("id, slug, name, sort, is_active, kind");
    expect(dictionaryColumns("document_types")).toBe("id, slug, name, sort, is_active, hint");
    expect(dictionaryColumns("finishings")).toBe("id, slug, name, sort, is_active, description");
    expect(dictionaryColumns("detail_topics")).toBe("id, slug, name, sort, is_active");
  });

  it("строки из базы → значения; нет второго поля — null", () => {
    const [item] = parseDictionaryItems("document_types", [
      {
        id: 2,
        slug: "permit",
        name: { ru: "Разрешение", uz: "Ruxsatnoma" },
        sort: 20,
        is_active: true,
        hint: null,
      },
    ]);
    expect(item).toEqual({
      id: 2,
      slug: "permit",
      name: { ru: "Разрешение", uz: "Ruxsatnoma" },
      second: null,
      kind: null,
      isActive: true,
      sort: 20,
    });
  });

  it("правка: название на двух языках обязательно, вид — только город или район", () => {
    expect(
      parseDictionaryItem(
        "locations",
        form({ "name.ru": "Фергана", "name.uz": "Farg‘ona", kind: "city" }),
      ),
    ).toEqual({
      ok: true,
      value: { name: { ru: "Фергана", uz: "Farg‘ona" }, second: null, kind: "city" },
    });
    expect(
      parseDictionaryItem(
        "locations",
        form({ "name.ru": "Фергана", "name.uz": "", kind: "village" }),
      ),
    ).toEqual({
      ok: false,
      fieldErrors: { name: "missingUz", kind: "kindInvalid" },
    });
    expect(parseDictionaryItem("detail_topics", form({ "name.ru": "", "name.uz": "" }))).toEqual({
      ok: false,
      fieldErrors: { name: "required" },
    });
  });

  it("второе поле — по желанию, но целиком на двух языках", () => {
    const filled = form({
      "name.ru": "Под ключ",
      "name.uz": "Kalit tayyor",
      "second.ru": "Всё готово",
      "second.uz": "",
    });
    expect(parseDictionaryItem("finishings", filled)).toEqual({
      ok: false,
      fieldErrors: { second: "missingUz" },
    });
    const empty = parseDictionaryItem(
      "finishings",
      form({ "name.ru": "Под ключ", "name.uz": "Kalit tayyor", "second.ru": "", "second.uz": "" }),
    );
    expect(empty.ok && dictionaryRow("finishings", empty.value)).toEqual({
      name: { ru: "Под ключ", uz: "Kalit tayyor" },
      description: null,
    });
  });

  it("id и порядок — только целые smallint без повторов", () => {
    expect(readItemId(form({ id: "12" }))).toBe(12);
    expect(readItemId(form({ id: "12; drop" }))).toBeNull();
    expect(readItemId(form({ id: "40000" }))).toBeNull();
    expect(readOrder(form({ order: "[3, 1, 2]" }))).toEqual([3, 1, 2]);
    expect(readOrder(form({ order: "[3, 3]" }))).toBeNull();
    expect(readOrder(form({ order: "[1.5]" }))).toBeNull();
    expect(readOrder(form({ order: "{" }))).toBeNull();
  });

  it("новое значение — в конец", () => {
    expect(nextSort([])).toBe(10);
    expect(
      nextSort(
        parseDictionaryItems("detail_topics", [
          { id: 1, slug: "a", name: { ru: "А", uz: "A" }, sort: 60, is_active: true },
        ]),
      ),
    ).toBe(70);
  });
});
