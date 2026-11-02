"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type { StaffRowActionSet } from "@/lib/admin/staff/types";

export type Confirming = "disable" | "resetPassword" | null;
export type RowStatus = { tone: "success" | "error"; text: string } | null;

/** Состояние строки «Сотрудников»: что подтверждаем, ответ действия, пароль на показ. */
export function useStaffRowActions({ id, name, actions }: { id: string; name: string; actions: StaffRowActionSet }) {
  const t = useTranslations("admin.staff");
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [status, setStatus] = useState<RowStatus>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const formWith = (fields: Record<string, string>) => {
    const formData = new FormData();
    formData.set("id", id);
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    return formData;
  };

  const setActive = (active: boolean) =>
    startTransition(async () => {
      const result = await actions.setActive(formWith({ active: String(active) }));
      setConfirming(null);
      setStatus(
        result.status === "done"
          ? { tone: "success", text: t(active ? "done.enabled" : "done.disabled", { name }) }
          : { tone: "error", text: t(`errors.${result.error}`) },
      );
    });

  const resetPassword = () =>
    startTransition(async () => {
      const result = await actions.resetPassword(formWith({}));
      setConfirming(null);
      if (result.status === "reset") setPassword(result.password);
      setStatus(result.status === "reset" ? null : { tone: "error", text: t(`errors.${result.error}`) });
    });

  const ask = (next: Exclude<Confirming, null>) => {
    setStatus(null);
    setConfirming(next);
  };

  return {
    confirming,
    status,
    password,
    pending,
    ask,
    cancel: () => setConfirming(null),
    confirm: () => (confirming === "disable" ? setActive(false) : resetPassword()),
    enable: () => setActive(true),
    closePassword: () => setPassword(null),
  };
}
