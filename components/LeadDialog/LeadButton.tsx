"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/Button";
import type { LeadIntent } from "@/components/LeadForm";
import { useLeadOpener } from "./LeadProvider";

type LeadButtonProps = {
  intent: LeadIntent;
  /** Своя подпись; без неё — «Записаться на просмотр», «Перезвоните мне»… по типу. */
  children?: ReactNode;
  variant?: "primary" | "ghost" | "outline";
  size?: "md" | "sm";
  block?: boolean;
  className?: string;
};

/** Кнопка формы заявки (ТЗ 10.1). Без окна заявок на странице — кнопки нет, а не мёртвая кнопка. */
export function LeadButton({ intent, children, variant = "primary", size, block, className }: LeadButtonProps) {
  const t = useTranslations("lead.buttons");
  const open = useLeadOpener();
  if (!open) return null;
  return (
    <Button variant={variant} size={size} block={block} className={className} onClick={() => open(intent)}>
      {children ?? t(intent.type)}
    </Button>
  );
}
