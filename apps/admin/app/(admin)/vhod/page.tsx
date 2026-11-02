import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginCard } from "@/components/LoginCard";
import { LoginForm } from "@/components/LoginForm";
import { LoginScreen } from "@/components/LoginScreen";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { signInAction } from "@/lib/admin/actions/auth";
import { ADMIN_ROUTES } from "@/lib/admin/nav";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("admin.meta"))("login") };
}

// Статичная страница: сессию не читает (proxy сюда никогда не перенаправляет обратно).
export default async function AdminLoginPage() {
  const t = await getTranslations("admin.login");
  return (
    <LoginScreen>
      <LoginCard title={t("title")} lead={t("lead")} footer="login">
        <LoginForm action={signInAction} devOpenHref={isCabinetOpenWithoutLogin ? ADMIN_ROUTES.home : null} />
      </LoginCard>
    </LoginScreen>
  );
}
