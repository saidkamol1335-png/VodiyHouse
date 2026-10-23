import { describe, expect, it } from "vitest";
import ru from "@/messages/ru.json";
import {
  adminRootFiles,
  reachableClientModules,
  readSource,
  routeFiles,
} from "@/tests/unit/importGraph";
import {
  ADMIN_ROOT_MESSAGES,
  CABINET_NAMESPACE,
  pickMessages,
  siteMessages,
} from "./clientMessages";

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

  it("сайт получает всё, кроме текстов кабинета", () => {
    const picked = siteMessages(ru);
    expect(Object.keys(picked)).toEqual(Object.keys(ru).filter((key) => key !== CABINET_NAMESPACE));
    expect(JSON.stringify(picked).length).toBeLessThan(JSON.stringify(ru).length / 10);
  });

  // «*» на сайте допустим (меню берут подписи из разных разделов): кабинета в его сообщениях нет.
  it("клиентские модули сайта не читают тексты кабинета", () => {
    const used = [...clientNamespaces(routeFiles("app/[locale]"))];
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((namespace) => namespace.startsWith(CABINET_NAMESPACE))).toEqual([]);
  });

  it("корню /admin хватает разделов входа: каждый useTranslations вне кабинета ими покрыт", () => {
    expect(() => pickMessages(ru, ADMIN_ROOT_MESSAGES)).not.toThrow();
    const used = [...clientNamespaces(adminRootFiles())];
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((namespace) => !covers(ADMIN_ROOT_MESSAGES, namespace))).toEqual([]);
  });
});
