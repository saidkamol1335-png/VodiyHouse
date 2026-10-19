import type { Metadata } from "next";
import { RootDocument } from "@/components/RootDocument";
import { ADMIN_LOCALE } from "@/lib/i18n/routing";
import "../globals.css";

export const metadata: Metadata = {
  title: "Dev · Vodiy House",
  robots: { index: false, follow: false },
};

export default function DevLayout({ children }: LayoutProps<"/dev">) {
  return <RootDocument lang={ADMIN_LOCALE}>{children}</RootDocument>;
}
