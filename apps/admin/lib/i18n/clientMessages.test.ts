import { describe, expect, it } from "vitest";
import ru from "@/messages/ru.json";
import { adminRootFiles, reachableClientModules, readSource } from "@/tests/unit/importGraph";
import { ADMIN_ROOT_MESSAGES, pickMessages } from "./clientMessages";

/**
 * Разделы useTranslations(…) модулей, которые уйдут в браузер. «*» — вызов без раздела или
 * с вычисляемым: что он прочтёт, статически не узнать, поэтому считаем, что нужно всё.
 */
function clientNamespaces(entries: readonly string[]): Set<string> {
  const namespaces = new Set<string>();
  for (const file of reachableClientModules(entries)) {
    for (const match of readSource(file).matchAll(/useTranslations\(([^)]*)\)/g)) {
      namespaces.add(/^\s*["']([^"']+)["']\s*$/.exec(match[1]!)?.[1] ?? "*");
    }
  }
  return namespaces;
}

const covers = (paths: readonly string[], namespace: string) =>
  paths.some((picked) => namespace === picked || namespace.startsWith(`${picked}.`));

describe("сообщения для браузера", () => {
  it("pickMessages копирует только названные ветки", () => {
    const messages = { a: { b: "1", c: { d: "2" } }, e: "3" };
    expect(pickMessages(messages, ["a.c", "e"])).toEqual({ a: { c: { d: "2" } }, e: "3" });
    expect(() => pickMessages(messages, ["a.x"])).toThrow("a.x");
  });

  // Тексты страниц сайта проверяет apps/site (PLAN §10): здесь — только кабинет.
  it("корню кабинета хватает разделов входа: каждый useTranslations вне кабинета ими покрыт", () => {
    expect(() => pickMessages(ru, ADMIN_ROOT_MESSAGES)).not.toThrow();
    const used = [...clientNamespaces(adminRootFiles())];
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((namespace) => !covers(ADMIN_ROOT_MESSAGES, namespace))).toEqual([]);
  });
});
