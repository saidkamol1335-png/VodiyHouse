"use client";

import { useLocale, useTranslations } from "next-intl";
import { Segmented, segmentedItemClass } from "@/components/Segmented";
import { getPathname, Link, usePathname } from "@/lib/i18n/navigation";
import { LOCALES, type Locale } from "@/lib/i18n/routing";

type LanguageSwitchProps = {
  /** short — «RU | UZ» в шапке, full — «Русский | O‘zbekcha» в меню телефона (решение Ш3). */
  variant?: "short" | "full";
  onNavigate?: () => void;
};

// Порядок как в мокапе: RU слева.
const ORDER: readonly Locale[] = ["ru", "uz"];

/**
 * Та же страница на другом языке; выбор запоминает proxy.ts в cookie. Параметры адреса (расчёт
 * /kalkulyator, фильтры) переходят вместе с языком — их читаем в момент нажатия: страница меняет
 * их сама (history.replaceState), а шапка на сервере их не знает. С параметрами — обычный переход
 * страницы: смена языка пересобирает корневой layout, и клиентский переход ругается на его скрипт.
 */
export function LanguageSwitch({ variant = "short", onNavigate }: LanguageSwitchProps) {
  const t = useTranslations("header");
  const current = useLocale();
  const pathname = usePathname();
  const fullName: Record<Locale, string> = { ru: t("languageRu"), uz: t("languageUz") };
  return (
    <Segmented label={t("language")} size={variant === "short" ? "sm" : "lg"}>
      {ORDER.filter((locale) => LOCALES.includes(locale)).map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          className={segmentedItemClass(locale === current)}
          aria-current={locale === current ? "true" : undefined}
          lang={locale}
          onClick={(event) => {
            onNavigate?.();
            const search = window.location.search;
            if (!search) return;
            // Свой язык при параметрах — никуда не уходим: переход сбросил бы расчёт.
            event.preventDefault();
            if (locale !== current) {
              // Намеренно полная загрузка (см. выше), а не useRouter().push.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.assign(`${getPathname({ href: pathname, locale })}${search}`);
            }
          }}
        >
          {variant === "short" ? locale.toUpperCase() : fullName[locale]}
        </Link>
      ))}
    </Segmented>
  );
}
