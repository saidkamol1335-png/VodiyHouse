import { describe, expect, it } from "vitest";
import ru from "@/messages/ru.json";
import uz from "@/messages/uz.json";
import { readSource } from "@/tests/unit/importGraph";

// Картинка превью (app/[locale]/opengraph-image.tsx) читает тексты через getTranslations({ locale,
// namespace }) — tsc такие ключи не проверяет, опечатку ловила только сборка. Тест — раньше.

type Tree = { [key: string]: string | Tree };

const lookup = (messages: Tree, path: string) =>
  path.split(".").reduce<string | Tree | undefined>((node, key) => (typeof node === "object" ? node[key] : undefined), messages);

describe("тексты картинки превью", () => {
  it("каждый t(\"…\") opengraph-image есть в ru и uz", () => {
    const source = readSource("app/[locale]/opengraph-image.tsx");
    const namespace = /namespace:\s*"([^"]+)"/.exec(source)?.[1];
    expect(namespace).toBeTruthy();
    const keys = [...source.matchAll(/\bt\("([^"]+)"/g)].map((match) => `${namespace}.${match[1]}`);
    expect(keys.length).toBeGreaterThan(0);
    for (const messages of [ru, uz] as unknown as Tree[]) {
      expect(keys.filter((key) => typeof lookup(messages, key) !== "string")).toEqual([]);
    }
  });
});
