import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LoginCard } from "@/components/LoginCard";
import { LoginScreen } from "@/components/LoginScreen";
import { SecondFactorForm } from "@/components/SecondFactorForm";
import {
  sendLoginCodeAction,
  telegramLinkAction,
  verifyBackupCodeAction,
  verifyLoginCodeAction,
} from "@/lib/admin/actions/secondFactor";
import { secondFactorPageTarget } from "@/lib/admin/landing";
import { landingPath } from "@/lib/admin/nav";
import { factorState } from "@/lib/admin/server/secondFactor";
import { getCabinetSession } from "@/lib/admin/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("admin.meta"))("secondFactor") };
}

export const instant = false;

const ACTIONS = {
  link: telegramLinkAction,
  send: sendLoginCodeAction,
  verify: verifyLoginCodeAction,
  backup: verifyBackupCodeAction,
};

/** Код второго фактора руководителя (PLAN §10, п. 8): раз в 30 дней на устройство. Вне (cabinet). */
export default async function SecondFactorPage() {
  const session = await getCabinetSession();
  const target = secondFactorPageTarget(session.result);
  if (target) redirect(target);
  if (session.result.kind !== "secondFactor") redirect(landingPath("head"));
  const state = await factorState(session.result.viewer.id);
  const t = await getTranslations("admin.secondFactor");
  return (
    <LoginScreen>
      <LoginCard title={t("title")} lead={t(state.telegram ? "lead" : "leadFirst")} footer="password">
        <SecondFactorForm
          telegram={state.telegram}
          hasBackup={state.backupLeft > 0}
          actions={ACTIONS}
        />
      </LoginCard>
    </LoginScreen>
  );
}
