"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import { ARCHIVE_DAYS, deletionDate, STATUS_MOVES } from "@/lib/admin/developers/publication";
import type { FormAction, StatusResult } from "@/lib/admin/developers/types";
import type { PublicationStatus } from "@/lib/admin/publication";
import { formatDate } from "@/lib/format";
import { StatusMoves } from "./StatusMoves";

/** Тексты капсулы: у ЖК и застройщика одинаковые ключи (тест сверяет messages). */
export type StatusCapsuleMessages = "admin.developers.status" | "admin.complexes.status";

export type PublishPanelProps = {
  formAction: (formData: FormData) => void;
  pending: boolean;
  onCancel: () => void;
};

export type StatusCapsuleProps = {
  entity: { id: string; status: PublicationStatus; archivedAt: string | null };
  /** Название для подтверждения архива: в подсказке поля и в тексте — первое. */
  name: string;
  action: FormAction<StatusResult<string>>;
  messages: StatusCapsuleMessages;
  /** Публикация через панель подтверждения (ЖК: правило 1.2), а не одной кнопкой. */
  publishPanel?: (props: PublishPanelProps) => ReactNode;
  /** Строкой ниже капсулы, до ответов: готовность к публикации (ЖК, И9). */
  children?: ReactNode;
};

const IDLE: StatusResult<string> = { status: "idle" };

type Panel = "archive" | "publish" | null;

/** Статус ЖК или застройщика в шапке страницы: плашка, переходы, архив с вводом названия. */
export function StatusCapsule(props: StatusCapsuleProps) {
  const { entity, messages, publishPanel } = props;
  const [panel, setPanel] = useState<Panel>(null);
  // Удачный переход закрывает панель: иначе «Опубликовать ЖК?» висит над «Опубликован», а
  // подтверждение архива всплывает само после «Восстановить».
  const [state, formAction, pending] = useActionState(
    async (_previous: StatusResult<string>, formData: FormData) => {
      const result = await props.action(formData);
      if (result.status === "done") setPanel(null);
      return result;
    },
    IDLE,
  );
  const canArchive = STATUS_MOVES[entity.status].includes("archived");
  const close = () => setPanel(null);
  return (
    <>
      <StatusMoves {...props} formAction={formAction} pending={pending} onPanel={setPanel} />
      <div className="status-capsule__notes">
        {props.children}
        {panel === "archive" && canArchive ? (
          <ArchiveConfirm {...props} formAction={formAction} pending={pending} onCancel={close} />
        ) : null}
        {panel === "publish" && publishPanel
          ? publishPanel({ formAction, pending, onCancel: close })
          : null}
        <StatusFeedback state={state} messages={messages} />
        <ArchivedNotice entity={entity} messages={messages} />
      </div>
    </>
  );
}

/** В архиве: с какого числа и когда удалится окончательно. */
function ArchivedNotice({ entity, messages }: Pick<StatusCapsuleProps, "entity" | "messages">) {
  const t = useTranslations(messages as "admin.developers.status");
  if (entity.status !== "archived" || !entity.archivedAt) return null;
  return (
    <FormStatus tone="notice">
      {t("archived", {
        date: formatDate(new Date(entity.archivedAt)),
        deletion: formatDate(deletionDate(entity.archivedAt)),
      })}
    </FormStatus>
  );
}

type ArchiveConfirmProps = StatusCapsuleProps & PublishPanelProps;

function ArchiveConfirm({
  entity,
  name,
  messages,
  formAction,
  pending,
  onCancel,
}: ArchiveConfirmProps) {
  const t = useTranslations(messages as "admin.developers.status");
  return (
    <form className="status-capsule__confirm" action={formAction}>
      <input type="hidden" name="id" value={entity.id} />
      <input type="hidden" name="to" value="archived" />
      <p className="status-capsule__confirm-title">{t("archiveTitle")}</p>
      <p className="status-capsule__confirm-lead">
        {t("archiveLead", { name, days: ARCHIVE_DAYS })}
      </p>
      <Field
        id="status-archive-confirm"
        name="confirm"
        autoComplete="off"
        autoFocus
        label={t("archiveConfirm")}
        placeholder={name}
      />
      <div className="status-capsule__confirm-actions">
        <Button type="submit" size="sm" pending={pending}>
          {pending ? t("pending") : t("archiveSubmit")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

/** Ответ последнего действия: «Опубликован», чего не хватает или почему отказ. */
function StatusFeedback({
  state,
  messages,
}: {
  state: StatusResult<string>;
  messages: StatusCapsuleMessages;
}) {
  const t = useTranslations(messages as "admin.developers.status");
  const errors = useTranslations("admin.developers.errors");
  if (state.status === "done") {
    return (
      <FormStatus key={state.at} tone="success">
        {t(`done.${state.to}`)}
      </FormStatus>
    );
  }
  if (state.status !== "error") return null;
  if (state.error === "notReady" && state.missing.length > 0) {
    const missing = state.missing
      .map((item) => t(`missing.${item}` as "missing.about"))
      .join(" · ");
    return <FormStatus tone="error">{`${t("missingLead")} ${missing}`}</FormStatus>;
  }
  return <FormStatus tone="error">{errors(state.error)}</FormStatus>;
}
