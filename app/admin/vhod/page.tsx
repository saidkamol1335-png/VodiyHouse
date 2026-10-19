import type { Metadata } from "next";
import { LoginScreen } from "@/components/LoginScreen";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { ADMIN_ROUTES } from "@/lib/admin/nav";

export const metadata: Metadata = {
  title: "Вход · Кабинет · Vodiy House",
};

export default function AdminLoginPage() {
  return <LoginScreen devOpenHref={isCabinetOpenWithoutLogin ? ADMIN_ROUTES.home : null} />;
}
