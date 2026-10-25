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
  CALC_NAMESPACE,
  pickMessages,
  SITE_SHELL_MESSAGES,
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

  it("каждая страница сайта получает только тексты оболочки", () => {
    const picked = siteMessages(ru);
    expect(Object.keys(picked)).toEqual([...SITE_SHELL_MESSAGES]);
    expect(JSON.stringify(picked).length).toBeLessThan(JSON.stringify(ru).length / 50);
  });

  // Новый раздел сайта с клиентскими текстами без своего провайдера сломал бы страницу — тест раньше.
  it("клиентским модулям оболочки сайта хватает текстов оболочки", () => {
    const used = [...clientNamespaces(["app/[locale]/layout.tsx", "app/[locale]/page.tsx"])];
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((namespace) => namespace !== "*" && !covers(SITE_SHELL_MESSAGES, namespace))).toEqual([]);
  });

  // «*» на сайте допустим (меню берут подписи из разных разделов): кабинета в его сообщениях нет.
  it("клиентские модули сайта не читают тексты кабинета", () => {
    const used = [...clientNamespaces(routeFiles("app/[locale]"))];
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((namespace) => namespace.startsWith(CABINET_NAMESPACE))).toEqual([]);
    // Тексты калькулятора — только /kalkulyator: у неё свой провайдер с CALC_MESSAGES.
    const outside = routeFiles("app/[locale]").filter(
      (file) => !/[\\/]kalkulyator[\\/]/.test(file),
    );
    const elsewhere = [...clientNamespaces(outside)];
    expect(elsewhere.filter((namespace) => namespace.startsWith(CALC_NAMESPACE))).toEqual([]);
    const page = readSource("app/[locale]/kalkulyator/page.tsx");
    expect(page).toContain("pickMessages(messages, CALC_MESSAGES)");
  });

  it("корню /admin хватает разделов входа: каждый useTranslations вне кабинета ими покрыт", () => {
    expect(() => pickMessages(ru, ADMIN_ROOT_MESSAGES)).not.toThrow();
    const used = [...clientNamespaces(adminRootFiles())];
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((namespace) => !covers(ADMIN_ROOT_MESSAGES, namespace))).toEqual([]);
  });
});
