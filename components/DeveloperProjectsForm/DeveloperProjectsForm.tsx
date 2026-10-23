"use client";

import { useTranslations } from "next-intl";
import { useActionState, useRef, useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import {
  PROJECT_LIMITS,
  type ProjectDraft,
  type ProjectRowErrors,
} from "@/lib/admin/developers/projects";
import type { FormAction, SaveProjectsResult } from "@/lib/admin/developers/types";
import { useSortable } from "@/lib/ui/useSortable";
import { ProjectRow } from "./ProjectRow";

type DeveloperProjectsFormProps = {
  developerId: string;
  projects: readonly ProjectDraft[];
  action: FormAction<SaveProjectsResult>;
};

const IDLE: SaveProjectsResult = { status: "idle" };

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
        <ProjectRows
          rows={rows}
          rowErrors={rowErrors}
          onReorder={setRows}
          onChange={update}
          onRemove={remove}
        />
        <ProjectsActions count={rows.length} state={state} pending={pending} onAdd={add} />
      </form>
    </AdminPanel>
  );
}

type ProjectRowsProps = {
  rows: ProjectDraft[];
  rowErrors: ProjectRowErrors;
  onReorder: (rows: ProjectDraft[]) => void;
  onChange: (key: string, patch: Partial<ProjectDraft>) => void;
  onRemove: (key: string) => void;
};

/** Список с перетаскиванием: ручки ищутся внутри этого <ul> — ref и useSortable здесь же. */
function ProjectRows({ rows, rowErrors, onReorder, onChange, onRemove }: ProjectRowsProps) {
  const list = useRef<HTMLUListElement>(null);
  const { handleProps, activeIndex } = useSortable({ items: rows, onReorder, list });
  return (
    <ul ref={list} className="developer-projects__rows">
      {rows.map((row, index) => (
        <ProjectRow
          key={row.key}
          row={row}
          dragging={activeIndex === index}
          handle={handleProps(index)}
          issues={rowErrors[row.key]}
          onChange={(patch) => onChange(row.key, patch)}
          onRemove={() => onRemove(row.key)}
        />
      ))}
    </ul>
  );
}

type ProjectsActionsProps = {
  count: number;
  state: SaveProjectsResult;
  pending: boolean;
  onAdd: () => void;
};

function ProjectsActions({ count, state, pending, onAdd }: ProjectsActionsProps) {
  const t = useTranslations("admin.developers");
  return (
    <div className="developer-projects__actions">
      <Button variant="ghost" size="sm" onClick={onAdd} disabled={count >= PROJECT_LIMITS.maxRows}>
        + {t("projects.add")}
      </Button>
      <div className="developer-projects__save">
        <SaveFeedback state={state} />
        <Button type="submit" pending={pending}>
          {pending ? t("pending") : t("projects.save")}
        </Button>
      </div>
    </div>
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
