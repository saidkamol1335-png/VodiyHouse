"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import { StaffPasswordReveal } from "@/components/StaffPasswordReveal";
import type { StaffState } from "@/lib/admin/staff/directory";
import type { StaffRowActionSet } from "@/lib/admin/staff/types";
import { useStaffRowActions, type Confirming } from "./useStaffRowActions";

type StaffRowActionsProps = {
  id: string;
  name: string;
  email: string;
  /** Состояние строки: при расхождении базы и Auth кнопка повторяет недоделанное действие. */
  state: StaffState;
  actions: StaffRowActionSet;
};

// «Отключить» — и когда вход ещё не закрыт после отключения; «Включить» — и когда ещё закрыт.
const TURNS_OFF: ReadonlySet<StaffState> = new Set(["active", "pending", "inactiveNotBanned"]);

/**
 * Кнопки строки «Сотрудников» (С5): «Отключить» и «Новый пароль» — с подтверждением «Да / Отмена»
 * в строке, «Включить» — сразу. Новый пароль показывается один раз под строкой.
 */
export function StaffRowActions({ id, name, email, state, actions }: StaffRowActionsProps) {
  const t = useTranslations("admin.staff");
  const row = useStaffRowActions({ id, name, actions });
  return (
    <div className="staff-actions">
      <div className="staff-actions__buttons">
        {TURNS_OFF.has(state) ? (
          <Button size="sm" variant="ghost" disabled={row.pending} onClick={() => row.ask("disable")}>
            {t("actions.disable")}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" pending={row.pending && !row.confirming} onClick={row.enable}>
            {t("actions.enable")}
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={row.pending} onClick={() => row.ask("resetPassword")}>
          {t("actions.resetPassword")}
        </Button>
      </div>
      {row.confirming ? (
        <StaffRowConfirm kind={row.confirming} name={name} pending={row.pending} onYes={row.confirm} onNo={row.cancel} />
      ) : null}
      {row.status ? (
        <FormStatus tone={row.status.tone} className="staff-actions__panel">
          {row.status.text}
        </FormStatus>
      ) : null}
      {row.password ? (
        <div className="staff-actions__panel">
          <StaffPasswordReveal name={name} email={email} password={row.password} onDone={row.closePassword} />
        </div>
      ) : null}
    </div>
  );
}

type StaffRowConfirmProps = {
  kind: Exclude<Confirming, null>;
  name: string;
  pending: boolean;
  onYes: () => void;
  onNo: () => void;
};

/** Вопрос и «Да / Отмена» прямо в строке, без окна. */
function StaffRowConfirm({ kind, name, pending, onYes, onNo }: StaffRowConfirmProps) {
  const t = useTranslations("admin.staff");
  return (
    <div className="staff-actions__panel staff-actions__confirm" role="group" aria-label={t(`actions.${kind}`)}>
      <p className="staff-actions__question">{t(`confirm.${kind}`, { name })}</p>
      <div className="staff-actions__answers">
        <Button size="sm" pending={pending} onClick={onYes}>
          {t("actions.yes")}
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={onNo}>
          {t("actions.no")}
        </Button>
      </div>
    </div>
  );
}
