"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/Button";

type ConfirmRowProps = { question: string; action: string; onConfirm: () => Promise<void>; onCancel: () => void };

/** Удаление в два шага: что пропадёт — и «Удалить» / «Отмена» (фасад и план не вернуть). */
export function ConfirmRow({ question, action, onConfirm, onCancel }: ConfirmRowProps) {
  const t = useTranslations("admin.complexes.facade");
  const [pending, startTransition] = useTransition();
  return (
    <div className="facade-tab__confirm" role="group" aria-label={question}>
      <span>{question}</span>
      <Button variant="danger" size="sm" pending={pending} onClick={() => startTransition(onConfirm)}>
        {action}
      </Button>
      <Button variant="outline" size="sm" disabled={pending} onClick={onCancel}>
        {t("cancel")}
      </Button>
    </div>
  );
}
