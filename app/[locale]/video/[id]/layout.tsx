import type { ReactNode } from "react";
import "../../../complex.css";

// Адрес читается сразу, вне <Suspense>: чужой или снятый с публикации отчёт отвечает настоящим 404.
export const instant = false;

// Видео квартиры для клиента (фаза 5): плеер «Хода строительства» и блоки страницы — из набора
// страницы ЖК; стили калькулятора приходят с его чанком по «Рассчитать платёж» (как на странице ЖК).
export default function UnitVideoLayout({ children }: { children: ReactNode }) {
  return children;
}
