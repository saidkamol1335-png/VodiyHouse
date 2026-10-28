"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import type { DeleteShowcaseResult, FormAction, ShowcaseKind } from "@/lib/admin/showcase/types";

type DeletePanelProps = {
  kind: ShowcaseKind;
  id: string;
  name: string;
  action: FormAction<DeleteShowcaseResult>;
};

const IDLE: DeleteShowcaseResult = { status: "idle" };

/** «Удалить» → панель подтверждения (архива у витрины нет: запись пропадает с сайта сразу). */
export function DeletePanel({ kind, id, name, action }: DeletePanelProps) {
  const t = useTranslations("admin.showcase.delete");
  const tErrors = useTranslations("admin.developers.errors");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    (_previous: DeleteShowcaseResult, formData: FormData) => action(formData),
    IDLE,
  );
  if (!open) {
    return (
      <div className="showcase-form__delete">
        <Button variant="danger" size="sm" onClick={() => setOpen(true)} aria-expanded={false}>
          {t("button")}
        </Button>
      </div>
    );
  }
  return (
    <form className="showcase-form__delete-panel" action={formAction} aria-labelledby={`${kind}-delete-title`}>
      <input type="hidden" name="owner" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="confirm" value="on" />
      <b id={`${kind}-delete-title`}>{t("title", { name })}</b>
      <p className="showcase-form__delete-lead">{t("lead")}</p>
      {state.status === "error" ? <FormStatus tone="error">{tErrors(state.error)}</FormStatus> : null}
      <div className="showcase-form__actions">
        <Button type="submit" variant="danger" pending={pending}>
          {pending ? t("pending") : t("confirm")}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
