import { describe, expect, it } from "vitest";
import { editedMigrations } from "./migrationDrift";

const FILE = "-- Комментарий\ncreate table a (id int);\r\n\r\ngrant select on a to anon;\n";

describe("editedMigrations: применённая миграция изменена в файле", () => {
  it("тот же текст, разбитый CLI на операторы, — не правка (пробелы, переводы строк и «;» не важны)", () => {
    const applied = [
      {
        version: "1",
        statements: ["-- Комментарий\ncreate table a (id int)", "grant select on a to anon"],
      },
    ];
    expect(editedMigrations(applied, new Map([["1", FILE]]))).toEqual([]);
  });

  it("дописанная функция или изменённое тело — правка", () => {
    const applied = [
      { version: "1", statements: ["create table a (id int)", "grant select on a to anon"] },
      {
        version: "2",
        statements: ["create function f() returns int language sql as $$ select 1 $$"],
      },
    ];
    const files = new Map([
      [
        "1",
        "create table a (id int);\ngrant select on a to anon;\ncreate function g() returns int;",
      ],
      ["2", "create function f() returns int language sql as $$ select 2 $$;"],
    ]);
    expect(editedMigrations(applied, files)).toEqual(["1", "2"]);
  });

  it("нет файла (удалён локально) или текста (старый CLI) — не сверяем", () => {
    const applied = [
      { version: "1", statements: ["create table a (id int)"] },
      { version: "2", statements: null },
    ];
    expect(editedMigrations(applied, new Map([["2", FILE]]))).toEqual([]);
  });
});
