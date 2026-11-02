"use client";

import { PublicationBadge } from "@/components/PublicationBadge";
import type { ComplexOption, DeveloperOption } from "@/lib/admin/showcase/types";

type ComplexPickerProps = {
  complexes: readonly ComplexOption[];
  /** Задан — только ЖК этого застройщика (спецпредложение, реклама); пусто — ещё не выбран. */
  developerId?: string;
  /** Подписи застройщиков у ЖК в общем списке (подборка вручную). */
  developers?: readonly DeveloperOption[];
  selected: readonly string[];
  label: string;
  hint?: string;
  emptyText: string;
  error?: string;
  idPrefix: string;
};

/** Отметки ЖК: не опубликованные остаются в списке с плашкой — на сайт они не попадут. */
export function ComplexPicker(props: ComplexPickerProps) {
  const shown =
    props.developerId === undefined
      ? props.complexes
      : props.complexes.filter((complex) => complex.developerId === props.developerId);
  const developerName = (id: string) => props.developers?.find((developer) => developer.id === id)?.name;
  const noteId = `${props.idPrefix}-complexes-note`;
  return (
    <fieldset className="showcase-form__complexes" aria-describedby={noteId}>
      <legend className="field__label">{props.label}</legend>
      {shown.length === 0 ? (
        <p className="field__meta">{props.emptyText}</p>
      ) : (
        <ul className="showcase-form__options">
          {shown.map((complex) => (
            <li key={complex.id}>
              <label className="showcase-form__complex">
                <input
                  type="checkbox"
                  name="complexIds"
                  value={complex.id}
                  defaultChecked={props.selected.includes(complex.id)}
                />
                <span className="showcase-form__complex-name">{complex.name}</span>
                {props.developers ? (
                  <span className="showcase-form__complex-dev">{developerName(complex.developerId)}</span>
                ) : null}
                {complex.status !== "published" ? <PublicationBadge status={complex.status} /> : null}
              </label>
            </li>
          ))}
        </ul>
      )}
      {props.error ? (
        <p id={noteId} className="field__error" role="alert">
          {props.error}
        </p>
      ) : (
        <p id={noteId} className="field__meta">
          {props.hint}
        </p>
      )}
    </fieldset>
  );
}
