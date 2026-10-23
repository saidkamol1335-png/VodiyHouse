import { describe, expect, it } from "vitest";
import ru from "@/messages/ru.json";
import { reachableModules, readSource, routeFiles } from "@/tests/unit/importGraph";
import {
  ADMIN_ROOT_MESSAGES,
  CABINET_NAMESPACE,
  pickMessages,
  siteMessages,
} from "./clientMessages";

const ADMIN_ROOT = ["layout.tsx", "error.tsx", "vhod/page.tsx", "parol/page.tsx"].map(
  (file) => `app/admin/${file}`,
);

/** Разделы useTranslations("…") клиентских модулей; «*» — вызов без раздела (нужно всё). */
function clientNamespaces(entries: readonly string[]): Set<string> {
  const namespaces = new Set<string>();
  for (const file of reachableModules(entries)) {
    const source = readSource(file);
    if (!/^["']use client["']/m.test(source)) continue;
    for (const match of source.matchAll(/useTranslations\(\s*(["'][^"']*["'])?\s*\)/g)) {
      namespaces.add(match[1]?.slice(1, -1) || "*");
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

  it("клиентские компоненты сайта не читают тексты кабинета", () => {
    const used = clientNamespaces(routeFiles("app/[locale]"));
    expect([...used].filter((namespace) => namespace.startsWith(CABINET_NAMESPACE))).toEqual([]);
  });

  it("корню /admin хватает разделов входа: каждый useTranslations вне кабинета ими покрыт", () => {
    const used = [...clientNamespaces(ADMIN_ROOT)];
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((namespace) => !covers(ADMIN_ROOT_MESSAGES, namespace))).toEqual([]);
  });
});
