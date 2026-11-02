// Шрифты кабинета: Manrope — интерфейс, JetBrains Mono — подписи и данные (как у сайта, без
// акцентного Cormorant — в кабинете его нет). Кириллица — кабинет на русском.
import { JetBrains_Mono, Manrope } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: "variable",
  variable: "--font-manrope",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
  preload: false,
});

export const fontVariables = [manrope.variable, jetbrainsMono.variable].join(" ");
