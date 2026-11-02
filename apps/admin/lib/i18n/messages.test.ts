import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";
import ru from "@/messages/ru.json";
import uz from "@/messages/uz.json";
import { CABINET_NAMESPACE } from "./clientMessages";

// Сайт двуязычный (ТЗ 1.1): у каждого текста сайта есть узбекский двойник с теми же
// подстановками — иначе /uz упадёт на t("…", { price }) или покажет «{price}» буквами.
// Кабинет — на русском; из него по-узбекски только строки скидки для Telegram (admin.calcTelegram).

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result.set(path, value);
    else for (const [inner, text] of leaves(value, path)) result.set(inner, text);
  }
  return result;
}

/** Имена подстановок сообщения: {price}, {count, plural, …} — с вложенными вариантами. */
function argumentsOf(message: string): string[] {
  const names = new Set<string>();
  const walk = (elements: MessageFormatElement[]) => {
    for (const element of elements) {
      if (element.type === TYPE.literal || element.type === TYPE.pound) continue;
      names.add(element.value);
      if (element.type === TYPE.select || element.type === TYPE.plural) {
        for (const option of Object.values(element.options)) walk(option.value);
      }
      if (element.type === TYPE.tag) walk(element.children);
    }
  };
  walk(parse(message, { ignoreTag: true }));
  return [...names].sort();
}

const siteRu = leaves(
  Object.fromEntries(Object.entries(ru).filter(([key]) => key !== CABINET_NAMESPACE)) as Tree,
);
const siteUz = leaves(
  Object.fromEntries(Object.entries(uz).filter(([key]) => key !== CABINET_NAMESPACE)) as Tree,
);

describe("тексты ru и uz", () => {
  it("у каждого текста сайта есть узбекский, лишних нет", () => {
    expect([...siteUz.keys()].sort()).toEqual([...siteRu.keys()].sort());
  });

  it("подстановки одинаковые", () => {
    const differ = [...siteRu].filter(
      ([key, text]) =>
        siteUz.has(key) && argumentsOf(text).join() !== argumentsOf(siteUz.get(key)!).join(),
    );
    expect(differ.map(([key]) => key)).toEqual([]);
  });

  it("строки скидки для Telegram из кабинета — на обоих языках", () => {
    const telegramRu = leaves(ru.admin.calcTelegram);
    const telegramUz = leaves((uz as { admin: { calcTelegram: Tree } }).admin.calcTelegram);
    expect([...telegramUz.keys()]).toEqual([...telegramRu.keys()]);
    for (const [key, text] of telegramRu)
      expect(argumentsOf(telegramUz.get(key)!), key).toEqual(argumentsOf(text));
    expect(Object.keys((uz as { admin: object }).admin)).toEqual(["calcTelegram"]);
  });
});
