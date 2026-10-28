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
  CATALOG_MESSAGES,
  CALC_NAMESPACE,
  COMPLEX_MESSAGES,
  ABOUT_MESSAGES,
  DEVELOPERS_LIST_MESSAGES,
  DEVELOPERS_MESSAGES,
  FAVORITES_MESSAGES,
  LAZY_SITE_MESSAGES,
  PARTNERS_MESSAGES,
  pickMessages,
  SHOWCASE_MESSAGES,
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

const isComplexRoute = (file: string) => /[\\/]novostroyki[\\/]\[slug\][\\/]/.test(file);

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
    // Все страницы сайта, кроме калькулятора: у него свой провайдер с CALC_MESSAGES. Страница со
    // своим провайдером каталога получает и его тексты.
    const pages = routeFiles("app/[locale]").filter((file) => !/[\\/]kalkulyator[\\/]/.test(file));
    // Страница ЖК: провайдер с COMPLEX_MESSAGES ставит page.tsx — его получают и разделы рядом.
    // Главная: каталог с подборками (HomeCatalog) и «Предложения от застройщиков» (HomeOffers) —
    // каждый со своим провайдером, остальные разделы — серверные.
    const allowedFor = (file: string): readonly string[] => {
      if (isComplexRoute(file)) return COMPLEX_MESSAGES;
      const source = readSource(file);
      const uses = (marker: string) => source.includes(`pickMessages(messages, ${marker})`);
      const picked = [
        ...(uses("CATALOG_MESSAGES") || source.includes("<HomeCatalog") ? CATALOG_MESSAGES : []),
        ...(source.includes("<HomeOffers") ? SHOWCASE_MESSAGES : []),
        ...(uses("FAVORITES_MESSAGES") ? FAVORITES_MESSAGES : []),
        ...(uses("PARTNERS_MESSAGES") ? PARTNERS_MESSAGES : []),
        ...(uses("ABOUT_MESSAGES") ? ABOUT_MESSAGES : []),
        ...(uses("DEVELOPERS_MESSAGES") ? DEVELOPERS_MESSAGES : []),
        ...(uses("DEVELOPERS_LIST_MESSAGES") ? DEVELOPERS_LIST_MESSAGES : []),
      ];
      return picked.length > 0 ? picked : SITE_SHELL_MESSAGES;
    };
    // Тексты окна заявки приходят с самим окном (LAZY_SITE_MESSAGES) — их провайдер ставит LeadProvider.
    const missing = pages.flatMap((file) =>
      [...clientNamespaces([file])]
        .filter((namespace) => namespace !== "*" && !covers([...allowedFor(file), ...LAZY_SITE_MESSAGES], namespace))
        .map((namespace) => `${file}: ${namespace}`),
    );
    expect(clientNamespaces(pages).size).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  // «*» на сайте допустим (меню берут подписи из разных разделов): кабинета в его сообщениях нет.
  it("клиентские модули сайта не читают тексты кабинета", () => {
    const used = [...clientNamespaces(routeFiles("app/[locale]"))];
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((namespace) => namespace.startsWith(CABINET_NAMESPACE))).toEqual([]);
    // Тексты калькулятора — только /kalkulyator и странице ЖК («Расчёт для этой квартиры»): у них
    // свои провайдеры с CALC_MESSAGES и COMPLEX_MESSAGES.
    const outside = routeFiles("app/[locale]").filter(
      (file) => !/[\\/]kalkulyator[\\/]/.test(file) && !isComplexRoute(file),
    );
    const elsewhere = [...clientNamespaces(outside)];
    expect(elsewhere.filter((namespace) => namespace.startsWith(CALC_NAMESPACE))).toEqual([]);
    const page = readSource("app/[locale]/kalkulyator/page.tsx");
    expect(page).toContain("pickMessages(messages, CALC_MESSAGES)");
    expect(readSource("app/[locale]/novostroyki/[slug]/page.tsx")).toContain("pickMessages(messages, COMPLEX_MESSAGES)");
    expect(COMPLEX_MESSAGES).toContain(CALC_NAMESPACE);
  });

  it("корню /admin хватает разделов входа: каждый useTranslations вне кабинета ими покрыт", () => {
    expect(() => pickMessages(ru, ADMIN_ROOT_MESSAGES)).not.toThrow();
    const used = [...clientNamespaces(adminRootFiles())];
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((namespace) => !covers(ADMIN_ROOT_MESSAGES, namespace))).toEqual([]);
  });
});
