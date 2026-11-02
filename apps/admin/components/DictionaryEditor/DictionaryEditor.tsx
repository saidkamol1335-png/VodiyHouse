"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import type { DictionaryItem, DictionaryKey } from "@/lib/admin/dictionaries/definitions";
import type { DictionaryActionSet } from "@/lib/admin/dictionaries/types";
import { useSortable } from "@/lib/ui/useSortable";
import { DictionaryItemForm } from "./DictionaryItemForm";
import { DictionaryRow } from "./DictionaryRow";
import {
  useDictionaryCommands,
  useDictionaryForm,
  useSyncedRows,
  type DictionaryCommands,
  type DictionaryForm,
} from "./useDictionaryEditor";

type DictionaryEditorProps = {
  dictionary: DictionaryKey;
  items: readonly DictionaryItem[];
  /** Server Actions; на служебном стенде — подделка (список DEMO не меняется). */
  actions: DictionaryActionSet;
};

/** Один справочник (Д6): правка на месте RU | UZ, «+ Добавить», порядок перетаскиванием, скрыть и удалить. */
export function DictionaryEditor({ dictionary, items, actions }: DictionaryEditorProps) {
  const t = useTranslations("admin.dictionaries");
  const [rows, setRows] = useSyncedRows(items);
  const form = useDictionaryForm();
  const commands = useDictionaryCommands(dictionary, actions, form.run);
  return (
    <section className="dictionary-editor" aria-labelledby={`dictionary-${dictionary}`}>
      <header className="dictionary-editor__head">
        <h2 id={`dictionary-${dictionary}`} className="dictionary-editor__title">
          {t(`titles.${dictionary}`)}
        </h2>
        <span className="dictionary-editor__count">{t("count", { count: rows.length })}</span>
      </header>
      <DictionaryRows
        dictionary={dictionary}
        rows={rows}
        form={form}
        commands={commands}
        onReorder={setRows}
      />
      <NewItemSlot dictionary={dictionary} form={form} commands={commands} />
      {form.feedback ? (
        <FormStatus tone={form.feedback.tone}>{form.feedback.text}</FormStatus>
      ) : null}
    </section>
  );
}

type RowsProps = {
  dictionary: DictionaryKey;
  rows: DictionaryItem[];
  form: DictionaryForm;
  commands: DictionaryCommands;
  onReorder: (rows: DictionaryItem[]) => void;
};

/** Список с перетаскиванием: ручки ищутся внутри этого <ul> — ref и useSortable здесь же. */
function DictionaryRows({ dictionary, rows, form, commands, onReorder }: RowsProps) {
  const list = useRef<HTMLUListElement>(null);
  const { handleProps, activeIndex } = useSortable({
    items: rows,
    onReorder,
    onDrop: commands.reorder,
    list,
  });
  return (
    <ul ref={list} className="dictionary-editor__rows">
      {rows.map((item, index) =>
        form.editing === item.id ? (
          <EditingRow
            key={item.id}
            dictionary={dictionary}
            item={item}
            form={form}
            commands={commands}
          />
        ) : (
          <DictionaryRow
            key={item.id}
            item={item}
            dragging={activeIndex === index}
            handle={handleProps(index)}
            confirming={form.confirming === item.id}
            pending={form.pending}
            onEdit={() => form.startEdit(item.id)}
            onToggle={() => commands.toggle(item)}
            onAskRemove={() => form.setConfirming(item.id)}
            onCancelRemove={() => form.setConfirming(null)}
            onRemove={() => commands.remove(item)}
          />
        ),
      )}
    </ul>
  );
}

type EditingRowProps = Omit<RowsProps, "rows" | "onReorder"> & { item: DictionaryItem };

function EditingRow({ dictionary, item, form, commands }: EditingRowProps) {
  return (
    <li className="dictionary-editor__row dictionary-editor__row--editing" data-sortable-row>
      <DictionaryItemForm
        dictionary={dictionary}
        item={item}
        errors={form.errors}
        pending={form.pending}
        onSubmit={commands.update}
        onCancel={form.stopEdit}
      />
    </li>
  );
}

function NewItemSlot({ dictionary, form, commands }: Omit<RowsProps, "rows" | "onReorder">) {
  const t = useTranslations("admin.dictionaries");
  if (form.editing === "new") {
    return (
      <DictionaryItemForm
        dictionary={dictionary}
        item={null}
        errors={form.errors}
        pending={form.pending}
        onSubmit={commands.add}
        onCancel={form.stopEdit}
      />
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => form.startEdit("new")}
      className="dictionary-editor__add"
    >
      <Plus size={16} aria-hidden="true" />
      {t("add")}
    </Button>
  );
}
