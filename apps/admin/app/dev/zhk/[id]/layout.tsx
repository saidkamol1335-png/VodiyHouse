import type { ReactNode } from "react";
import { ComplexStandLayout, HEAD_STAND } from "../stand";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета
// (docs: instant-navigation) — иначе меню и вкладки (usePathname) вне <Suspense> падают.
export const instant = false;

type DevComplexLayoutProps = { children: ReactNode; params: Promise<{ id: string }> };

// Стенд страницы ЖК: вкладки-адреса, статус и готовность, как у /admin/zhk/<id>.
export default async function DevComplexLayout({ children, params }: DevComplexLayoutProps) {
  return (
    <ComplexStandLayout stand={HEAD_STAND} id={(await params).id}>
      {children}
    </ComplexStandLayout>
  );
}
