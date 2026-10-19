// Три шрифта мокапа (PLAN §4): Manrope — интерфейс и текст, Cormorant Garamond курсив — акценты
// в заголовках, JetBrains Mono — подписи и данные. Кириллица нужна для /ru и кабинета.
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
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const fontVariables = [manrope.variable, cormorant.variable, jetbrainsMono.variable].join(" ");
