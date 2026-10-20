"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import { PublicationBadge } from "@/components/PublicationBadge";
import { ARCHIVE_DAYS, deletionDate, STATUS_MOVES } from "@/lib/admin/developers/publication";
import type { FormAction, StatusResult } from "@/lib/admin/developers/types";
import type { PublicationStatus } from "@/lib/admin/publication";
import { formatDate } from "@/lib/format";

type DeveloperStatusProps = {
  developer: { id: string; name: string; status: PublicationStatus; archivedAt: string | null };
  action: FormAction<StatusResult>;
};

const IDLE: StatusResult = { status: "idle" };

// Кнопка для каждого перехода; архив — отдельно, через подтверждение названием (PLAN 3а).
const MOVE_BUTTONS: Record<
  Exclude<PublicationStatus, "archived">,
  { label: "publish" | "hide" | "restore"; primary: boolean }
> = {
  published: { label: "publish", primary: true },
  hidden: { label: "hide", primary: false },
  draft: { label: "restore", primary: true },
};

/** Статус застройщика в шапке страницы: плашка, переходы, архив с вводом названия. */
export function DeveloperStatus({ developer, action }: DeveloperStatusProps) {
  const t = useTranslations("admin.developers.status");
  const [state, formAction, pending] = useActionState(
    (_previous: StatusResult, formData: FormData) => action(formData),
    IDLE,
  );
  const [confirming, setConfirming] = useState(false);
  const moves = STATUS_MOVES[developer.status];
  const canArchive = moves.includes("archived");

  return (
    <>
      <form className="developer-status" action={formAction} aria-label={t("label")}>
        <input type="hidden" name="id" value={developer.id} />
        <PublicationBadge status={developer.status} />
        {moves.map((to) =>
          to === "archived" ? null : (
            <Button
              key={to}
              type="submit"
              name="to"
              value={to}
              size="sm"
              variant={MOVE_BUTTONS[to].primary ? "primary" : "ghost"}
              disabled={pending}
            >
              {t(MOVE_BUTTONS[to].label)}
            </Button>
          ),
        )}
        {canArchive ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(true)}>
            {t("archive")}
          </Button>
        ) : null}
      </form>
      <div className="developer-status__notes">
        {confirming && canArchive ? (
          <ArchiveConfirm
            developer={developer}
            formAction={formAction}
            pending={pending}
            onCancel={() => setConfirming(false)}
          />
        ) : null}
        <StatusFeedback state={state} />
        {developer.status === "archived" && developer.archivedAt ? (
          <FormStatus tone="notice">
            {t("archived", {
              date: formatDate(new Date(developer.archivedAt)),
              deletion: formatDate(deletionDate(developer.archivedAt)),
            })}
          </FormStatus>
        ) : null}
      </div>
    </>
  );
}

type ArchiveConfirmProps = {
  developer: DeveloperStatusProps["developer"];
  formAction: (formData: FormData) => void;
  pending: boolean;
  onCancel: () => void;
};

function ArchiveConfirm({ developer, formAction, pending, onCancel }: ArchiveConfirmProps) {
  const t = useTranslations("admin.developers.status");
  return (
    <form className="developer-status__confirm" action={formAction}>
      <input type="hidden" name="id" value={developer.id} />
      <input type="hidden" name="to" value="archived" />
      <p className="developer-status__confirm-title">{t("archiveTitle")}</p>
      <p className="developer-status__confirm-lead">
        {t("archiveLead", { name: developer.name, days: ARCHIVE_DAYS })}
      </p>
      <Field
        id="developer-archive-confirm"
        name="confirm"
        autoComplete="off"
        autoFocus
        label={t("archiveConfirm")}
        placeholder={developer.name}
      />
      <div className="developer-status__confirm-actions">
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
function StatusFeedback({ state }: { state: StatusResult }) {
  const t = useTranslations("admin.developers");
  if (state.status === "done") {
    return (
      <FormStatus key={state.at} tone="success">
        {t(`status.done.${state.to}`)}
      </FormStatus>
    );
  }
  if (state.status !== "error") return null;
  if (state.error === "notReady" && state.missing.length > 0) {
    const missing = state.missing.map((item) => t(`status.missing.${item}`)).join(" · ");
    return <FormStatus tone="error">{`${t("status.missingLead")} ${missing}`}</FormStatus>;
  }
  return <FormStatus tone="error">{t(`errors.${state.error}`)}</FormStatus>;
}
