"use client";

import { useTranslations } from "next-intl";
import { AdminPanel } from "@/components/AdminPanel";
import { Button } from "@/components/Button";

/** Сервер входа не ответил: не выкидываем на вход, а предлагаем обновить (app/admin/error.tsx). */
export function AdminUnavailable({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("admin.unavailable");
  return (
    <main className="admin-unavailable">
      <div className="admin-unavailable__card">
        <AdminPanel title={t("title")}>
          <p className="admin-unavailable__lead">{t("lead")}</p>
          <Button onClick={onRetry}>{t("retry")}</Button>
        </AdminPanel>
      </div>
    </main>
  );
}
