import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { editFailed, type EditMessage } from "@/lib/admin/units/editOutcome";
import { unitsFailure } from "@/lib/admin/units/errors";
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
  complexes: createTranslator({ locale: "ru", messages: ru, namespace: "admin.complexes" }),
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

describe("текст полосы правок руководителя", () => {
  const edit = (message: EditMessage) => {
    const { title, detail } = barText(texts, message);
    return [plain(title), plain(detail)];
  };

  it.each<[EditMessage, (string | null)[]]>([
    [{ kind: "rowSaved", number: "41" }, ["Кв. 41: сохранено", null]],
    [{ kind: "added", number: "89" }, ["Добавлена кв. 89", null]],
    [
      { kind: "priced", subject: MANY, changed: 2, withoutLayout: 1, none: false },
      [
        "Цена поменялась у 2 квартир",
        "Без планировки: 1 — на сайте у них «цена по запросу», пока стояк не назначит планировку.",
      ],
    ],
    [
      { kind: "priced", subject: MANY, changed: 0, withoutLayout: 0, none: false },
      ["Ничего не поменялось: у выбранных уже такая цена.", null],
    ],
    [
      { kind: "priced", subject: MANY, changed: 3, withoutLayout: 0, none: true },
      ["Цена снята у 3 квартир", null],
    ],
    [
      { kind: "finished", subject: MANY, changed: 0 },
      ["Ничего не поменялось: у выбранных уже такая отделка.", null],
    ],
    [{ kind: "deleted", count: 5 }, ["Удалено: 5 квартир", null]],
    [
      { kind: "rowGone", number: "41" },
      ["Кв. 41 удалили, пока была открыта её правка, — правка не сохранена.", null],
    ],
    [
      { kind: "priced", subject: MANY, changed: 1200, withoutLayout: 1200, none: false },
      [
        "Цена поменялась у 1 200 квартир",
        "Без планировки: 1 200 — на сайте у них «цена по запросу», пока стояк не назначит планировку.",
      ],
    ],
    [
      editFailed("row", ONE, unitsFailure("unitNumberTaken")),
      ["Не сохранили кв. 41.", "Квартира с таким номером уже есть в блоке"],
    ],
    [
      editFailed("price", MANY, unitsFailure("network")),
      [
        "Не поставили цену: 3 квартиры.",
        "Ответ не дошёл — список перечитан: проверьте, сохранилось ли.",
      ],
    ],
    [
      { kind: "editFailed", what: "remove", subject: ONE, error: "notReady", broken: ["layouts"] },
      ["Не удалили: кв. 41.", "Нельзя: опубликованный ЖК потерял бы планировка с чертежом и ценой"],
    ],
  ])("%j", (message, expected) => {
    expect(edit(message)).toEqual(expected);
  });
});
