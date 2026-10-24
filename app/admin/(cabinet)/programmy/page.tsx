import { getTranslations } from "next-intl/server";
import { AdminDenied } from "@/components/AdminDenied";
import { AdminPage } from "@/components/AdminPage";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminTopbar } from "@/components/AdminTopbar";
import { PaymentPrograms } from "@/components/PaymentPrograms";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import {
  copyProgramAction,
  deleteProgramAction,
  markProgramsCheckedAction,
  refreshCbuRateAction,
  reorderProgramsAction,
  saveProgramAction,
  setManualRateAction,
  setProgramActiveAction,
} from "@/lib/admin/actions/programs";
import { cabinetPerson } from "@/lib/admin/person";
import type { ProgramActions } from "@/lib/admin/programs/types";
import { readProgramsScreen } from "@/lib/admin/server/programs";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

const HEAD_ACTIONS: ProgramActions = {
  save: saveProgramAction,
  setActive: setProgramActiveAction,
  remove: deleteProgramAction,
  copy: copyProgramAction,
  reorder: reorderProgramsAction,
  markChecked: markProgramsCheckedAction,
  setManualRate: setManualRateAction,
  refreshCbuRate: refreshCbuRateAction,
};

type ProgramsPageProps = { searchParams: Promise<{ developer?: string | string[] }> };

/** «Программы оплаты» (шаг 2.4): руководитель правит, менеджер читает (PLAN §5, Р1–Р6). */
export default async function ProgramsPage({ searchParams }: ProgramsPageProps) {
  const { viewer, allowed } = await requireSection("programs");
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin");
  const topbar = (
    <AdminTopbar title={t("programs.title")} subtitle={t("programs.subtitle")} person={person} />
  );
  if (!allowed) {
    return (
      <AdminPage topbar={topbar}>
        <AdminDenied section={t("nav.programs")} />
      </AdminPage>
    );
  }
  if (isCabinetOpenWithoutLogin || !hasSupabaseEnv()) {
    return (
      <AdminPage topbar={topbar}>
        <AdminPanel title={t("programs.title")}>{t("developers.errors.notConfigured")}</AdminPanel>
      </AdminPage>
    );
  }
  const screen = await readProgramsScreen(await createSupabaseServerClient());
  const developer = (await searchParams).developer;
  return (
    <AdminPage topbar={topbar}>
      <PaymentPrograms
        screen={screen}
        actions={viewer.role === "head" ? HEAD_ACTIONS : null}
        initialDeveloper={typeof developer === "string" ? developer : null}
      />
    </AdminPage>
  );
}
