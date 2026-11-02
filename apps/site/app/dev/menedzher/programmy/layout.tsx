import type { ReactNode } from "react";
import { DEV_MANAGER, ProgramsStandShell } from "../../programmy/stand";

export const instant = false;

// Стенд «Программ оплаты» менеджера: список только читает, расчёт — как у руководителя.
export default function DevManagerProgramsLayout({ children }: { children: ReactNode }) {
  return (
    <ProgramsStandShell viewer={DEV_MANAGER} base="/dev/menedzher/programmy">
      {children}
    </ProgramsStandShell>
  );
}
