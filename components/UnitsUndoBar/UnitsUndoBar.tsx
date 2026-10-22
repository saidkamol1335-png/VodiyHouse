"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type RefObject } from "react";
import { barTone, type UnitsBar } from "@/lib/admin/units/bar";
import type { UnitStatusControl } from "@/lib/admin/units/useUnitStatus";
import { barText, type BarTexts } from "./barText";

/** Что полосе нужно от статуса: на блоке без списка «Отменить» нет — только полоса и «×». */
export type UnitsBarView = Pick<UnitStatusControl, "bar" | "timer" | "undo" | "dismiss">;

type UnitsUndoBarProps = {
  control: UnitsBarView;
  /** Блок на экране: ответ из другого блока подписывается «Блок A · …». */
  blockId: string;
};

/** Куда вернуть фокус: после «Отменить» — на заголовок новой полосы, после «×» — откуда пришли. */
class FocusMemory {
  private wantsTitle = false;
  private from: HTMLElement | null = null;

  /** Следующая полоса заберёт фокус на заголовок (кнопка «Отменить» исчезнет вместе со старой). */
  askTitle() {
    this.wantsTitle = true;
  }

  takeTitle(): boolean {
    const wanted = this.wantsTitle;
    this.wantsTitle = false;
    return wanted;
  }

  rememberFrom(element: HTMLElement) {
    this.from = element;
  }

  /** Вернуть фокус туда, откуда пришли в полосу, — если тот элемент ещё на странице. */
  restore() {
    if (this.from?.isConnected) this.from.focus();
  }
}

/**
 * Полоса внизу экрана (мокап: .toast — справа снизу на 1440, во всю ширину на телефоне):
 * «Кв. 41: свободна → бронь · Отменить». Живая область — отдельная скрытая строка, смонтирована
 * всегда: диктор слышит и первое сообщение, но не перечитывает кнопки.
 */
export function UnitsUndoBar({ control, blockId }: UnitsUndoBarProps) {
  const texts = useBarTexts();
  const [focus] = useState(() => new FocusMemory());
  const { bar } = control;
  const lines = bar ? barLines(texts, bar, blockId) : [];
  return (
    <div className="units-undo">
      <p className="sr-only" role="status">
        {lines.map((line) => line.join(" ")).join(". ")}
      </p>
      {bar ? (
        <UndoCard
          key={bar.op}
          bar={bar}
          control={control}
          lines={lines}
          focus={focus}
          own={bar.blockId === blockId}
        />
      ) : null}
    </div>
  );
}

function useBarTexts(): BarTexts {
  return {
    bar: useTranslations("admin.complexes.units.list.bar"),
    status: useTranslations("admin.journal.unitStatus"),
    errors: useTranslations("admin.developers.errors"),
    complexes: useTranslations("admin.complexes"),
  };
}

/** Строки полосы: исход и отказы прежних тапов; ответ другого блока — с его названием. */
function barLines(texts: BarTexts, bar: UnitsBar, blockId: string): string[][] {
  const label = (text: string, of: { blockId: string; blockName: string }) =>
    of.blockId === blockId ? text : texts.bar("otherBlock", { name: of.blockName, text });
  const line = (message: UnitsBar["message"], of: { blockId: string; blockName: string }) => {
    const { title, detail } = barText(texts, message);
    return detail ? [label(title, of), detail] : [label(title, of)];
  };
  return [line(bar.message, bar), ...bar.lost.map((lost) => line(lost.message, lost))];
}

type UndoCardProps = {
  bar: UnitsBar;
  control: UnitsBarView;
  lines: string[][];
  focus: FocusMemory;
  /** Тап сделан в этом блоке: «Отменить» тапа другого блока — только в нём (CL1 приёмки 12.7). */
  own: boolean;
};

function UndoCard({ bar, control, lines, focus, own }: UndoCardProps) {
  const title = useRef<HTMLParagraphElement>(null);
  const { timer } = control;
  useEffect(() => {
    if (focus.takeTitle()) title.current?.focus();
    // Карточку убрали вместе с кнопкой в фокусе — blur и pointerleave до React не дойдут.
    return () => {
      timer.resume("hover");
      timer.resume("focus");
    };
  }, [focus, timer]);
  return (
    <div
      className={`units-undo__card units-undo__card--${barTone(bar.message)}`}
      onPointerEnter={() => timer.pause("hover")}
      onPointerLeave={() => timer.resume("hover")}
      onFocus={(event) => {
        timer.pause("focus");
        const from = event.relatedTarget as HTMLElement | null;
        if (from && !event.currentTarget.contains(from)) focus.rememberFrom(from);
      }}
      onBlur={() => timer.resume("focus")}
    >
      {barTone(bar.message) === "success" ? (
        <CircleCheck className="units-undo__icon" size={18} aria-hidden="true" />
      ) : (
        <CircleAlert className="units-undo__icon" size={18} aria-hidden="true" />
      )}
      <CardText lines={lines} title={title} />
      <UndoActions bar={bar} control={control} focus={focus} own={own} />
    </div>
  );
}

/** Исход — заголовком и пояснением, отказы прежних тапов — строками ниже. */
function CardText({
  lines,
  title,
}: {
  lines: string[][];
  title: RefObject<HTMLParagraphElement | null>;
}) {
  const [first = [], ...lost] = lines;
  return (
    <div className="units-undo__text">
      <p ref={title} className="units-undo__title" tabIndex={-1}>
        {first[0]}
      </p>
      {first[1] ? <p className="units-undo__detail">{first[1]}</p> : null}
      {lost.map((line, index) => (
        <p key={index} className="units-undo__lost">
          {line.join(" ")}
        </p>
      ))}
    </div>
  );
}

function UndoActions({ bar, control, focus, own }: Omit<UndoCardProps, "lines">) {
  const t = useTranslations("admin.complexes.units.list.bar");
  const canUndo = own && bar.undo !== null && !bar.busy;
  // Пока смена сохраняется, «Отменить» уже на месте, но недоступна — полоса не прыгает.
  const waitingUndo = own && bar.message.kind === "saving";
  const undo = () => {
    focus.askTitle();
    control.undo();
  };
  const close = () => {
    control.dismiss();
    focus.restore();
  };
  return (
    <>
      {canUndo || waitingUndo ? (
        <button
          type="button"
          className="units-undo__action"
          aria-disabled={!canUndo}
          aria-keyshortcuts="Control+Z Meta+Z"
          onClick={canUndo ? undo : undefined}
        >
          {t("undo")}
          <span className="units-undo__shortcut">{t("shortcut", { keys: undoKeys() })}</span>
        </button>
      ) : null}
      <button type="button" className="units-undo__close" aria-label={t("close")} onClick={close}>
        <X size={16} aria-hidden="true" />
      </button>
    </>
  );
}

/** Полоса рисуется только в браузере (после тапа) — платформа уже известна. */
const undoKeys = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘Z" : "Ctrl+Z");
