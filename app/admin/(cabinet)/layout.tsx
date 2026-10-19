import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { getCabinetViewer } from "@/lib/admin/access";
import { ADMIN_ROUTES } from "@/lib/admin/nav";

// Разделы кабинета — только для вошедшего сотрудника. Фаза 0: без входа — только в разработке.
export default function CabinetLayout({ children }: { children: ReactNode }) {
  const viewer = getCabinetViewer();
  if (!viewer) redirect(ADMIN_ROUTES.login);
  return <AdminShell viewer={viewer}>{children}</AdminShell>;
}
