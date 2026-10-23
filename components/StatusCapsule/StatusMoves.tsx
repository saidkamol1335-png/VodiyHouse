"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { PublicationBadge } from "@/components/PublicationBadge";
import { STATUS_MOVES } from "@/lib/admin/developers/publication";
import type { PublicationStatus } from "@/lib/admin/publication";
import type { PublishPanelProps, StatusCapsuleMessages, StatusCapsuleProps } from "./StatusCapsule";

// Кнопка для каждого перехода; архив — отдельно, через подтверждение названием (PLAN 3а).
const MOVE_BUTTONS: Record<
  Exclude<PublicationStatus, "archived">,
  { label: "publish" | "hide" | "restore"; primary: boolean }
> = {
  published: { label: "publish", primary: true },
  hidden: { label: "hide", primary: false },
  draft: { label: "restore", primary: true },
};

type StatusMovesProps = StatusCapsuleProps &
  Omit<PublishPanelProps, "onCancel"> & { onPanel: (panel: "archive" | "publish") => void };

/** Капсула: плашка статуса и переходы одной формой (кнопка отправляет name="to"). */
export function StatusMoves(props: StatusMovesProps) {
  const { entity, messages, publishPanel, formAction, pending, onPanel } = props;
  const t = useTranslations(messages as "admin.developers.status");
  const moves = STATUS_MOVES[entity.status];
  return (
    <form className="status-capsule" action={formAction} aria-label={t("label")}>
      <input type="hidden" name="id" value={entity.id} />
      <PublicationBadge status={entity.status} className="status-capsule__badge" />
      {moves.map((to) =>
        to === "archived" ? null : (
          <MoveButton
            key={to}
            to={to}
            messages={messages}
            pending={pending}
            onPanel={to === "published" && publishPanel ? () => onPanel("publish") : undefined}
          />
        ),
      )}
      {moves.includes("archived") ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => onPanel("archive")}>
          {t("archive")}
        </Button>
      ) : null}
    </form>
  );
}

type MoveButtonProps = {
  to: Exclude<PublicationStatus, "archived">;
  messages: StatusCapsuleMessages;
  pending: boolean;
  /** Переход через панель подтверждения (ЖК: правило 1.2), а не отправкой формы. */
  onPanel?: () => void;
};

function MoveButton({ to, messages, pending, onPanel }: MoveButtonProps) {
  const t = useTranslations(messages as "admin.developers.status");
  const { label, primary } = MOVE_BUTTONS[to];
  const variant = primary ? "primary" : "ghost";
  if (onPanel) {
    return (
      <Button size="sm" variant={variant} disabled={pending} onClick={onPanel}>
        {t(label)}
      </Button>
    );
  }
  return (
    <Button type="submit" name="to" value={to} size="sm" variant={variant} disabled={pending}>
      {t(label)}
    </Button>
  );
}
