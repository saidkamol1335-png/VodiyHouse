import type { ReactNode } from "react";
import { ComplexStandLayout, MANAGER_STAND } from "../../../zhk/stand";

// Адрес с [id] известен только на запросе — как у стенда руководителя.
export const instant = false;

type DevManagerComplexLayoutProps = { children: ReactNode; params: Promise<{ id: string }> };

// Страница ЖК менеджера: без статуса, готовности и вкладок — только «Квартиры» (Н2).
export default async function DevManagerComplexLayout({
  children,
  params,
}: DevManagerComplexLayoutProps) {
  return (
    <ComplexStandLayout stand={MANAGER_STAND} id={(await params).id}>
      {children}
    </ComplexStandLayout>
  );
}
