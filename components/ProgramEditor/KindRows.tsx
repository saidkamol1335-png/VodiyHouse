"use client";

import { termText, type ProgramsT } from "@/components/ProgramCard/cardText";
import { SelectField } from "@/components/SelectField";
import {
  draftNumber,
  type FeeDraft,
  type TermDraft,
  type TierDraft,
} from "@/lib/admin/programs/draft";
import { PROGRAM_LIMITS } from "@/lib/admin/programs/validate";
import type { FeeName } from "@/lib/calc/programs";
import { formatPercent } from "@/lib/format";
import { ProgramRows, type RowColumn } from "./ProgramRows";
import { SegmentChoice } from "./SegmentChoice";
import type { ProgramDraftControl } from "./useProgramDraft";

const FEE_NAMES: readonly FeeName[] = ["appraisal", "commission", "insurance"];

type KindRowsProps = { control: ProgramDraftControl; t: ProgramsT };

/** Строки по виду: у схемы — ступени, у наценки и банков — сроки и разовые платежи. */
export function KindRows({ control, t }: KindRowsProps) {
  const { draft } = control;
  if (draft.kind === "full") return null;
  if (draft.kind === "scheme") return <TierRows control={control} t={t} />;
  return (
    <>
      <TermRows control={control} t={t} />
      <FeeRows control={control} t={t} />
    </>
  );
}

function TierRows({ control, t }: KindRowsProps) {
  const columns: RowColumn<TierDraft>[] = [
    { field: "minDownPct", label: t("editor.tiers.minDown"), inputMode: "numeric" },
    { field: "discountPct", label: t("editor.tiers.discount") },
    { field: "minMonths", label: t("editor.tiers.minMonths"), inputMode: "numeric" },
    { field: "maxMonths", label: t("editor.tiers.maxMonths"), inputMode: "numeric" },
  ];
  return (
    <ProgramRows
      list="tiers"
      title={t("editor.tiers.title")}
      rows={control.draft.tiers}
      columns={columns}
      commands={control.tiers}
      errors={control.errors}
      max={PROGRAM_LIMITS.tiers}
      addLabel={t("editor.tiers.add")}
      removeLabel={t("editor.tiers.remove")}
      summary={(row) => tierSummary(row, t)}
      t={t}
    />
  );
}

/** Строка ступени — как её чип в карточке: «от 50% · −6% · до 18 мес.». */
function tierSummary(row: TierDraft, t: ProgramsT): string {
  const down = draftNumber(row.minDownPct);
  const discount = draftNumber(row.discountPct);
  const months = draftNumber(row.maxMonths);
  const chip = t("card.tierChip", { down: down === null ? "…" : formatPercent(down) });
  const note = t("card.tierChipValue", {
    discount: discount ? formatPercent(discount) : "none",
    months: months ? termText(months, t) : "…",
  });
  return `${chip} · ${note}`;
}

function TermRows({ control, t }: KindRowsProps) {
  const markup = control.draft.kind === "markup";
  const columns: RowColumn<TermDraft>[] = [
    { field: "months", label: t("editor.terms.months"), inputMode: "numeric" },
    { field: "ratePct", label: markup ? t("editor.terms.markup") : t("editor.terms.rate") },
  ];
  return (
    <ProgramRows
      list="terms"
      title={t("editor.terms.title")}
      rows={control.draft.terms}
      columns={columns}
      commands={control.terms}
      errors={control.errors}
      max={PROGRAM_LIMITS.terms}
      addLabel={t("editor.terms.add")}
      removeLabel={t("editor.terms.remove")}
      t={t}
    />
  );
}

/** Колонки разовых: что (список), как (сумма или %), сколько. */
function feeColumns({ control, t }: KindRowsProps): RowColumn<FeeDraft>[] {
  // У наценки своей валюты нет — разовые только в % (решение ревью 2.1–2.3).
  const kinds = control.draft.kind === "markup" ? (["pct"] as const) : (["fixed", "pct"] as const);
  const names = FEE_NAMES.map((name) => ({ value: name, label: t(`fees.${name}`) }));
  return [
    {
      field: "name",
      label: t("editor.fees.name"),
      render: (row, _index, error) => (
        <SelectField
          id={`${row.key}-name`}
          label={t("editor.fees.name")}
          options={names}
          value={row.name}
          error={error}
          onChange={(event) =>
            control.fees.update(row.key, { name: event.target.value as FeeName })
          }
        />
      ),
    },
    {
      field: "kind",
      label: t("editor.fees.kind"),
      render: (row, _index, error) => (
        <>
          <SegmentChoice
            label={t("editor.fees.kind")}
            value={row.kind}
            options={kinds.map((kind) => ({ value: kind, label: t(`editor.fees.${kind}`) }))}
            onChange={(kind) => control.fees.update(row.key, { kind })}
          />
          {error ? <p className="program-rows__error">{error}</p> : null}
        </>
      ),
    },
    { field: "value", label: t("editor.fees.value") },
  ];
}

function FeeRows({ control, t }: KindRowsProps) {
  const columns = feeColumns({ control, t });
  return (
    <ProgramRows
      list="fees"
      title={t("editor.fees.title")}
      rows={control.draft.fees}
      columns={columns}
      commands={control.fees}
      errors={control.errors}
      max={PROGRAM_LIMITS.fees}
      addLabel={t("editor.fees.add")}
      removeLabel={t("editor.fees.remove")}
      t={t}
    />
  );
}
