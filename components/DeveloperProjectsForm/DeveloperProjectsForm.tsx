"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useRef, useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { BilingualField } from "@/components/BilingualField";
import { Button } from "@/components/Button";
import { DeliveryBadge } from "@/components/DeliveryBadge";
import { FormStatus } from "@/components/FormStatus";
import { QuarterSelect } from "@/components/QuarterSelect";
import { SortHandle } from "@/components/SortHandle";
import {
  PROJECT_LIMITS,
  type ProjectDraft,
  type ProjectRowErrors,
} from "@/lib/admin/developers/projects";
import type { FormAction, SaveProjectsResult } from "@/lib/admin/developers/types";
import { useSortable } from "@/lib/ui/useSortable";

type DeveloperProjectsFormProps = {
  developerId: string;
  projects: readonly ProjectDraft[];
  action: FormAction<SaveProjectsResult>;
};

const IDLE: SaveProjectsResult = { status: "idle" };
const YEARS = { min: 2000, max: 2040 };

/** Строки формы: после сохранения сервер присылает список с id — берём его вместо черновика. */
function useProjectRows(projects: readonly ProjectDraft[]) {
  const [rows, setRows] = useState<ProjectDraft[]>([...projects]);
  const [source, setSource] = useState(projects);
  if (projects !== source) {
    setSource(projects);
    setRows([...projects]);
  }
  const update = (key: string, patch: Partial<ProjectDraft>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const add = () =>
    setRows((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        id: null,
        name: { ru: "", uz: "" },
        plannedOn: null,
        deliveredOn: null,
      },
    ]);
  const remove = (key: string) => setRows((current) => current.filter((row) => row.key !== key));
  return { rows, setRows, update, add, remove };
}

/** Вкладка «Сданные объекты» (Д5): правка в строке, порядок перетаскиванием, сохранение вкладкой. */
export function DeveloperProjectsForm({
  developerId,
  projects,
  action,
}: DeveloperProjectsFormProps) {
  const t = useTranslations("admin.developers");
  const { rows, setRows, update, add, remove } = useProjectRows(projects);
  const list = useRef<HTMLUListElement>(null);
  const { handleProps, activeIndex } = useSortable({ items: rows, onReorder: setRows, list });
  const [state, formAction, pending] = useActionState(
    (_previous: SaveProjectsResult, formData: FormData) => action(formData),
    IDLE,
  );
  const rowErrors: ProjectRowErrors = state.status === "error" ? state.rowErrors : {};

  return (
    <AdminPanel title={t("projects.title")} wide>
      <form className="developer-projects" action={formAction} noValidate>
        <input type="hidden" name="id" value={developerId} />
        <input type="hidden" name="projects" value={JSON.stringify(rows)} />
        <p className="developer-projects__lead">{t("projectsLead")}</p>
        {rows.length === 0 ? (
          <p className="developer-projects__empty">{t("projectsEmpty")}</p>
        ) : null}
        <ul ref={list} className="developer-projects__rows">
          {rows.map((row, index) => (
            <ProjectRow
              key={row.key}
              row={row}
              dragging={activeIndex === index}
              handle={handleProps(index)}
              issues={rowErrors[row.key]}
              onChange={(patch) => update(row.key, patch)}
              onRemove={() => remove(row.key)}
            />
          ))}
        </ul>
        <div className="developer-projects__actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={add}
            disabled={rows.length >= PROJECT_LIMITS.maxRows}
          >
            + {t("projects.add")}
          </Button>
          <div className="developer-projects__save">
            <SaveFeedback state={state} />
            <Button type="submit" pending={pending}>
              {pending ? t("pending") : t("projects.save")}
            </Button>
          </div>
        </div>
      </form>
    </AdminPanel>
  );
}

type ProjectRowProps = {
  row: ProjectDraft;
  dragging: boolean;
  handle: ReturnType<ReturnType<typeof useSortable>["handleProps"]>;
  issues: ProjectRowErrors[string] | undefined;
  onChange: (patch: Partial<ProjectDraft>) => void;
  onRemove: () => void;
};

function ProjectRow({ row, dragging, handle, issues, onChange, onRemove }: ProjectRowProps) {
  const t = useTranslations("admin.developers");
  const title = row.name.ru || t("projects.unnamed");
  const problems = issues
    ? Object.values(issues).map((code) => t(`issues.${code}`, { min: 0 }))
    : [];
  return (
    <li
      className={
        dragging
          ? "developer-projects__row developer-projects__row--dragging"
          : "developer-projects__row"
      }
      data-sortable-row
      data-testid="project-row"
    >
      <span className="developer-projects__handle">
        <SortHandle label={t("projects.move", { name: title })} active={dragging} {...handle} />
      </span>
      <div className="developer-projects__name">
        <BilingualField
          id={`project-${row.key}`}
          name={`project.${row.key}.name`}
          label={t("projects.name")}
          uzLabel={t("projects.nameUz")}
          maxLength={PROJECT_LIMITS.nameMax}
          defaultValue={row.name}
          onChange={(name) => onChange({ name })}
        />
      </div>
      <QuarterSelect
        id={`project-${row.key}-planned`}
        name={`project.${row.key}.plannedOn`}
        label={t("projects.planned")}
        defaultValue={row.plannedOn}
        minYear={YEARS.min}
        maxYear={YEARS.max}
        onChange={(plannedOn) => onChange({ plannedOn })}
      />
      <QuarterSelect
        id={`project-${row.key}-delivered`}
        name={`project.${row.key}.deliveredOn`}
        label={t("projects.delivered")}
        defaultValue={row.deliveredOn}
        minYear={YEARS.min}
        maxYear={YEARS.max}
        onChange={(deliveredOn) => onChange({ deliveredOn })}
      />
      <div className="developer-projects__end">
        <span data-testid="project-status">
          <DeliveryBadge plannedOn={row.plannedOn} deliveredOn={row.deliveredOn} />
        </span>
        <button
          type="button"
          className="developer-projects__remove"
          aria-label={t("projects.remove")}
          onClick={onRemove}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
      {problems.length > 0 ? (
        <p className="field__error developer-projects__issues">{problems.join(" · ")}</p>
      ) : null}
    </li>
  );
}

function SaveFeedback({ state }: { state: SaveProjectsResult }) {
  const t = useTranslations("admin.developers");
  if (state.status === "saved") {
    return (
      <FormStatus key={state.at} tone="success">
        {t("saved")}
      </FormStatus>
    );
  }
  if (state.status !== "error") return null;
  return <FormStatus tone="error">{t(`errors.${state.error ?? "invalid"}`)}</FormStatus>;
}
