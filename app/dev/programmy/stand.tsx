import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/AdminPage";
import { AdminShell } from "@/components/AdminShell";
import { AdminTopbar } from "@/components/AdminTopbar";
import { PaymentPrograms } from "@/components/PaymentPrograms";
import type { CabinetViewer } from "@/lib/admin/access";
import { cabinetPerson } from "@/lib/admin/person";
import { DEMO_PROGRAMS_SCREEN } from "@/lib/admin/programs/demo";
import type { ProgramActions } from "@/lib/admin/programs/types";
import {
  demoCopyProgramAction,
  demoDeleteProgramAction,
  demoMarkProgramsCheckedAction,
  demoRefreshCbuRateAction,
  demoReorderProgramsAction,
  demoSaveProgramAction,
  demoSetManualRateAction,
  demoSetProgramActiveAction,
} from "./actions";

// Стенды «Программ оплаты» на DEMO мокапа: /dev/programmy — руководитель, /dev/menedzher/programmy —
// менеджер (читает, PLAN §5). Тот же экран, что у /admin/programmy; в продакшене стендов нет.

const DEMO_ACTIONS: ProgramActions = {
  save: demoSaveProgramAction,
  setActive: demoSetProgramActiveAction,
  remove: demoDeleteProgramAction,
  copy: demoCopyProgramAction,
  reorder: demoReorderProgramsAction,
  markChecked: demoMarkProgramsCheckedAction,
  setManualRate: demoSetManualRateAction,
  refreshCbuRate: demoRefreshCbuRateAction,
};

type ProgramsStandProps = { viewer: CabinetViewer; developer?: string | string[] };

export async function ProgramsStand({ viewer, developer }: ProgramsStandProps) {
  if (process.env.NODE_ENV === "production") notFound();
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin");
  return (
    <AdminShell viewer={viewer}>
      <AdminPage
        topbar={
          <AdminTopbar title={t("programs.title")} subtitle={t("dev.subtitle")} person={person} />
        }
      >
        <PaymentPrograms
          screen={DEMO_PROGRAMS_SCREEN}
          actions={viewer.role === "head" ? DEMO_ACTIONS : null}
          initialDeveloper={typeof developer === "string" ? developer : null}
        />
      </AdminPage>
    </AdminShell>
  );
}
