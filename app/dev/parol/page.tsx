import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LoginCard } from "@/components/LoginCard";
import { LoginScreen } from "@/components/LoginScreen";
import { PasswordChangeForm } from "@/components/PasswordChangeForm";
import { demoChangePasswordAction } from "./actions";
import { DEMO_EMAIL } from "./demo";

// Стенд первой смены пароля (шаг 8): настоящая форма и ядро, Supabase подменён.
// Временный пароль DEMO — в ./demo.ts. В продакшене страницы нет.
export default async function DevPasswordPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const t = await getTranslations("admin.password");
  return (
    <LoginScreen>
      <LoginCard title={t("title")} lead={t("lead")} footer="password">
        <PasswordChangeForm action={demoChangePasswordAction} email={DEMO_EMAIL} />
      </LoginCard>
    </LoginScreen>
  );
}
