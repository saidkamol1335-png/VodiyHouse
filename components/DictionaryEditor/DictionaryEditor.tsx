"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import { SortHandle } from "@/components/SortHandle";
import type {
  DictionaryItem,
  DictionaryItemErrors,
  DictionaryKey,
} from "@/lib/admin/dictionaries/definitions";
import type { DictionaryActionResult, DictionaryActionSet } from "@/lib/admin/dictionaries/types";
import { useSortable } from "@/lib/ui/useSortable";
import { DictionaryItemForm } from "./DictionaryItemForm";

type DictionaryEditorProps = {
  dictionary: DictionaryKey;
  items: readonly DictionaryItem[];
  /** Server Actions; на служебном стенде — подделка (список DEMO не меняется). */
  actions: DictionaryActionSet;
};

type Feedback = { tone: "success" | "error"; text: string };
type FormAction = (formData: FormData) => Promise<DictionaryActionResult>;

function formOf(fields: Record<string, string | number>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, String(value));
  return form;
}

/** Строки — из базы; после действия сервер присылает новый список (refresh), он и становится строками. */
function useSyncedRows(items: readonly DictionaryItem[]) {
  const [rows, setRows] = useState<DictionaryItem[]>([...items]);
  const [source, setSource] = useState(items);
  if (items !== source) {
    setSource(items);
    setRows([...items]);
  }
  return [rows, setRows] as const;
}

/** Один справочник (Д6): правка на месте RU | UZ, «+ Добавить», порядок перетаскиванием, скрыть и удалить. */
export function DictionaryEditor({ dictionary, items, actions }: DictionaryEditorProps) {
  const t = useTranslations("admin");
  const [rows, setRows] = useSyncedRows(items);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [errors, setErrors] = useState<DictionaryItemErrors>({});
  const [pending, startTransition] = useTransition();
  const list = useRef<HTMLUListElement>(null);

  const run = (
    action: FormAction,
    formData: FormData,
    success: (result: DictionaryActionResult) => string,
  ) =>
    startTransition(async () => {
      const result = await action(formData);
      if (result.status === "error") {
        setErrors(result.fieldErrors);
        setFeedback(
          result.error ? { tone: "error", text: t(`developers.errors.${result.error}`) } : null,
        );
        return;
      }
      setErrors({});
      setEditing(null);
      setConfirming(null);
      setFeedback({ tone: "success", text: success(result) });
    });

  const { handleProps, activeIndex } = useSortable({
    items: rows,
    onReorder: setRows,
    onDrop: (next) =>
      run(
        actions.reorder,
        formOf({ dictionary, order: JSON.stringify(next.map((item) => item.id)) }),
        () => t("dictionaries.reordered"),
      ),
    list,
  });
  const saved = () => t("dictionaries.saved");
  const startEdit = (target: number | "new") => {
    setErrors({});
    setConfirming(null);
    setEditing(target);
  };

  return (
    <section className="dictionary-editor" aria-labelledby={`dictionary-${dictionary}`}>
      <header className="dictionary-editor__head">
        <h2 id={`dictionary-${dictionary}`} className="dictionary-editor__title">
          {t(`dictionaries.titles.${dictionary}`)}
        </h2>
        <span className="dictionary-editor__count">
          {t("dictionaries.count", { count: rows.length })}
        </span>
      </header>
      <ul ref={list} className="dictionary-editor__rows">
        {rows.map((item, index) =>
          editing === item.id ? (
            <li
              key={item.id}
              className="dictionary-editor__row dictionary-editor__row--editing"
              data-sortable-row
            >
              <DictionaryItemForm
                dictionary={dictionary}
                item={item}
                errors={errors}
                pending={pending}
                onSubmit={(data) => run(actions.update, data, saved)}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <DictionaryRow
              key={item.id}
              item={item}
              dragging={activeIndex === index}
              handle={handleProps(index)}
              confirming={confirming === item.id}
              pending={pending}
              onEdit={() => startEdit(item.id)}
              onToggle={() =>
                run(
                  actions.setActive,
                  formOf({ dictionary, id: item.id, active: String(!item.isActive) }),
                  saved,
                )
              }
              onAskRemove={() => setConfirming(item.id)}
              onCancelRemove={() => setConfirming(null)}
              onRemove={() =>
                run(actions.remove, formOf({ dictionary, id: item.id }), (result) =>
                  t(
                    result.status === "done" && result.outcome === "hidden"
                      ? "dictionaries.hiddenInstead"
                      : "dictionaries.removed",
                    { name: item.name.ru },
                  ),
                )
              }
            />
          ),
        )}
      </ul>
      {editing === "new" ? (
        <DictionaryItemForm
          dictionary={dictionary}
          item={null}
          errors={errors}
          pending={pending}
          onSubmit={(data) => run(actions.add, data, saved)}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => startEdit("new")}
          className="dictionary-editor__add"
        >
          <Plus size={16} aria-hidden="true" />
          {t("dictionaries.add")}
        </Button>
      )}
      {feedback ? <FormStatus tone={feedback.tone}>{feedback.text}</FormStatus> : null}
    </section>
  );
}

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

function DictionaryRow({ item, dragging, handle, confirming, pending, ...on }: DictionaryRowProps) {
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
      {confirming ? (
        <div className="dictionary-editor__confirm" role="group" aria-label={t("remove")}>
          <span>{t("removeConfirm", { name: item.name.ru })}</span>
          <Button size="sm" pending={pending} onClick={on.onRemove}>
            {t("yes")}
          </Button>
          <Button size="sm" variant="ghost" onClick={on.onCancelRemove}>
            {t("no")}
          </Button>
        </div>
      ) : (
        <div className="dictionary-editor__actions">
          <Button
            size="sm"
            variant="ghost"
            onClick={on.onEdit}
            className="dictionary-editor__action"
          >
            {t("edit")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={on.onToggle}
            className="dictionary-editor__action"
          >
            {item.isActive ? t("hide") : t("show")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={on.onAskRemove}
            className="dictionary-editor__action"
          >
            {t("remove")}
          </Button>
        </div>
      )}
    </li>
  );
}
