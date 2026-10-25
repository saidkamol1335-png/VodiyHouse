"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { SelectField } from "@/components/SelectField";
import { emptyNearbyDraft, nearbyDraftIssue, type NearbyDraft } from "@/lib/admin/complexes/nearby";
import { NEARBY_KINDS, NEARBY_LIMITS } from "@/lib/site/complex/nearby";

type NearbyEditorProps = {
  initial: readonly NearbyDraft[];
  /** Отказ сервера по полю (обычно уже видно у строки). */
  error?: string;
};

/**
 * «Удобство локации» (Ф5, мокап .jloc__side): места рядом с ЖК — вид, название RU | UZ, метры по
 * прямой и минуты пешком или на машине. Список уходит одним скрытым полем «nearby»; ошибка строки
 * видна сразу у неё — до «Сохранить вкладку».
 */
export function NearbyEditor({ initial, error }: NearbyEditorProps) {
  const t = useTranslations("admin.complexes.nearby");
  const [rows, setRows] = useState<NearbyDraft[]>(() => [...initial]);
  const update = (key: string, patch: Partial<NearbyDraft>) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  return (
    <fieldset className="nearby-editor">
      <legend className="nearby-editor__title">{t("title")}</legend>
      <p className="nearby-editor__lead">{t("lead")}</p>
      <input type="hidden" name="nearby" value={JSON.stringify(rows)} />
      {rows.length > 0 ? (
        <ol className="nearby-editor__rows">
          {rows.map((row, index) => (
            <NearbyRow key={row.key} row={row} index={index} onChange={(patch) => update(row.key, patch)} onRemove={() => setRows((current) => current.filter((item) => item.key !== row.key))} />
          ))}
        </ol>
      ) : null}
      {error ? <p className="nearby-editor__error">{error}</p> : null}
      {rows.length < NEARBY_LIMITS.places ? (
        <Button type="button" variant="outline" size="sm" className="nearby-editor__add" onClick={() => setRows((current) => [...current, emptyNearbyDraft()])}>
          <Plus size={16} aria-hidden />
          {t("add")}
        </Button>
      ) : null}
    </fieldset>
  );
}

type NearbyRowProps = { row: NearbyDraft; index: number; onChange: (patch: Partial<NearbyDraft>) => void; onRemove: () => void };

function NearbyRow({ row, index, onChange, onRemove }: NearbyRowProps) {
  const t = useTranslations("admin.complexes.nearby");
  const issue = nearbyDraftIssue(row);
  // Пустую новую строку не ругаем, пока в неё ничего не ввели.
  const untouched = !row.nameRu && !row.nameUz && !row.meters && !row.minutes;
  const id = `nearby-${row.key}`;
  return (
    <li className="nearby-editor__row">
      <SelectField className="nearby-editor__kind" id={`${id}-kind`} label={t("kind", { n: index + 1 })} options={NEARBY_KINDS.map((kind) => ({ value: kind, label: t(`kinds.${kind}`) }))} value={row.kind} onChange={(event) => onChange({ kind: event.target.value })} />
      <Field className="nearby-editor__name" id={`${id}-ru`} label={t("nameRu")} placeholder={t("namePlaceholder")} maxLength={NEARBY_LIMITS.nameMax} value={row.nameRu} onChange={(event) => onChange({ nameRu: event.target.value })} />
      <Field className="nearby-editor__name" id={`${id}-uz`} label={t("nameUz")} maxLength={NEARBY_LIMITS.nameMax} value={row.nameUz} onChange={(event) => onChange({ nameUz: event.target.value })} />
      <Field className="nearby-editor__number" id={`${id}-meters`} label={t("meters")} inputMode="numeric" value={row.meters} onChange={(event) => onChange({ meters: event.target.value })} />
      <Field className="nearby-editor__number" id={`${id}-minutes`} label={t("minutes")} inputMode="numeric" value={row.minutes} onChange={(event) => onChange({ minutes: event.target.value })} />
      <SelectField className="nearby-editor__mode" id={`${id}-mode`} label={t("mode")} options={[{ value: "walk", label: t("walk") }, { value: "car", label: t("car") }]} value={row.mode} onChange={(event) => onChange({ mode: event.target.value === "car" ? "car" : "walk" })} />
      <button type="button" className="nearby-editor__remove" aria-label={t("remove", { n: index + 1 })} onClick={onRemove}>
        <X size={18} aria-hidden />
      </button>
      {issue && !untouched ? <p className="nearby-editor__error nearby-editor__error--row">{t(`issues.${issue}`)}</p> : null}
    </li>
  );
}
