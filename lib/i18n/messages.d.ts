import type ru from "@/messages/ru.json";
import type { Locale } from "./routing";

// Ключи сообщений проверяются типами: опечатка в t("nav.nwe") — ошибка typecheck.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof ru;
  }
}
