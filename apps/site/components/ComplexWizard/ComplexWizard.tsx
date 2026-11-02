"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import type { WizardStep } from "@/lib/admin/complexes/tabs";

type ComplexWizardProps = {
  steps: readonly WizardStep[];
  label: string;
  /** После последнего шага (предпросмотр): «Опубликовать — кнопкой вверху». */
  lastHint: string;
};

/**
 * «Далее →» мастера «Новый ЖК» (решение фазы 3): под вкладкой черновика — переход на следующий шаг.
 * Несохранённое на вкладке спросит «Уйти без сохранения?» (useUnsavedGuard ловит ссылки).
 */
export function ComplexWizard({ steps, label, lastHint }: ComplexWizardProps) {
  const segment = useSelectedLayoutSegment();
  const index = steps.findIndex((step) => step.segment === segment);
  if (index < 0) return null;
  const next = steps[index + 1];
  return (
    <nav className="complex-wizard" aria-label={label}>
      {next ? (
        <Link className="complex-wizard__next" href={next.href}>
          {next.next}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      ) : (
        <p className="complex-wizard__last">{lastHint}</p>
      )}
    </nav>
  );
}
