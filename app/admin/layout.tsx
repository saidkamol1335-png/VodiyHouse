import type { Metadata } from "next";
import { getMessages } from "next-intl/server";
import { RootDocument } from "@/components/RootDocument";
import { ADMIN_ROOT_MESSAGES, pickMessages } from "@/lib/i18n/clientMessages";
import { ADMIN_LOCALE } from "@/lib/i18n/routing";
import "../globals.css";
import "../admin.css";

export const metadata: Metadata = {
  title: "Кабинет · Vodiy House",
  robots: { index: false, follow: false },
};

// В браузер — только тексты входа и смены пароля; кабинет добавляет свои в (cabinet)/layout.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const messages = pickMessages(await getMessages(), ADMIN_ROOT_MESSAGES);
  return (
    <RootDocument lang={ADMIN_LOCALE} messages={messages}>
      {children}
    </RootDocument>
  );
}
