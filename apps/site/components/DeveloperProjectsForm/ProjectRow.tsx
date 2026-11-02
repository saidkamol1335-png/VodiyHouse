"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { BilingualField } from "@/components/BilingualField";
import { DeliveryBadge } from "@/components/DeliveryBadge";
import { QuarterSelect } from "@/components/QuarterSelect";
import { SortHandle } from "@/components/SortHandle";
import {
  PROJECT_LIMITS,
  type ProjectDraft,
  type ProjectRowErrors,
} from "@/lib/admin/developers/projects";
import type { useSortable } from "@/lib/ui/useSortable";

const YEARS = { min: 2000, max: 2040 };

type ProjectRowProps = {
  row: ProjectDraft;
  dragging: boolean;
  handle: ReturnType<ReturnType<typeof useSortable>["handleProps"]>;
  issues: ProjectRowErrors[string] | undefined;
  onChange: (patch: Partial<ProjectDraft>) => void;
  onRemove: () => void;
};

/** Сданный объект (Д5): ручка порядка, название RU | UZ, «квартал + год» сроков, плашка сроков. */
export function ProjectRow({ row, dragging, handle, issues, onChange, onRemove }: ProjectRowProps) {
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
      <ProjectDates row={row} onChange={onChange} />
      <ProjectRowEnd row={row} onRemove={onRemove} />
      {problems.length > 0 ? (
        <p className="field__error developer-projects__issues">{problems.join(" · ")}</p>
      ) : null}
    </li>
  );
}

function ProjectDates({ row, onChange }: Pick<ProjectRowProps, "row" | "onChange">) {
  const t = useTranslations("admin.developers.projects");
  return (
    <>
      <QuarterSelect
        id={`project-${row.key}-planned`}
        name={`project.${row.key}.plannedOn`}
        label={t("planned")}
        defaultValue={row.plannedOn}
        minYear={YEARS.min}
        maxYear={YEARS.max}
        onChange={(plannedOn) => onChange({ plannedOn })}
        className="developer-projects__quarter"
      />
      <QuarterSelect
        id={`project-${row.key}-delivered`}
        name={`project.${row.key}.deliveredOn`}
        label={t("delivered")}
        defaultValue={row.deliveredOn}
        minYear={YEARS.min}
        maxYear={YEARS.max}
        onChange={(deliveredOn) => onChange({ deliveredOn })}
        className="developer-projects__quarter"
      />
    </>
  );
}

function ProjectRowEnd({ row, onRemove }: Pick<ProjectRowProps, "row" | "onRemove">) {
  const t = useTranslations("admin.developers.projects");
  return (
    <div className="developer-projects__end">
      <span data-testid="project-status">
        <DeliveryBadge plannedOn={row.plannedOn} deliveredOn={row.deliveredOn} />
      </span>
      <button
        type="button"
        className="developer-projects__remove"
        aria-label={t("remove")}
        onClick={onRemove}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
