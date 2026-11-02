import type { ReactNode } from "react";
import "../../../complex.css";

// Адрес ЖК читается сразу, вне <Suspense>: неизвестный адрес отвечает настоящим 404, а новый ЖК
// рендерится при первом заходе и дальше отдаётся из кэша (у известных — сборка); навигация в
// страницу не обязана быть мгновенной (как у [id] кабинета).
export const instant = false;

// Страница ЖК (шаг 3.5): блоки страницы — своим файлом, только ей; стили калькулятора («Расчёт для
// этой квартиры») приходят с его чанком по первому «Рассчитать платёж» (useLayoutCalc.ts).
export default function ComplexLayout({ children }: { children: ReactNode }) {
  return children;
}
