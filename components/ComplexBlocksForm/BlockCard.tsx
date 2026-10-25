"use client";

import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import type { SelectOption } from "@/components/SelectField";
import type { BlockDraft, BlockRowErrors } from "@/lib/admin/complexes/blocks";
import { quarterOf } from "@/lib/quarters";
import { type MoveDirection, useMoveFocus } from "@/lib/ui/useMoveFocus";
import { BlockFields } from "./BlockFields";

export type { MoveDirection };

type BlockCardProps = {
  block: BlockDraft;
  index: number;
  count: number;
  open: boolean;
  issues: BlockRowErrors[string] | undefined;
  finishings: readonly SelectOption[];
  /** Карточку только что переставили стрелкой: вернуть фокус на стрелку (React переносит узел). */
  focusMove?: MoveDirection;
  /** Фокус возвращён — перенос забыт: иначе он сработал бы снова при возврате на вкладку. */
  onMoveFocused: () => void;
  onToggle: () => void;
  onChange: (patch: Partial<BlockDraft>) => void;
  onMove: (direction: MoveDirection) => void;
  onRemove: () => void;
};

type Translate = ReturnType<typeof useTranslations<"admin.complexes.blocks">>;

function deadlineText(block: BlockDraft, t: Translate): string | null {
  const quarter = block.deadline ? quarterOf(block.deadline) : null;
  if (!quarter) return null;
  const text = t("summary.quarter", quarter);
  return block.buildStatus === "delivered" ? t("summary.delivered", { quarter: text }) : text;
}

/** «4 кв. 2027 · White box · 7 из 12 эт. · USD» — как блок на сайте, одной строкой. */
function summaryOf(block: BlockDraft, finishings: readonly SelectOption[], t: Translate): string {
  const finishing = finishings.find((option) => option.value === block.finishingId)?.label;
  const floors =
    block.buildStatus === "building" && block.floorsBuilt && block.floorsTotal
      ? t("summary.floorsBuilt", { built: block.floorsBuilt, total: block.floorsTotal })
      : block.floorsTotal
        ? t("summary.floors", { total: block.floorsTotal })
        : null;
  const parts = [deadlineText(block, t) ?? t("summary.noDeadline"), finishing, floors, t(`values.${block.currency}`)];
  return parts.filter(Boolean).join(" · ");
}

function StatusBadge({ block, t }: { block: BlockDraft; t: Translate }) {
  if (block.buildStatus === "delivered") return <Badge tone="ok">{t("values.delivered")}</Badge>;
  return <Badge tone="amber">{block.progressPct ? t("summary.buildingPct", { pct: block.progressPct }) : t("values.building")}</Badge>;
}

/** Карточка блока (И4): сводка, стрелки порядка, «Изменить» раскрывает поля на месте. */
export function BlockCard(props: BlockCardProps) {
  const { block, open } = props;
  const t = useTranslations("admin.complexes.blocks");
  const title = block.name ? t("blockName", { name: block.name }) : t("unnamed");
  // Раскрыта одна карточка (И4): у свёрнутых с ошибками последнего сохранения — плашка в шапке.
  const hiddenIssues = !open && Boolean(props.issues);
  return (
    <li className={cardClass(open, hiddenIssues)} data-testid="block-card">
      <div className="block-card__head">
        <b className="block-card__title">{title}</b>
        <StatusBadge block={block} t={t} />
        {hiddenIssues ? <Badge tone="bad">{t("hasIssues")}</Badge> : null}
        <BlockCardTools {...props} title={title} />
      </div>
      <ProgressBar block={block} />
      <p className="block-card__summary">{summaryOf(block, props.finishings, t)}</p>
      {open ? <BlockBody {...props} title={title} /> : null}
    </li>
  );
}

function cardClass(open: boolean, hiddenIssues: boolean): string {
  const classes = ["block-card"];
  if (open) classes.push("block-card--open");
  if (hiddenIssues) classes.push("block-card--error");
  return classes.join(" ");
}

/** Стрелки порядка и «Изменить»: фокус после переноса — здесь же, где кнопки со ссылками. */
function BlockCardTools(props: BlockCardProps & { title: string }) {
  const { index, count, open, title, onToggle, onMove } = props;
  const t = useTranslations("admin.complexes.blocks");
  const [upArrow, downArrow] = useMoveFocus(props.focusMove, props.onMoveFocused);
  return (
    <span className="block-card__tools">
      <button
        ref={upArrow}
        type="button"
        className="block-card__move"
        aria-label={t("moveUp", { name: title })}
        disabled={index === 0}
        onClick={() => onMove("up")}
      >
        <ArrowUp size={16} aria-hidden="true" />
      </button>
      <button
        ref={downArrow}
        type="button"
        className="block-card__move"
        aria-label={t("moveDown", { name: title })}
        disabled={index === count - 1}
        onClick={() => onMove("down")}
      >
        <ArrowDown size={16} aria-hidden="true" />
      </button>
      <Button size="sm" variant="ghost" aria-expanded={open} onClick={onToggle}>
        {open ? t("close") : t("edit")}
        <ChevronDown className="block-card__chevron" size={14} aria-hidden="true" />
      </Button>
    </span>
  );
}

/** Полоса готовности строящегося блока: доля — через scaleX (анимируем только transform). */
function ProgressBar({ block }: { block: BlockDraft }) {
  const progress = Number(block.progressPct);
  if (block.buildStatus !== "building" || !(progress > 0)) return null;
  return (
    <span className="block-card__bar" aria-hidden="true">
      <span className="block-card__bar-fill" style={{ transform: `scaleX(${Math.min(progress, 100) / 100})` }} />
    </span>
  );
}

function BlockBody({ block, issues, finishings, onChange, onRemove, title }: BlockCardProps & { title: string }) {
  const t = useTranslations("admin.complexes.blocks");
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="block-card__body">
      <BlockFields block={block} issues={issues} finishings={finishings} onChange={onChange} />
      <div className="block-card__remove">
        {block.units > 0 ? (
          <p className="field__meta">{t("hasUnits", { count: block.units })}</p>
        ) : confirming ? (
          <>
            <span className="block-card__confirm">{t("removeConfirm", { name: title })}</span>
            <Button size="sm" variant="ghost" onClick={onRemove}>
              {t("removeYes")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              {t("removeCancel")}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            {t("remove")}
          </Button>
        )}
      </div>
    </div>
  );
}
