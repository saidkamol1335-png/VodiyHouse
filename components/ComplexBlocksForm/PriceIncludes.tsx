"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { BilingualField } from "@/components/BilingualField";
import { Button } from "@/components/Button";
import { ChoiceField } from "@/components/ChoiceField";
import { Field } from "@/components/Field";
import { BLOCK_LIMITS, type BlockDraft, type PriceInclude } from "@/lib/admin/complexes/blocks";

type PriceIncludesProps = {
  block: BlockDraft;
  error: string | undefined;
  onChange: (patch: Partial<BlockDraft>) => void;
};

/** «Что входит в цену» (ТЗ 7.3в) — свёрнуто: необязательно, перечень пунктов — TODO-заказчик. */
export function PriceIncludes({ block, error, onChange }: PriceIncludesProps) {
  const t = useTranslations("admin.complexes.blocks");
  const rows = block.priceIncludes;
  const set = (next: PriceInclude[]) => onChange({ priceIncludes: next });
  const update = (key: string, patch: Partial<PriceInclude>) =>
    set(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  return (
    <details className="block-fields__includes" open={rows.length > 0 || Boolean(error)}>
      <summary>{t("fields.includes", { count: rows.length })}</summary>
      <p className="field__meta">{t("fields.includesHint")}</p>
      {rows.map((row) => (
        <div key={row.key} className="block-fields__include">
          <BilingualField
            id={`include-${row.key}`}
            name={`include-${row.key}`}
            label={t("fields.includeItem")}
            uzLabel={t("fields.includeItemUz")}
            maxLength={BLOCK_LIMITS.includeItemMax}
            defaultValue={row.item}
            onChange={(item) => update(row.key, { item })}
          />
          <ChoiceField
            id={`include-${row.key}-kind`}
            name={`include-${row.key}-kind`}
            label={t("fields.includeKind")}
            options={[
              { value: "in", label: t("fields.included") },
              { value: "out", label: t("fields.separate") },
            ]}
            value={row.included ? "in" : "out"}
            onChange={(value) => update(row.key, { included: value === "in" })}
          />
          {row.included ? null : (
            <Field
              className="block-fields__include-price"
              id={`include-${row.key}-price`}
              label={t("fields.includePrice", { currency: t(`values.${block.currency}`) })}
              inputMode="numeric"
              value={row.price}
              onChange={(event) => update(row.key, { price: event.target.value })}
            />
          )}
          <button
            type="button"
            className="block-fields__include-remove"
            aria-label={t("fields.includeRemove")}
            onClick={() => set(rows.filter((item) => item.key !== row.key))}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
      {error ? <p className="field__error">{error}</p> : null}
      <Button
        size="sm"
        variant="ghost"
        disabled={rows.length >= BLOCK_LIMITS.includesMax}
        onClick={() =>
          set([
            ...rows,
            { key: crypto.randomUUID(), item: { ru: "", uz: "" }, included: true, price: "" },
          ])
        }
      >
        + {t("fields.includeAdd")}
      </Button>
    </details>
  );
}
