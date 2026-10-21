"use client";

import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import type { SelectOption } from "@/components/SelectField";
import type { BlockDraft, BlockRowErrors } from "@/lib/admin/complexes/blocks";
import { quarterOf } from "@/lib/quarters";
import { BlockFields } from "./BlockFields";

type BlockCardProps = {
  block: BlockDraft;
  index: number;
  count: number;
  open: boolean;
  issues: BlockRowErrors[string] | undefined;
  finishings: readonly SelectOption[];
  onToggle: () => void;
  onChange: (patch: Partial<BlockDraft>) => void;
  onMove: (to: number) => void;
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
  const parts = [
    deadlineText(block, t) ?? t("summary.noDeadline"),
    finishing,
    floors,
    t(`values.${block.currency}`),
  ];
  return parts.filter(Boolean).join(" · ");
}

function StatusBadge({ block, t }: { block: BlockDraft; t: Translate }) {
  if (block.buildStatus === "delivered") return <Badge tone="ok">{t("values.delivered")}</Badge>;
  return (
    <Badge tone="amber">
      {block.progressPct
        ? t("summary.buildingPct", { pct: block.progressPct })
        : t("values.building")}
    </Badge>
  );
}

/** Карточка блока (И4): сводка, стрелки порядка, «Изменить» раскрывает поля на месте. */
export function BlockCard(props: BlockCardProps) {
  const { block, index, count, open, onToggle, onMove } = props;
  const t = useTranslations("admin.complexes.blocks");
  const title = block.name ? t("blockName", { name: block.name }) : t("unnamed");
  const progress = Number(block.progressPct);
  return (
    <li className={open ? "block-card block-card--open" : "block-card"} data-testid="block-card">
      <div className="block-card__head">
        <b className="block-card__title">{title}</b>
        <StatusBadge block={block} t={t} />
        <span className="block-card__tools">
          <button
            type="button"
            className="block-card__move"
            aria-label={t("moveUp", { name: title })}
            disabled={index === 0}
            onClick={() => onMove(index - 1)}
          >
            <ArrowUp size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="block-card__move"
            aria-label={t("moveDown", { name: title })}
            disabled={index === count - 1}
            onClick={() => onMove(index + 1)}
          >
            <ArrowDown size={16} aria-hidden="true" />
          </button>
          <Button size="sm" variant="ghost" aria-expanded={open} onClick={onToggle}>
            {open ? t("close") : t("edit")}
            <ChevronDown className="block-card__chevron" size={14} aria-hidden="true" />
          </Button>
        </span>
      </div>
      {block.buildStatus === "building" && progress > 0 ? (
        <span className="block-card__bar" aria-hidden="true">
          <span
            className="block-card__bar-fill"
            style={{ transform: `scaleX(${Math.min(progress, 100) / 100})` }}
          />
        </span>
      ) : null}
      <p className="block-card__summary">{summaryOf(block, props.finishings, t)}</p>
      {open ? <BlockBody {...props} title={title} /> : null}
    </li>
  );
}

function BlockBody({
  block,
  issues,
  finishings,
  onChange,
  onRemove,
  title,
}: BlockCardProps & { title: string }) {
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
