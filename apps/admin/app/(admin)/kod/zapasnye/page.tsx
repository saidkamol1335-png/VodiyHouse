import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LoginCard } from "@/components/LoginCard";
import { LoginScreen } from "@/components/LoginScreen";
import { BackupCodes } from "@/components/SecondFactorForm/BackupCodes";
import { issueBackupCodesAction } from "@/lib/admin/actions/secondFactor";
import { landingPath } from "@/lib/admin/nav";
import { factorState } from "@/lib/admin/server/secondFactor";
import { requireViewer } from "@/lib/admin/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("admin.meta"))("secondFactor") };
}

export const instant = false;

/**
 * 10 запасных кодов руководителя (PLAN §10, п. 28) — сразу после подтверждения второго фактора,
 * когда неизрасходованных нет. Открытие страницы ничего не меняет: коды выдаёт кнопка (действие
 * со свежей проверкой Auth), показываются один раз.
 */
export default async function BackupCodesPage() {
  const viewer = await requireViewer();
  if (viewer.role !== "head") redirect(landingPath(viewer.role));
  const t = await getTranslations("admin.secondFactor");
  const state = await factorState(viewer.id);
  const needed = state.backupLeft === 0;
  return (
    <LoginScreen>
      <LoginCard title={t("backupTitle")} lead={needed ? t("backupLead") : t("backupIssued", { count: state.backupLeft })} footer="password">
        <BackupCodes issue={needed ? issueBackupCodesAction : null} next={landingPath("head")} />
      </LoginCard>
    </LoginScreen>
  );
}
