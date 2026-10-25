// Три шрифта мокапа (PLAN §4): Manrope — интерфейс и текст, Cormorant Garamond курсив — акценты
// в заголовках, JetBrains Mono — подписи и данные. Кириллица нужна для /ru и кабинета.
// Заранее (<link rel="preload">) грузится только Manrope — им набран почти весь первый экран;
// акценты и подписи приходят следом (решение фазы 3 «Скорость»: LCP < 2,5 с на телефоне), а
// подменный шрифт next/font с подогнанными метриками держит строку на месте.
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
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
  preload: false,
});

export const fontVariables = [manrope.variable, cormorant.variable, jetbrainsMono.variable].join(" ");
