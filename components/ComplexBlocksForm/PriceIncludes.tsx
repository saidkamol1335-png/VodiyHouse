"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { BilingualField } from "@/components/BilingualField";
import { Button } from "@/components/Button";
import { ChoiceField } from "@/components/ChoiceField";
import { Field } from "@/components/Field";
import {
  BLOCK_LIMITS,
  newPriceInclude,
  type BlockDraft,
  type Currency,
  type PriceInclude,
} from "@/lib/admin/complexes/blocks";

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
        <IncludeRow
          key={row.key}
          row={row}
          currency={block.currency}
          onUpdate={(patch) => update(row.key, patch)}
          onRemove={() => set(rows.filter((item) => item.key !== row.key))}
        />
      ))}
      {error ? <p className="field__error">{error}</p> : null}
      <Button
        size="sm"
        variant="ghost"
        disabled={rows.length >= BLOCK_LIMITS.includesMax}
        onClick={() => set([...rows, newPriceInclude()])}
      >
        + {t("fields.includeAdd")}
      </Button>
    </details>
  );
}

type IncludeRowProps = {
  row: PriceInclude;
  currency: Currency;
  onUpdate: (patch: Partial<PriceInclude>) => void;
  onRemove: () => void;
};

/** Пункт: RU | UZ, «входит / отдельно», цена — только у «отдельно», корзина. */
function IncludeRow({ row, currency, onUpdate, onRemove }: IncludeRowProps) {
  const t = useTranslations("admin.complexes.blocks");
  const id = `include-${row.key}`;
  return (
    <div className="block-fields__include">
      <BilingualField
        id={id}
        name={id}
        label={t("fields.includeItem")}
        uzLabel={t("fields.includeItemUz")}
        maxLength={BLOCK_LIMITS.includeItemMax}
        defaultValue={row.item}
        onChange={(item) => onUpdate({ item })}
      />
      <IncludeKind id={id} included={row.included} onUpdate={onUpdate} />
      {row.included ? null : (
        <Field
          className="block-fields__include-price"
          id={`${id}-price`}
          label={t("fields.includePrice", { currency: t(`values.${currency}`) })}
          inputMode="numeric"
          value={row.price}
          onChange={(event) => onUpdate({ price: event.target.value })}
        />
      )}
      <button
        type="button"
        className="block-fields__include-remove"
        aria-label={t("fields.includeRemove")}
        onClick={onRemove}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

type IncludeKindProps = {
  id: string;
  included: boolean;
  onUpdate: (patch: Partial<PriceInclude>) => void;
};

function IncludeKind({ id, included, onUpdate }: IncludeKindProps) {
  const t = useTranslations("admin.complexes.blocks");
  return (
    <ChoiceField
      id={`${id}-kind`}
      name={`${id}-kind`}
      label={t("fields.includeKind")}
      options={[
        { value: "in", label: t("fields.included") },
        { value: "out", label: t("fields.separate") },
      ]}
      value={included ? "in" : "out"}
      onChange={(value) => onUpdate({ included: value === "in" })}
    />
  );
}
