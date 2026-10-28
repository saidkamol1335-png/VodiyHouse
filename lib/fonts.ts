// Три шрифта мокапа (PLAN §4): Manrope — интерфейс и текст, Cormorant Garamond курсив — акценты
// в заголовках, JetBrains Mono — подписи и данные. Кириллица нужна для /ru и кабинета.
// Заранее (<link rel="preload">) грузится только Manrope — им набран почти весь первый экран;
// акценты и подписи приходят следом (решение фазы 3 «Скорость»: LCP < 2,5 с на телефоне), а
// подменный шрифт next/font с подогнанными метриками держит строку на месте.
import { Cormorant_Garamond, Inter, JetBrains_Mono, Manrope } from "next/font/google";

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
  preload: false,
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

// Inter — только первый экран главной «Чертёж → стройка» (поручение исполнителя 28.10.2026, стиль
// портфолио; веса по промпту). Заранее не грузится: им набран один экран одной страницы, браузер
// берёт файл только там, где текст набран --font-body (styles/tokens.css); остальные страницы —
// по-прежнему «только Manrope заранее» (3.1).
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
  preload: false,
});

export const fontVariables = [manrope.variable, cormorant.variable, jetbrainsMono.variable, inter.variable].join(" ");
