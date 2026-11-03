"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import type { ComplexListRow } from "@/lib/admin/complexes/list";
import type { ComplexStatusResult, DeleteNowResult } from "@/lib/admin/complexes/types";

/** Действия строки списка (экран 2) — только руководителю. */
export type RowActions = {
  setStatus: (formData: FormData) => Promise<ComplexStatusResult>;
  deleteNow: (formData: FormData) => Promise<DeleteNowResult>;
};

type ComplexRowActionsProps = {
  row: ComplexListRow;
  actions: RowActions;
  /** «Вернуть» на сайт — через «Публикацию»: там проверка файлов по правилу 1.2 (И8). */
  publicationHref: string;
};

type Confirm = "archive" | "delete" | null;

/**
 * Скрыть · Вернуть · В архив · Восстановить · Удалить сейчас (PLAN §10, пп. 23–24). Архив и удаление
 * подтверждаются вводом названия — как в капсуле статуса.
 */
export function ComplexRowActions({ row, actions, publicationHref }: ComplexRowActionsProps) {
  const t = useTranslations("admin.complexes.rowActions");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const name = row.name.ru;
  return (
    <div className="complex-list__actions" role="group" aria-label={t("label", { name })}>
      <div className="complex-list__buttons">
        {row.status === "published" ? <StatusButton row={row} to="hidden" action={actions.setStatus} /> : null}
        {row.status === "hidden" ? (
          <Button size="sm" variant="ghost" href={publicationHref}>
            {t("unhide")}
          </Button>
        ) : null}
        {row.status === "archived" ? <StatusButton row={row} to="draft" action={actions.setStatus} /> : null}
        {row.status === "archived" ? (
          <Button size="sm" variant="danger" aria-expanded={confirm === "delete"} onClick={() => setConfirm("delete")}>
            {t("deleteNow")}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" aria-expanded={confirm === "archive"} onClick={() => setConfirm("archive")}>
            {t("archive")}
          </Button>
        )}
      </div>
      {confirm === "archive" ? (
        <NameConfirm row={row} kind="archive" action={actions.setStatus} onCancel={() => setConfirm(null)} />
      ) : null}
      {confirm === "delete" ? (
        <NameConfirm row={row} kind="delete" action={actions.deleteNow} onCancel={() => setConfirm(null)} />
      ) : null}
    </div>
  );
}

type Result = ComplexStatusResult | DeleteNowResult;
const IDLE = { status: "idle" } as const;

function useResult(action: (formData: FormData) => Promise<Result>) {
  return useActionState((_previous: Result, formData: FormData) => action(formData), IDLE as Result);
}

function ResultLine({ state, done }: { state: Result; done: string }) {
  const t = useTranslations("admin.complexes.rowActions");
  const errors = useTranslations("admin.developers.errors");
  if (state.status === "done") return <FormStatus tone="success">{done}</FormStatus>;
  if (state.status !== "error") return null;
  if (state.error === "csvNotSent") return <FormStatus tone="error">{t("csvNotSent")}</FormStatus>;
  return <FormStatus tone="error">{errors((state.error ?? "unknown") as "unknown")}</FormStatus>;
}

type StatusButtonProps = {
  row: ComplexListRow;
  to: "hidden" | "draft";
  action: (formData: FormData) => Promise<ComplexStatusResult>;
};

/** Одна кнопка — один переход без подтверждения: «Скрыть» и «Восстановить» обратимы. */
function StatusButton({ row, to, action }: StatusButtonProps) {
  const t = useTranslations("admin.complexes.rowActions");
  const [state, formAction, pending] = useResult(action);
  return (
    <form action={formAction} className="complex-list__form">
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="to" value={to} />
      <Button type="submit" size="sm" variant="ghost" pending={pending}>
        {pending ? t("pending") : t(to === "hidden" ? "hide" : "restore")}
      </Button>
      <ResultLine state={state} done={t(`done.${to}`)} />
    </form>
  );
}

type NameConfirmProps = {
  row: ComplexListRow;
  kind: "archive" | "delete";
  action: (formData: FormData) => Promise<Result>;
  onCancel: () => void;
};

function NameConfirm({ row, kind, action, onCancel }: NameConfirmProps) {
  const t = useTranslations("admin.complexes.rowActions");
  const tStatus = useTranslations("admin.complexes.status");
  const [state, formAction, pending] = useResult(action);
  const name = row.name.ru;
  return (
    <form action={formAction} className="complex-list__confirm">
      <input type="hidden" name="id" value={row.id} />
      {kind === "archive" ? <input type="hidden" name="to" value="archived" /> : null}
      <p className="complex-list__confirm-title">
        {kind === "archive" ? t("archiveTitle", { name }) : t("deleteTitle", { name })}
      </p>
      <p className="complex-list__confirm-lead">
        {kind === "archive" ? tStatus("archiveLead", { name, days: 30 }) : t("deleteLead")}
      </p>
      <Field
        id={`${kind}-confirm-${row.id}`}
        name="confirm"
        autoComplete="off"
        autoFocus
        label={t("deleteConfirm")}
        placeholder={name}
      />
      <div className="complex-list__buttons">
        <Button type="submit" size="sm" variant={kind === "delete" ? "danger" : "primary"} pending={pending}>
          {pending ? t("pending") : kind === "delete" ? t("deleteSubmit") : tStatus("archiveSubmit")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
      <ResultLine state={state} done={t(kind === "delete" ? "done.deleted" : "done.archived")} />
    </form>
  );
}
