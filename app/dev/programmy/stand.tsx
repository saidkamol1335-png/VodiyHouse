import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminPage } from "@/components/AdminPage";
import { AdminShell } from "@/components/AdminShell";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminTopbar } from "@/components/AdminTopbar";
import { ClientCalculator } from "@/components/ClientCalculator";
import { PaymentPrograms } from "@/components/PaymentPrograms";
import type { CabinetViewer } from "@/lib/admin/access";
import { demoClientCalc } from "@/lib/admin/calc/demo";
import { clientCalcFrom } from "@/lib/admin/calc/screen";
import { cabinetPerson } from "@/lib/admin/person";
import { DEMO_PROGRAMS_SCREEN } from "@/lib/admin/programs/demo";
import { programsTabs } from "@/lib/admin/programs/tabs";
import { effectiveRate, type ProgramActions } from "@/lib/admin/programs/types";
import { readCalcParams } from "@/lib/calc/params";
import { pickMessages } from "@/lib/i18n/clientMessages";
import uz from "@/messages/uz.json";
import {
  demoCopyProgramAction,
  demoDeleteProgramAction,
  demoMarkProgramsCheckedAction,
  demoRefreshCbuRateAction,
  demoReorderProgramsAction,
  demoSaveCalculationAction,
  demoSaveProgramAction,
  demoSetManualRateAction,
  demoSetProgramActiveAction,
} from "./actions";

// Стенды «Программ оплаты» на DEMO мокапа: /dev/programmy — руководитель, /dev/menedzher/programmy —
// менеджер (читает, PLAN §5); вкладка «Расчёт для клиента» — у обоих. Те же компоненты, что у
// /admin/programmy; в продакшене стендов нет.

/** Менеджер стенда: список читает, считает — как руководитель (PLAN §3б, §5). */
export const DEV_MANAGER: CabinetViewer = {
  id: "dev-manager",
  role: "manager",
  name: null,
  mustChangePassword: false,
};

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

type ShellProps = { viewer: CabinetViewer; base: string; children: ReactNode };

/** Оболочка стенда: кабинет, шапка раздела и вкладки — как layout /admin/programmy. */
export async function ProgramsStandShell({ viewer, base, children }: ShellProps) {
  if (process.env.NODE_ENV === "production") notFound();
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin");
  const tabs = programsTabs(base, { list: t("calc.tabs.list"), calc: t("calc.tabs.calc") });
  return (
    <AdminShell viewer={viewer}>
      <AdminPage
        topbar={
          <AdminTopbar title={t("programs.title")} subtitle={t("dev.subtitle")} person={person} />
        }
      >
        <AdminTabs label={t("calc.tabsLabel")} tabs={tabs} />
        {children}
      </AdminPage>
    </AdminShell>
  );
}

type ListProps = { viewer: CabinetViewer; developer?: string | string[] };

export function ProgramsListStand({ viewer, developer }: ListProps) {
  return (
    <PaymentPrograms
      screen={DEMO_PROGRAMS_SCREEN}
      actions={viewer.role === "head" ? DEMO_ACTIONS : null}
      initialDeveloper={typeof developer === "string" ? developer : null}
    />
  );
}

type CalcProps = { search: Record<string, string | string[] | undefined> };

/** «Расчёт для клиента» на DEMO: тот же преобразователь записи, что у страницы с базой. */
export function ClientCalcStand({ search }: CalcProps) {
  const params = readCalcParams(search);
  const screen = clientCalcFrom(
    demoClientCalc(params.developer),
    effectiveRate(DEMO_PROGRAMS_SCREEN.rate),
  );
  return (
    <ClientCalculator
      screen={screen}
      initialParams={{ ...params, developer: screen.current?.slug ?? null }}
      uzMessages={pickMessages(uz, ["calc", "admin.calcTelegram"])}
      save={demoSaveCalculationAction}
    />
  );
}
