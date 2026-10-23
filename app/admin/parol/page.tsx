import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LoginCard } from "@/components/LoginCard";
import { LoginScreen } from "@/components/LoginScreen";
import { PasswordChangeForm } from "@/components/PasswordChangeForm";
import { changePasswordAction } from "@/lib/admin/actions/auth";
import { passwordPageTarget } from "@/lib/admin/landing";
import { getCabinetSession } from "@/lib/admin/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("admin.meta"))("password") };
}

// Сессия читается на каждый запрос, редирект — до первого байта (как у разделов кабинета).
export const instant = false;

/** Первый вход с паролем от руководителя: сначала свой пароль, потом кабинет. Вне (cabinet). */
export default async function AdminPasswordPage() {
  const session = await getCabinetSession();
  const target = passwordPageTarget(session.result);
  if (target) redirect(target);
  const t = await getTranslations("admin.password");
  return (
    <LoginScreen>
      <LoginCard title={t("title")} lead={t("lead")} footer="password">
        <PasswordChangeForm action={changePasswordAction} email={session.email ?? ""} />
      </LoginCard>
    </LoginScreen>
  );
}
