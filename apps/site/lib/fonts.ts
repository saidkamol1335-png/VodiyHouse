// Три шрифта мокапа (PLAN §4): Manrope — интерфейс и текст, Cormorant Garamond курсив — акценты
// в заголовках, JetBrains Mono — подписи и данные. Кириллица нужна для /ru и кабинета.
// Заранее (<link rel="preload">) грузятся Manrope — им набран почти весь первый экран — и курсив
// Cormorant (акцент заголовка главной, 03.11.2026); подписи приходят следом (решение фазы 3
// «Скорость»: LCP < 2,5 с на телефоне), а подменный шрифт next/font с подогнанными метриками держит
// строку на месте.
import { Cormorant_Garamond, JetBrains_Mono, Manrope } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: "variable",
  variable: "--font-manrope",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
  style: "italic",
  variable: "--font-cormorant",
  display: "swap",
  // Курсив — в заголовке первого экрана главной («quruvchi narxida»): грузится заранее.
  preload: true,
});

// optional, а не swap: подписи моно шире подменного шрифта, и пришедший после первой отрисовки
// JetBrains перестраивал ряд цифр первого экрана (CLS главной 0,054 на тестовом деплое, ТЗ < 0,05).
// Не успел к отрисовке — страница остаётся на подменном; со следующей он уже из кэша.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "optional",
  preload: false,
});

// Прямой Cormorant — название ЖК на сайте (скин «Архитектурный люкс», 03.11.2026): карточка
// каталога, h1 страницы ЖК и цифры первого экрана главной — поэтому грузится заранее (одно начертание).
const cormorantDisplay = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["500"],
  style: "normal",
  variable: "--font-cormorant-display",
  display: "swap",
  preload: true,
});

export const fontVariables = [
  manrope.variable,
  cormorant.variable,
  cormorantDisplay.variable,
  jetbrainsMono.variable,
].join(" ");
