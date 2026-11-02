import { getRequestConfig } from "next-intl/server";
import { ADMIN_LOCALE } from "./routing";

// Кабинет (PLAN §10) — только на русском: сегмента /[locale] у админки нет.
export default getRequestConfig(async () => ({
  locale: ADMIN_LOCALE,
  messages: (await import("../../messages/ru.json")).default,
  timeZone: "Asia/Tashkent",
}));
