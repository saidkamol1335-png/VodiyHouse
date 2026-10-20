"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import { DEVELOPER_LIMITS } from "@/lib/admin/developers/mainForm";
import type { CreateDeveloperResult, FormAction } from "@/lib/admin/developers/types";

type DeveloperCreateFormProps = {
  /** Server Action: успех — переход на страницу нового застройщика; на стенде — подделка. */
  action: FormAction<CreateDeveloperResult>;
};

const IDLE: CreateDeveloperResult = { status: "idle" };

/** «+ Добавить застройщика»: кнопка раскрывает панель с названием (как «Добавить сотрудника»). */
export function DeveloperCreateForm({ action }: DeveloperCreateFormProps) {
  const t = useTranslations("admin.developers.create");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div className="developer-create developer-create--closed">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={16} strokeWidth={2} aria-hidden />
          {t("add")}
        </Button>
      </div>
    );
  }
  return <DeveloperCreatePanel action={action} onClose={() => setOpen(false)} />;
}

function DeveloperCreatePanel({
  action,
  onClose,
}: DeveloperCreateFormProps & { onClose: () => void }) {
  const t = useTranslations("admin.developers");
  const [state, formAction, pending] = useActionState(
    (_previous: CreateDeveloperResult, formData: FormData) => action(formData),
    IDLE,
  );
  const failed = state.status === "error" ? state : null;
  const nameIssue = failed?.fieldErrors.name;
  return (
    <AdminPanel title={t("create.title")} wide>
      <form className="developer-create" action={formAction} noValidate>
        <Field
          id="developer-create-name"
          name="name"
          autoComplete="off"
          autoFocus
          maxLength={DEVELOPER_LIMITS.nameMax}
          label={t("create.name")}
          hint={t("create.nameHint")}
          defaultValue={failed?.name}
          error={
            nameIssue ? t(`issues.${nameIssue}`, { min: DEVELOPER_LIMITS.nameMin }) : undefined
          }
        />
        {failed?.error ? <FormStatus tone="error">{t(`errors.${failed.error}`)}</FormStatus> : null}
        <div className="developer-create__actions">
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
