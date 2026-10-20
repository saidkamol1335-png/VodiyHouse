import type { ReactNode } from "react";
import { AdminShell } from "@/components/AdminShell";
import { requireViewer } from "@/lib/admin/session";

// Сессия читается на каждый запрос и не попадает в статичную оболочку: раздел ждёт её на сервере,
// чтобы редирект на вход был настоящим 307, а не тегом после начала потока (docs: instant-navigation).
export const instant = false;

// Разделы кабинета — только для вошедшего сотрудника (lib/admin/session.ts).
export default async function CabinetLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();
  return <AdminShell viewer={viewer}>{children}</AdminShell>;
}
