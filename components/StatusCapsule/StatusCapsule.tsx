"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import { PublicationBadge } from "@/components/PublicationBadge";
import { ARCHIVE_DAYS, deletionDate, STATUS_MOVES } from "@/lib/admin/developers/publication";
import type { FormAction, StatusResult } from "@/lib/admin/developers/types";
import type { PublicationStatus } from "@/lib/admin/publication";
import { formatDate } from "@/lib/format";

/** Тексты капсулы: у ЖК и застройщика одинаковые ключи (тест сверяет messages). */
export type StatusCapsuleMessages = "admin.developers.status" | "admin.complexes.status";

export type PublishPanelProps = {
  formAction: (formData: FormData) => void;
  pending: boolean;
  onCancel: () => void;
};

type StatusCapsuleProps = {
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

// Кнопка для каждого перехода; архив — отдельно, через подтверждение названием (PLAN 3а).
const MOVE_BUTTONS: Record<
  Exclude<PublicationStatus, "archived">,
  { label: "publish" | "hide" | "restore"; primary: boolean }
> = {
  published: { label: "publish", primary: true },
  hidden: { label: "hide", primary: false },
  draft: { label: "restore", primary: true },
};

type Panel = "archive" | "publish" | null;

/** Статус ЖК или застройщика в шапке страницы: плашка, переходы, архив с вводом названия. */
export function StatusCapsule(props: StatusCapsuleProps) {
  const { entity, messages, publishPanel } = props;
  const t = useTranslations(messages as "admin.developers.status");
  const [state, formAction, pending] = useActionState(
    (_previous: StatusResult<string>, formData: FormData) => props.action(formData),
    IDLE,
  );
  const [panel, setPanel] = useState<Panel>(null);
  const moves = STATUS_MOVES[entity.status];
  const canArchive = moves.includes("archived");

  const moveButton = (to: Exclude<PublicationStatus, "archived">) => {
    const { label, primary } = MOVE_BUTTONS[to];
    const variant = primary ? "primary" : "ghost";
    if (to === "published" && publishPanel) {
      return (
        <Button
          key={to}
          size="sm"
          variant={variant}
          disabled={pending}
          onClick={() => setPanel("publish")}
        >
          {t(label)}
        </Button>
      );
    }
    return (
      <Button
        key={to}
        type="submit"
        name="to"
        value={to}
        size="sm"
        variant={variant}
        disabled={pending}
      >
        {t(label)}
      </Button>
    );
  };

  return (
    <>
      <form className="status-capsule" action={formAction} aria-label={t("label")}>
        <input type="hidden" name="id" value={entity.id} />
        <PublicationBadge status={entity.status} />
        {moves.map((to) => (to === "archived" ? null : moveButton(to)))}
        {canArchive ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setPanel("archive")}>
            {t("archive")}
          </Button>
        ) : null}
      </form>
      <div className="status-capsule__notes">
        {props.children}
        {panel === "archive" && canArchive ? (
          <ArchiveConfirm
            {...props}
            formAction={formAction}
            pending={pending}
            onCancel={() => setPanel(null)}
          />
        ) : null}
        {panel === "publish" && publishPanel
          ? publishPanel({ formAction, pending, onCancel: () => setPanel(null) })
          : null}
        <StatusFeedback state={state} messages={messages} />
        {entity.status === "archived" && entity.archivedAt ? (
          <FormStatus tone="notice">
            {t("archived", {
              date: formatDate(new Date(entity.archivedAt)),
              deletion: formatDate(deletionDate(entity.archivedAt)),
            })}
          </FormStatus>
        ) : null}
      </div>
    </>
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
