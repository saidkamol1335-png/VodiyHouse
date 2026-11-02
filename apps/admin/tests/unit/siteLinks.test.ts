import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readSource } from "./importGraph";

// Сайт — отдельное приложение (PLAN §10): путь сайта без адреса («/ru/…», `/${lang}…`) в кабинете
// открывает сам кабинет — «На сайт» вёл на вход, ссылки ЖК и видео давали 404. Адрес сайта —
// siteOrigin() на сервере. Исключения: модули сайта, скопированные в кабинет (маршруты сайта,
// метаданные, i18n), и служебные стенды /dev.

const ROOTS = ["app", "components", "lib"];
const SKIP = [/^lib[\\/](site|i18n)[\\/]/, /^lib[\\/]routes/, /^app[\\/]dev[\\/]/, /\.test\.tsx?$/, /\.d\.ts$/];
// Строка с путём сайта: "/ru…", '/uz…', `/ru…`, `/${lang}…` / `/${locale}…` — в начале литерала.
// И «сайт» — просто «/»: siteHref="/", SITE_HREF = "/" (корень кабинета — его же главная).
const SITE_PATH =
  /(["'`])\/(?:ru|uz)(?:[/"'`#?]|\$\{)|`\/\$\{[^}]*(?:[Ll]ang|[Ll]ocale)[^}]*\}|\bsite\w*\s*[=:]\s*\{?\s*["'`]\/["'`]/i;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return files(file);
    return /\.tsx?$/.test(name) ? [file] : [];
  });
}

/** Строки кода без комментариев: в комментариях пути сайта — просто пояснение. */
const codeLines = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .split("\n")
    .map((line) => line.replace(/(^|[^:"'`])\/\/.*$/, "$1"));

describe("ссылки кабинета на сайт", () => {
  it("путь сайта — только с адресом сайта (siteOrigin), не относительно кабинета", () => {
    const found = ROOTS.flatMap((root) => files(root))
      .filter((file) => !SKIP.some((skip) => skip.test(file)))
      .flatMap((file) =>
        codeLines(readSource(file)).flatMap((line, index) =>
          SITE_PATH.test(line) && !/siteOrigin\(\)|\$\{site\}/.test(line) ? [`${file}:${index + 1}`] : [],
        ),
      );
    expect(found).toEqual([]);
  });
});
