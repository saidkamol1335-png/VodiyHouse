import type { ReactNode } from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { BackgroundColumns } from "@/components/BackgroundColumns";
import { FilmGrain } from "@/components/FilmGrain";
import { HEAD_BOOT_SCRIPT } from "@/lib/boot/headScript";
import { HydrationMark } from "@/lib/boot/HydrationMark";
import { fontVariables } from "@/lib/fonts";
import { MotionController } from "@/lib/motion";

type RootDocumentProps = {
  lang: string;
  children: ReactNode;
  /** Линии колонок на фоне — только публичный сайт (дизайн-решение Э1, 19.10.2026). */
  withColumns?: boolean;
  /** Сообщения для браузера; без них — все (lib/i18n/clientMessages.ts). */
  messages?: AbstractIntlMessages;
};

/**
 * Общая оболочка <html> для корневых layout сайта, кабинета и /dev.
 * Сервер всегда рендерит светлую тему и lite; скрипт в <head> поправит до первой отрисовки.
 */
export function RootDocument({ lang, children, withColumns = false, messages }: RootDocumentProps) {
  return (
    <html
      lang={lang}
      data-theme="light"
      data-motion="lite"
      className={fontVariables}
      suppressHydrationWarning
    >
      {/* Правило написано для Pages Router; в App Router <head> корневого layout — штатный способ. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: HEAD_BOOT_SCRIPT }} />
      </head>
      <body>
        {withColumns ? <BackgroundColumns /> : null}
        <div className="page-layer">
          <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        </div>
        <FilmGrain />
        <MotionController />
        <HydrationMark />
      </body>
    </html>
  );
}
