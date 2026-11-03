import type { Metadata } from "next";
import { headers } from "next/headers";
import { getMessages, getTranslations } from "next-intl/server";
import { RootDocument } from "@/components/RootDocument";
import { ADMIN_ROOT_MESSAGES, pickMessages } from "@/lib/i18n/clientMessages";
import { ADMIN_LOCALE } from "@/lib/i18n/routing";
import { NONCE_HEADER } from "@/lib/securityHeaders";
import "../globals.css";
import "../admin.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.meta");
  return { title: t("title"), robots: { index: false, follow: false } };
}

// CSP с nonce (фаза F, п. 45): кабинет рендерится на каждый запрос, статичной оболочки без nonce нет —
// иначе её скрипты браузер бы не выполнил. Поэтому и проверка статичной оболочки выключена.
export const instant = false;

// В браузер — только тексты входа и смены пароля; кабинет добавляет свои в (cabinet)/layout.
export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  const messages = pickMessages(await getMessages(), ADMIN_ROOT_MESSAGES);
  return (
    <RootDocument lang={ADMIN_LOCALE} messages={messages} nonce={nonce}>
      {children}
    </RootDocument>
  );
}
