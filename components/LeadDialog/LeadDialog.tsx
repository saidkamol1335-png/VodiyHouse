"use client";

import { Tag, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Button } from "@/components/Button";
import { LeadForm, type LeadIntent } from "@/components/LeadForm";
import { useSiteContacts } from "@/components/SiteContacts";

type LeadDialogProps = { intent: LeadIntent; onClose: () => void };

/** Заголовок окна по типу (мокап mCallback…): «Перезвоним за N минут» — если минуты заданы. */
function useLeadTitle(intent: LeadIntent): string {
  const t = useTranslations("lead.titles");
  const { callbackMinutes } = useSiteContacts();
  if (intent.type === "callback") {
    return callbackMinutes ? t("callback", { minutes: callbackMinutes }) : t("callbackPlain");
  }
  return t(intent.type);
}

/**
 * Окно заявки мокапа (`.mdl`): на 1440 — по центру, на телефоне — шторка снизу. Открывается сразу
 * (провайдер монтирует его по нажатию); Esc, «×» и фон закрывают.
 */
export function LeadDialog({ intent, onClose }: LeadDialogProps) {
  const t = useTranslations("lead");
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useLeadTitle(intent);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="lead-dialog"
      aria-labelledby="lead-dialog-title"
      onClose={onClose}
      onClick={(event) => {
        // Нажатие по фону (сам dialog, а не содержимое) — закрыть, как .mdl-wrap мокапа.
        if (event.target === dialog.current) dialog.current.close();
      }}
    >
      <div className="lead-dialog__head">
        <h2 id="lead-dialog-title" className="lead-dialog__title">
          {title}
        </h2>
        <button type="button" className="lead-dialog__close" aria-label={t("close")} onClick={() => dialog.current?.close()}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {intent.context ? (
        <p className="lead-dialog__context">
          <Tag size={16} aria-hidden="true" />
          <span>{intent.context}</span>
        </p>
      ) : null}
      <LeadForm
        id="lead-dialog"
        intent={intent}
        afterDone={
          <Button variant="outline" block onClick={() => dialog.current?.close()}>
            {t("close")}
          </Button>
        }
      />
    </dialog>
  );
}
