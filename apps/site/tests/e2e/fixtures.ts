import { test as base, type BrowserContext, type Page, type Response } from "@playwright/test";
import { HYDRATED_ATTRIBUTE } from "../../lib/boot/hydrated";
import { PRELOADER_SEEN_KEY } from "../../lib/boot/preloader";

// Общий `test` для всех спек: переход ждёт, пока React оживёт (решение исполнителя 28.10.2026, A).
// Dev-сервер под параллельной нагрузкой отдаёт HTML задолго до скриптов, и клик до гидратации
// уходил в пустоту (тема на /dev/preview: dev 5 из 12, прод-сборка 12 из 12). Ожидание
// networkidle не помогает — чанки ещё собираются. Поэтому после goto / reload / goBack /
// goForward страница ждёт data-hydrated на <html> (lib/boot/HydrationMark.tsx). Страницы без
// скрипта в <head> — нет data-js (глобальный 404, sitemap.xml, JSON, браузер без JavaScript) —
// ничего не ждут. Страницы, которые не оживут нарочно (чанки заблокированы): test.use({ hydration: false }).

export * from "@playwright/test";

/** Сколько ждать оживления: первая загрузка страницы в dev ещё и собирает её. */
const HYDRATION_TIMEOUT_MS = 30_000;

/** Ждёт data-hydrated на <html>; страницу без скрипта в <head> (нет data-js) не ждёт. */
export async function waitForHydration(page: Page): Promise<void> {
  const booted = await page
    .evaluate(() => document.documentElement.hasAttribute("data-js"))
    .catch(() => false);
  if (!booted) return;
  await page
    .locator(`html[${HYDRATED_ATTRIBUTE}]`)
    .waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT_MS })
    .catch(() => {
      throw new Error(
        `${page.url()} не ожила за ${HYDRATION_TIMEOUT_MS / 1000} с: на <html> нет ${HYDRATED_ATTRIBUTE} — ` +
          "скрипты не загрузились или React не гидратировался",
      );
    });
}

/** Контексты, чьи страницы не ждут оживления (test.use({ hydration: false })). */
const noHydration = new WeakSet<BrowserContext>();

/** Переходы страницы (goto, reload, goBack, goForward) завершаются оживлением. */
function withHydrationWait(page: Page): void {
  const goto = page.goto.bind(page);
  const reload = page.reload.bind(page);
  const goBack = page.goBack.bind(page);
  const goForward = page.goForward.bind(page);
  const settle = async (navigation: Promise<Response | null>) => {
    const response = await navigation;
    if (!noHydration.has(page.context())) await waitForHydration(page);
    return response;
  };
  page.goto = (url, options) => settle(goto(url, options));
  page.reload = (options) => settle(reload(options));
  page.goBack = (options) => settle(goBack(options));
  page.goForward = (options) => settle(goForward(options));
}

export type HydrationOptions = {
  /** false — страница не оживёт (скрипты заблокированы): переход её не ждёт. */
  hydration: boolean;
};

export const test = base.extend<HydrationOptions>({
  hydration: [true, { option: true }],
  // Один браузер на воркер: каждый контекст (и фикстурный, и browser.newContext() в тесте)
  // выдаёт страницы с ожиданием оживления.
  browser: [
    async ({ browser }, provide) => {
      const newContext = browser.newContext.bind(browser);
      browser.newContext = async (options) => {
        const context = await newContext(options);
        // Экран загрузки при входе закрыл бы главную на первые секунды каждого теста. Его спека
        // home-preloader открывает страницу с этим параметром.
        await context.addInitScript((key) => {
          try {
            if (!location.search.includes("e2e-preloader")) sessionStorage.setItem(key, "1");
          } catch {
            // about:blank: хранилища ещё нет
          }
        }, PRELOADER_SEEN_KEY);
        const newPage = context.newPage.bind(context);
        context.newPage = async () => {
          const page = await newPage();
          withHydrationWait(page);
          return page;
        };
        return context;
      };
      await provide(browser);
    },
    { scope: "worker" },
  ],
  context: async ({ context, hydration }, provide) => {
    if (!hydration) noHydration.add(context);
    await provide(context);
  },
});
