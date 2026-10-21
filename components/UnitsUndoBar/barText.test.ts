import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import type { StatusMessage } from "@/lib/admin/units/statusOutcome";
import ru from "@/messages/ru.json";
import { barText, type BarTexts } from "./barText";

const texts = {
  bar: createTranslator({
    locale: "ru",
    messages: ru,
    namespace: "admin.complexes.units.list.bar",
  }),
  status: createTranslator({ locale: "ru", messages: ru, namespace: "admin.journal.unitStatus" }),
  errors: createTranslator({ locale: "ru", messages: ru, namespace: "admin.developers.errors" }),
} as unknown as BarTexts;

const ONE = { number: "41", count: 1 };
const MANY = { number: null, count: 3 };
const plain = (text: string | null) => text?.replace(/\s/g, " ") ?? null;
const show = (message: StatusMessage) => {
  const { title, detail } = barText(texts, message);
  return [plain(title), plain(detail)];
};

describe("текст полосы статуса", () => {
  it.each<[StatusMessage, (string | null)[]]>([
    [
      { kind: "saving", subject: ONE, from: "free", to: "reserved" },
      ["Кв. 41: свободна → бронь", "Сохраняем…"],
    ],
    [{ kind: "changed", subject: MANY, from: null, to: "sold" }, ["3 квартиры → продана", null]],
    [
      { kind: "raced", subject: ONE, was: "sold", to: "reserved" },
      [
        "Кв. 41: в базе было «продана» — статус меняли, пока список был открыт. Список обновлён.",
        null,
      ],
    ],
    [
      { kind: "raced", subject: MANY, was: null, to: "reserved" },
      ["3 квартиры: статус меняли, пока список был открыт. Список обновлён.", null],
    ],
    [{ kind: "same", subject: ONE, to: "free", raced: false }, ["Кв. 41 уже «свободна».", null]],
    [
      { kind: "same", subject: ONE, to: "free", raced: true },
      ["Кв. 41 уже «свободна» — статус поставил другой сотрудник. Список обновлён.", null],
    ],
    [
      { kind: "failed", subject: ONE, error: "network" },
      ["Не сохранили кв. 41.", "Нет связи с сервером — попробуйте ещё раз"],
    ],
    [{ kind: "reverting", subject: ONE }, ["Кв. 41", "Отменяем…"]],
    [{ kind: "reverted", subject: ONE, to: "free" }, ["Вернули: кв. 41 — свободна", null]],
    [{ kind: "reverted", subject: MANY, to: null }, ["Вернули прежние статусы: 3 квартиры", null]],
    [
      { kind: "revertPartial", skipped: ["41", "42"], missing: 2 },
      ["Не вернули № 41, 42 — статус уже поменяли после этого.", "2 квартиры уже удалили."],
    ],
    [{ kind: "revertPartial", skipped: [], missing: 1 }, ["1 квартиру уже удалили.", null]],
    [{ kind: "nothing" }, ["Нечего отменять — статус уже прежний.", null]],
    [
      { kind: "revertFailed", subject: ONE, error: "timeout" },
      ["Не получилось отменить кв. 41.", "База не успела ответить — попробуйте ещё раз"],
    ],
  ])("%j", (message, expected) => {
    expect(show(message)).toEqual(expected);
  });
});
