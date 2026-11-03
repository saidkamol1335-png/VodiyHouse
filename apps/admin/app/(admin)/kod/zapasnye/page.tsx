import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BackupCodes } from "@/components/SecondFactorForm/BackupCodes";
import { LoginCard } from "@/components/LoginCard";
import { LoginScreen } from "@/components/LoginScreen";
import { landingPath } from "@/lib/admin/nav";
import { factorState, renewBackupCodes } from "@/lib/admin/server/secondFactor";
import { requireViewer } from "@/lib/admin/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("admin.meta"))("secondFactor") };
}

export const instant = false;

/**
 * 10 запасных кодов руководителя (PLAN §10, п. 28) — сразу после подтверждения второго фактора,
 * когда неизрасходованных нет. Показываются один раз: при следующем открытии коды уже выданы.
 */
export default async function BackupCodesPage() {
  const viewer = await requireViewer();
  if (viewer.role !== "head") redirect(landingPath(viewer.role));
  const t = await getTranslations("admin.secondFactor");
  const state = await factorState(viewer.id);
  const codes = state.backupLeft === 0 ? await renewBackupCodes(viewer.id) : null;
  return (
    <LoginScreen>
      <LoginCard title={t("backupTitle")} lead={codes ? t("backupLead") : t("backupIssued", { count: state.backupLeft })} footer="password">
        <BackupCodes codes={codes} next={landingPath("head")} />
      </LoginCard>
    </LoginScreen>
  );
}
