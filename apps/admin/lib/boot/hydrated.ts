// Метка «React ожил» на <html>: обработчики навешены, нажатия не теряются. Ставит HydrationMark
// после первого рендера в браузере; общий переход e2e (tests/e2e/fixtures.ts) ждёт её перед
// действиями — dev-сервер под нагрузкой отдаёт HTML задолго до скриптов.

export const HYDRATED_ATTRIBUTE = "data-hydrated";

export function markHydrated(doc: Document = document): void {
  doc.documentElement.setAttribute(HYDRATED_ATTRIBUTE, "");
}
