import type { Metadata } from "next";
import { RootDocument } from "@/components/RootDocument";
import { ADMIN_LOCALE } from "@/lib/i18n/routing";
import "../globals.css";

export const metadata: Metadata = {
  title: "Кабинет · Vodiy House",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <RootDocument lang={ADMIN_LOCALE}>{children}</RootDocument>;
}
