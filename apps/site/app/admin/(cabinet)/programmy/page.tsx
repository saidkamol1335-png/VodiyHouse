import { PaymentPrograms } from "@/components/PaymentPrograms";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
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

/** Список программ (шаг 2.4): руководитель правит, менеджер читает (PLAN §5, Р1–Р6). */
export default async function ProgramsPage({ searchParams }: ProgramsPageProps) {
  const { viewer, allowed } = await requireSection("programs");
  // Шапка и отказ — в layout раздела; без доступа и без базы здесь читать нечего.
  if (!allowed || isCabinetOpenWithoutLogin || !hasSupabaseEnv()) return null;
  const screen = await readProgramsScreen(await createSupabaseServerClient());
  const developer = (await searchParams).developer;
  return (
    <PaymentPrograms
      screen={screen}
      actions={viewer.role === "head" ? HEAD_ACTIONS : null}
      initialDeveloper={typeof developer === "string" ? developer : null}
      calcBase={ADMIN_ROUTES.programsCalc}
    />
  );
}
