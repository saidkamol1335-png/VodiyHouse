"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { hiddenCount } from "@/lib/admin/units/selection";
import type { UnitsBlock, UnitsFinishing, UnitsLayout } from "@/lib/admin/units/types";
import type { UnitStatusControl } from "@/lib/admin/units/useUnitStatus";
import type { UnitsEditControl } from "@/lib/admin/units/useUnitsEdit";
import type { UnitsSelection } from "@/lib/admin/units/useUnitsSelection";
import type { UnitRecord } from "@/lib/units";
import { BulkSteps, type BulkStep } from "./BulkSteps";

export type UnitsBulkBarProps = {
  selection: UnitsSelection;
  /** Видимые при текущем фильтре — для «N вне фильтра». */
  visible: readonly UnitRecord[];
  /** Всего квартир в блоке: выбран весь список — «Удалить» ведёт к «Удалить список блока». */
  total: number;
  status: UnitStatusControl | null;
  edit: UnitsEditControl | null;
  can: Record<Exclude<BulkStep, "status">, boolean>;
  block: UnitsBlock;
  layouts: readonly UnitsLayout[];
  finishings: readonly UnitsFinishing[];
  published: boolean;
  onToWhole: () => void;
  /** Панель уходит («×», удалены выбранные): фокус — на сводку списка, а не на body. */
  onCleared: () => void;
};

/**
 * Массовая панель («Решаю сам» шага 12): «Выбрано N · M вне фильтра» и шаги Статус · Цена ·
 * Отделка · Удалить; менеджеру — только «Статус». Открыт один шаг; Esc закрывает шаг (выделение
 * остаётся), «×» снимает выделение.
 */
export function UnitsBulkBar(props: UnitsBulkBarProps) {
  const t = useTranslations("admin.complexes.units.bulk");
  const count = props.selection.selected.length;
  // Живая область смонтирована всегда: диктор прочтёт и первое «Выбрано: 1 квартира».
  // Состояние — у панели: выделение снято — панель уходит, и открытый шаг не всплывёт при новом.
  return (
    <>
      <p className="sr-only" aria-live="polite">
        {count > 0 ? t("count", { count }) : ""}
      </p>
      {count > 0 ? <BulkPanel {...props} /> : null}
    </>
  );
}

/**
 * Панель уходит («×», удалены выбранные), а фокус в ней — на сводку списка, а не на body. Только
 * если фокус правда в панели: сняли последнюю галочку в Safari (он не ставит фокус на галочку) —
 * страница не прыгает к сводке. Очистка layout-эффекта идёт до того, как панель уберут из DOM.
 */
function useFocusOutOnUnmount(onGone: () => void) {
  const box = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const section = box.current;
    return () => {
      if (section?.contains(document.activeElement)) onGone();
    };
  }, [onGone]);
  return box;
}

function BulkPanel(props: UnitsBulkBarProps) {
  const t = useTranslations("admin.complexes.units.bulk");
  const stepId = useId();
  const steps = useOpenStep();
  const box = useFocusOutOnUnmount(props.onCleared);
  // Шаг — раньше строки и в DOM: порядок Tab совпадает с видом (шаг над строкой).
  return (
    <section
      ref={box}
      className="units-bulk"
      aria-label={t("label")}
      onKeyDown={steps.keydown}
      data-units-bulk
    >
      {steps.step ? (
        <BulkSteps id={stepId} step={steps.step} {...props} onDone={steps.close} />
      ) : null}
      <div className="units-bulk__bar">
        <BulkCount {...props} />
        <StepActions
          steps={availableSteps(props)}
          open={steps.step}
          controls={stepId}
          refFor={steps.refFor}
          onToggle={steps.toggle}
        />
        <ClearButton onClick={props.selection.clear} />
      </div>
    </section>
  );
}

/** Открытый шаг; закрытие (и Esc) возвращает фокус на кнопку этого шага. */
function useOpenStep() {
  const [step, setStep] = useState<BulkStep | null>(null);
  const buttons = useRef<Partial<Record<BulkStep, HTMLButtonElement | null>>>({});
  const close = () => {
    if (step) buttons.current[step]?.focus();
    setStep(null);
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !step) return;
    event.stopPropagation();
    close();
  };
  const refFor = (key: BulkStep) => (element: HTMLButtonElement | null) => {
    buttons.current[key] = element;
  };
  const toggle = (key: BulkStep) => setStep(step === key ? null : key);
  return { step, close, keydown, refFor, toggle };
}

type StepActionsProps = {
  steps: readonly BulkStep[];
  open: BulkStep | null;
  controls: string;
  refFor: (key: BulkStep) => (element: HTMLButtonElement | null) => void;
  onToggle: (key: BulkStep) => void;
};

function StepActions({ steps, open, controls, refFor, onToggle }: StepActionsProps) {
  return (
    <div className="units-bulk__actions">
      {steps.map((key) => (
        <StepButton
          key={key}
          step={key}
          open={open === key}
          controls={controls}
          buttonRef={refFor(key)}
          onToggle={() => onToggle(key)}
        />
      ))}
    </div>
  );
}

/** «×» — снять всё выделение (Esc закрывает только шаг). */
function ClearButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("admin.complexes.units.bulk");
  return (
    <button type="button" className="units-bulk__close" aria-label={t("clear")} onClick={onClick}>
      <X size={16} aria-hidden="true" />
    </button>
  );
}

function availableSteps({ status, edit, can }: UnitsBulkBarProps): BulkStep[] {
  const steps: BulkStep[] = [];
  if (status) steps.push("status");
  if (edit && can.price) steps.push("price");
  if (edit && can.finishing) steps.push("finishing");
  if (edit && can.remove) steps.push("remove");
  return steps;
}

type StepButtonProps = {
  step: BulkStep;
  open: boolean;
  controls: string;
  /** Закрытый шаг возвращает фокус на свою кнопку. */
  buttonRef: (element: HTMLButtonElement | null) => void;
  onToggle: () => void;
};

function StepButton({ step, open, controls, buttonRef, onToggle }: StepButtonProps) {
  const t = useTranslations("admin.complexes.units.bulk");
  return (
    <button
      ref={buttonRef}
      type="button"
      className={stepClass(step, open)}
      aria-expanded={open}
      aria-controls={open ? controls : undefined}
      onClick={onToggle}
    >
      {t(`actions.${step}`)}
    </button>
  );
}

const stepClass = (key: BulkStep, open: boolean) => {
  const classes = ["units-bulk__action"];
  if (open) classes.push("units-bulk__action--open");
  if (key === "remove") classes.push("units-bulk__action--danger");
  return classes.join(" ");
};

/** Видимая сводка; вслух её читает живая область над панелью. */
function BulkCount({ selection, visible }: UnitsBulkBarProps) {
  const t = useTranslations("admin.complexes.units.bulk");
  const hidden = hiddenCount(selection.selected, visible);
  return (
    <p className="units-bulk__count">
      <b>{t("count", { count: selection.selected.length })}</b>
      {hidden > 0 ? (
        <span className="units-bulk__hidden"> · {t("hidden", { count: hidden })}</span>
      ) : null}
    </p>
  );
}
