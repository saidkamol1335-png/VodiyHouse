import { locale as rootLocale } from "next/root-params";
import { getRequestConfig } from "next-intl/server";
import { ADMIN_LOCALE, isLocale } from "./routing";

// Язык — из сегмента /[locale] (next/root-params). У кабинета и /dev этого сегмента нет:
// там undefined, и действует русский.
export default getRequestConfig(async ({ locale }) => {
  const segment = locale ?? (await rootLocale());
  const resolved = isLocale(segment) ? segment : ADMIN_LOCALE;
  return {
    locale: resolved,
    messages: (await import(`../../messages/${resolved}.json`)).default,
    timeZone: "Asia/Tashkent",
  };
});
