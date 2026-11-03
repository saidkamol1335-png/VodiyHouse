"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { deleteProgressReportAction } from "@/lib/admin/actions/progressReports";

/** «Удалить» черновик или возвращённый отчёт — с подтверждением; файлы удаляет сервер. */
export function DeleteReport({ id, returned }: { id: string; returned: boolean }) {
  const t = useTranslations("admin.video.mine");
  const tError = useTranslations("admin.developers.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const remove = () => {
    if (!window.confirm(t(returned ? "deleteConfirmReturned" : "deleteConfirm"))) return;
    const data = new FormData();
    data.set("id", id);
    start(async () => {
      const result = await deleteProgressReportAction(data);
      if (result.status === "error") return setError(tError(result.error));
      router.refresh();
    });
  };
  return (
    <>
      <Button variant="ghost" size="sm" onClick={remove} pending={pending}>
        <Trash2 size={16} aria-hidden="true" />
        {t("delete")}
      </Button>
      {error ? (
        <p className="progress-mine__error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
