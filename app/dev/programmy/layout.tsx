import type { ReactNode } from "react";
import { DEV_VIEWER } from "@/lib/admin/access";
import { ProgramsStandShell } from "./stand";

export const instant = false;

// Стенд «Программ оплаты» руководителя (шаги 2.4–2.5): вкладки списка и «Расчёта для клиента».
export default function DevProgramsLayout({ children }: { children: ReactNode }) {
  return (
    <ProgramsStandShell viewer={DEV_VIEWER} base="/dev/programmy">
      {children}
    </ProgramsStandShell>
  );
}
