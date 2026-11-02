"use client";

import { Field } from "@/components/Field";
import type { ProgramsT } from "@/components/ProgramCard/cardText";
import { SelectField } from "@/components/SelectField";
import type { BankOption } from "@/lib/admin/programs/types";
import { errorText } from "./errorText";
import { SegmentChoice } from "./SegmentChoice";
import type { ProgramDraftControl } from "./useProgramDraft";

type EditorBasicsProps = {
  control: ProgramDraftControl;
  banks: readonly BankOption[];
  t: ProgramsT;
};

/** Поля вида: у банка — банк, метод и валюта; у 100 % — скидка; у остальных — мин. взнос. */
export function EditorBasics({ control, banks, t }: EditorBasicsProps) {
  const { draft, errors, patch } = control;
  const bank = draft.kind === "bank" || draft.kind === "mortgage";
  const id = (name: string) => `program-${draft.id ?? "new"}-${name}`;
  return (
    <div className="program-editor__basics">
      {bank ? <BankFields control={control} banks={banks} t={t} /> : null}
      {draft.kind === "full" ? (
        <Field
          id={id("discount")}
          label={t("editor.discountPct")}
          inputMode="decimal"
          value={draft.discountPct}
          onChange={(event) => patch({ discountPct: event.target.value })}
          error={errorText(errors, "discountPct", t)}
        />
      ) : null}
      {draft.kind !== "full" && draft.kind !== "scheme" ? (
        <Field
          id={id("min-down")}
          label={t("editor.minDownPct")}
          inputMode="numeric"
          value={draft.minDownPct}
          onChange={(event) => patch({ minDownPct: event.target.value })}
          error={errorText(errors, "minDownPct", t)}
        />
      ) : null}
    </div>
  );
}

function BankFields({ control, banks, t }: EditorBasicsProps) {
  const { draft, errors, patch } = control;
  // Скрытый в справочнике банк новым программам не предлагаем, но у своей программы он остаётся.
  const options = banks
    .filter((bank) => bank.isActive || bank.id === draft.bankId)
    .map((bank) => ({
      value: String(bank.id),
      label: bank.isActive ? bank.name.ru : t("editor.bankHidden", { name: bank.name.ru }),
    }));
  return (
    <>
      <SelectField
        id={`program-${draft.id ?? "new"}-bank`}
        label={t("editor.bank")}
        options={options}
        placeholder={t("editor.bankPlaceholder")}
        value={draft.bankId === null ? "" : String(draft.bankId)}
        onChange={(event) =>
          patch({ bankId: event.target.value ? Number(event.target.value) : null })
        }
        error={errorText(errors, "bank", t)}
        hint={options.length === 0 ? t("editor.bankEmpty") : undefined}
      />
      <SegmentChoice
        label={t("editor.method")}
        value={draft.bankMethod}
        options={[
          { value: "annuity", label: t("methods.annuity") },
          { value: "differentiated", label: t("methods.differentiated") },
        ]}
        onChange={(bankMethod) => patch({ bankMethod })}
      />
      <SegmentChoice
        label={t("editor.currency")}
        value={draft.currency}
        options={[
          { value: "UZS", label: t("card.currencyUzs") },
          { value: "USD", label: t("card.currencyUsd") },
        ]}
        onChange={(currency) => patch({ currency })}
      />
    </>
  );
}
