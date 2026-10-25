import type { ReactNode } from "react";
import "../../../calc.css";
import "../../../complex.css";

// Адрес ЖК читается сразу, вне <Suspense>: неизвестный адрес отвечает настоящим 404, а новый ЖК
// рендерится при первом заходе и дальше отдаётся из кэша (у известных — сборка); навигация в
// страницу не обязана быть мгновенной (как у [id] кабинета).
export const instant = false;

// Страница ЖК (шаг 3.5): блоки калькулятора («Расчёт для этой квартиры») и страницы — своими
// файлами, только ей, а не каждой странице сайта.
export default function ComplexLayout({ children }: { children: ReactNode }) {
  return children;
}
