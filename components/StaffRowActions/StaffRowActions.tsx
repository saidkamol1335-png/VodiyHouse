"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import { StaffPasswordReveal } from "@/components/StaffPasswordReveal";
import type { StaffRowActionSet } from "@/lib/admin/staff/types";

type StaffRowActionsProps = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  actions: StaffRowActionSet;
};

type Confirming = "disable" | "resetPassword" | null;
type Status = { tone: "success" | "error"; text: string } | null;

/**
 * Кнопки строки «Сотрудников» (С5): «Отключить» и «Новый пароль» — с подтверждением «Да / Отмена»
 * в строке, «Включить» — сразу. Новый пароль показывается один раз под строкой.
 */
export function StaffRowActions({ id, name, email, isActive, actions }: StaffRowActionsProps) {
  const t = useTranslations("admin.staff");
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [status, setStatus] = useState<Status>(null);
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
      setStatus(result.status === "reset" ? null : { tone: "error", text: t(`errors.${result.error}`) });
      if (result.status === "reset") setPassword(result.password);
    });

  const start = (next: Confirming) => {
    setStatus(null);
    setConfirming(next);
  };

  return (
    <div className="staff-actions">
      <div className="staff-actions__buttons">
        {isActive ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => start("disable")}>
            {t("actions.disable")}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" pending={pending && !confirming} onClick={() => setActive(true)}>
            {t("actions.enable")}
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => start("resetPassword")}>
          {t("actions.resetPassword")}
        </Button>
      </div>
      {confirming ? (
        <div className="staff-actions__panel staff-actions__confirm" role="group" aria-label={t(`actions.${confirming}`)}>
          <p className="staff-actions__question">{t(`confirm.${confirming}`, { name })}</p>
          <div className="staff-actions__answers">
            <Button
              size="sm"
              pending={pending}
              onClick={() => (confirming === "disable" ? setActive(false) : resetPassword())}
            >
              {t("actions.yes")}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(null)}>
              {t("actions.no")}
            </Button>
          </div>
        </div>
      ) : null}
      {status ? <FormStatus tone={status.tone} className="staff-actions__panel">{status.text}</FormStatus> : null}
      {password ? (
        <div className="staff-actions__panel">
          <StaffPasswordReveal name={name} email={email} password={password} onDone={() => setPassword(null)} />
        </div>
      ) : null}
    </div>
  );
}
