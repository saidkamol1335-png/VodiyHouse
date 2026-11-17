import { describe, expect, it } from "vitest";
import { faqItemsFrom } from "./faq";

describe("частые вопросы (правки 15.11, п. 7 + 23)", () => {
  const pair = { q: { ru: " Как вы зарабатываете? ", uz: "Qanday daromad qilasiz?" }, a: { ru: "Комиссию платит застройщик.", uz: "Komissiyani quruvchi to‘laydi." } };

  it("полная пара — на сайт, пробелы по краям срезаны", () => {
    expect(faqItemsFrom([pair])).toEqual([{ q: { ru: "Как вы зарабатываете?", uz: "Qanday daromad qilasiz?" }, a: pair.a }]);
  });

  it("без языка, без ответа, мусор и не массив — пусто", () => {
    expect(faqItemsFrom([{ q: { ru: "Вопрос", uz: "" }, a: pair.a }, { q: pair.q }, null, 7])).toEqual([]);
    expect(faqItemsFrom({ q: pair.q })).toEqual([]);
    expect(faqItemsFrom(null)).toEqual([]);
  });
});
