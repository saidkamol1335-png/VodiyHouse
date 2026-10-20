"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import { StaffPasswordReveal } from "@/components/StaffPasswordReveal";
import { isStaffRole, STAFF_ROLES, type StaffRole } from "@/lib/admin/access";
import { STAFF_LIMITS } from "@/lib/admin/credentials";
import { CREATE_STAFF_IDLE, type CreateStaffAction, type CreateStaffResult } from "@/lib/admin/staff/types";

type StaffCreateFormProps = {
  /** Server Action (lib/admin/actions/staff.ts); на /dev/staff — подделка. */
  action: CreateStaffAction;
};

/** «+ Добавить сотрудника» (С2): кнопка раскрывает широкую панель над списком. */
export function StaffCreateForm({ action }: StaffCreateFormProps) {
  const t = useTranslations("admin.staff");
  const [open, setOpen] = useState(false);
  // Новый ключ — новая панель: состояние с паролем исчезает после «Готово» или «Отмена».
  const [round, setRound] = useState(0);
  const close = () => {
    setOpen(false);
    setRound((value) => value + 1);
  };

  if (!open) {
    return (
      <div className="staff-create staff-create--closed">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={16} strokeWidth={2} aria-hidden />
          {t("add")}
        </Button>
      </div>
    );
  }
  return <StaffCreatePanel key={round} action={action} onClose={close} />;
}

function StaffCreatePanel({ action, onClose }: StaffCreateFormProps & { onClose: () => void }) {
  const t = useTranslations("admin.staff");
  // Обёртка: в действие уходит только FormData, прошлое состояние (с паролем) — нет.
  const [state, formAction, pending] = useActionState(
    (_previous: CreateStaffResult, formData: FormData) => action(formData),
    CREATE_STAFF_IDLE,
  );
  if (state.status === "created") {
    const { member, password } = state;
    return <StaffPasswordReveal name={member.fullName} email={member.email} password={password} onDone={onClose} />;
  }
  const failed = state.status === "error" ? state : null;
  const fieldError = (field: "fullName" | "email" | "role") => {
    const code = failed?.fieldErrors[field];
    return code ? t(`errors.${code}`, { max: STAFF_LIMITS.fullNameMax }) : undefined;
  };
  return (
    <AdminPanel title={t("add")} wide>
      <form className="staff-create" action={formAction} noValidate>
        <div className="staff-create__fields">
          <Field
            id="staff-full-name"
            name="fullName"
            autoComplete="off"
            maxLength={STAFF_LIMITS.fullNameMax}
            label={t("fields.fullName")}
            defaultValue={failed?.fields.fullName}
            error={fieldError("fullName")}
          />
          <Field
            id="staff-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            label={t("fields.email")}
            defaultValue={failed?.fields.email}
            error={fieldError("email")}
          />
          {/* key: после ответа сервера список роли встаёт на присланное значение. */}
          <RoleSelect key={failed?.fields.role ?? "manager"} initial={failed?.fields.role} error={fieldError("role")} />
        </div>
        {failed?.error ? <FormStatus tone="error">{t(`errors.${failed.error}`)}</FormStatus> : null}
        <div className="staff-create__actions">
          <Button type="submit" pending={pending}>
            {pending ? t("create.pending") : t("create.submit")}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t("create.cancel")}
          </Button>
        </div>
      </form>
    </AdminPanel>
  );
}

/**
 * Роль — системный список (как QuarterSelect), под ним — что этой роли доступно. Неуправляемый
 * (defaultValue): React 19 сбрасывает форму после действия, и управляемый список встал бы на
 * первый вариант — «Руководитель» — при старом состоянии.
 */
function RoleSelect({ initial, error }: { initial: string | undefined; error: string | undefined }) {
  const t = useTranslations("admin");
  const start: StaffRole = isStaffRole(initial) ? initial : "manager";
  const [role, setRole] = useState<StaffRole>(start);
  return (
    <div className="field">
      <label className="field__label" htmlFor="staff-role">
        {t("staff.fields.role")}
      </label>
      <span className="staff-create__role">
        <select
          id="staff-role"
          name="role"
          className={error ? "field__input field__input--error staff-create__select" : "field__input staff-create__select"}
          defaultValue={start}
          aria-describedby="staff-role-hint"
          onChange={(event) => isStaffRole(event.target.value) && setRole(event.target.value)}
        >
          {STAFF_ROLES.map((option) => (
            <option key={option} value={option}>
              {t(`user.roles.${option}`)}
            </option>
          ))}
        </select>
        <ChevronDown className="staff-create__chevron" size={16} aria-hidden="true" />
      </span>
      <p id="staff-role-hint" className={error ? "field__error" : "field__meta"}>
        {error ?? t(`staff.roleHints.${role}`)}
      </p>
    </div>
  );
}
