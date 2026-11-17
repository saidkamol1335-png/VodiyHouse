// Прогрев dev-сервера перед e2e (17.11.2026): next dev 16.4 дописывает .next/dev/prerender-manifest.json
// при первом заходе на страницу с generateStaticParams — без блокировки. Восемь воркеров, открывших
// такие страницы разом, портили файл (хвост старой записи после новой), и сайт отвечал 500 на всё.
// Здесь эти страницы открываются по очереди — дальше файл уже не меняется. Сервер-копия прода и сборка
// этим не затронуты.

const PATHS = [
  "/ru",
  "/uz",
  "/ru/novostroyki",
  "/uz/novostroyki",
  "/ru/novostroyki/demo-shodlik",
  "/uz/novostroyki/demo-shodlik",
  "/ru/podborka",
  "/uz/podborka",
  "/ru/izbrannoe",
  "/uz/izbrannoe",
  "/ru/o-nas",
  "/ru/kalkulyator",
  "/ru/zastroyshchiki",
  "/ru/zastroyshchiki/demo-sifat",
];

export default async function warmup(): Promise<void> {
  const base = `http://localhost:${Number(process.env.E2E_PORT) || 3000}`;
  for (const path of PATHS) {
    try {
      await fetch(`${base}${path}`, { signal: AbortSignal.timeout(120_000) });
    } catch {
      // Страница не ответила — тест на ней сам покажет причину.
    }
  }
}
