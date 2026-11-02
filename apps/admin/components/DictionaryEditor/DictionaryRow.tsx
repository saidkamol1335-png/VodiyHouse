"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { SortHandle } from "@/components/SortHandle";
import type { DictionaryItem } from "@/lib/admin/dictionaries/definitions";
import type { useSortable } from "@/lib/ui/useSortable";

type DictionaryRowProps = {
  item: DictionaryItem;
  dragging: boolean;
  handle: ReturnType<ReturnType<typeof useSortable>["handleProps"]>;
  confirming: boolean;
  pending: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onRemove: () => void;
};

/** Строка справочника: ручка порядка, RU и UZ, плашки, действия или вопрос «Удалить?». */
export function DictionaryRow({
  item,
  dragging,
  handle,
  confirming,
  pending,
  ...on
}: DictionaryRowProps) {
  const t = useTranslations("admin.dictionaries");
  const classes = ["dictionary-editor__row"];
  if (!item.isActive) classes.push("dictionary-editor__row--hidden");
  if (dragging) classes.push("dictionary-editor__row--dragging");
  return (
    <li className={classes.join(" ")} data-sortable-row data-testid="dictionary-row">
      <SortHandle
        label={t("move", { name: item.name.ru })}
        active={dragging}
        className="dictionary-editor__handle"
        {...handle}
      />
      <div className="dictionary-editor__text">
        <span className="dictionary-editor__name">{item.name.ru}</span>
        <span className="dictionary-editor__uz" lang="uz">
          {item.name.uz}
        </span>
        {item.second ? <span className="dictionary-editor__second">{item.second.ru}</span> : null}
      </div>
      <RowBadges item={item} />
      {confirming ? (
        <RemoveConfirm
          item={item}
          pending={pending}
          onRemove={on.onRemove}
          onCancel={on.onCancelRemove}
        />
      ) : (
        <RowActions item={item} pending={pending} {...on} />
      )}
    </li>
  );
}

function RowBadges({ item }: { item: DictionaryItem }) {
  const t = useTranslations("admin.dictionaries");
  return (
    <span className="dictionary-editor__badges">
      {item.kind ? (
        <Badge tone="line" size="sm">
          {t(`kinds.${item.kind}`)}
        </Badge>
      ) : null}
      {item.isActive ? null : (
        <Badge tone="neutral" size="sm" dot>
          {t("hidden")}
        </Badge>
      )}
    </span>
  );
}

type RemoveConfirmProps = {
  item: DictionaryItem;
  pending: boolean;
  onRemove: () => void;
  onCancel: () => void;
};

function RemoveConfirm({ item, pending, onRemove, onCancel }: RemoveConfirmProps) {
  const t = useTranslations("admin.dictionaries");
  return (
    <div className="dictionary-editor__confirm" role="group" aria-label={t("remove")}>
      <span>{t("removeConfirm", { name: item.name.ru })}</span>
      <Button size="sm" pending={pending} onClick={onRemove}>
        {t("yes")}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        {t("no")}
      </Button>
    </div>
  );
}

type RowActionsProps = Pick<
  DictionaryRowProps,
  "item" | "pending" | "onEdit" | "onToggle" | "onAskRemove"
>;

function RowActions({ item, pending, onEdit, onToggle, onAskRemove }: RowActionsProps) {
  const t = useTranslations("admin.dictionaries");
  return (
    <div className="dictionary-editor__actions">
      <Button size="sm" variant="ghost" onClick={onEdit} className="dictionary-editor__action">
        {t("edit")}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={onToggle}
        className="dictionary-editor__action"
      >
        {item.isActive ? t("hide") : t("show")}
      </Button>
      <Button size="sm" variant="ghost" onClick={onAskRemove} className="dictionary-editor__action">
        {t("remove")}
      </Button>
    </div>
  );
}
