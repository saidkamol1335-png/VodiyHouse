"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/Button";
import { ChoiceField } from "@/components/ChoiceField";
import type { BlockDraft, Currency } from "@/lib/admin/complexes/blocks";

type CurrencyFieldProps = {
  block: BlockDraft;
  options: { value: string; label: string }[];
  onChange: (patch: Partial<BlockDraft>) => void;
};

/**
 * Цены в валюте блока: «цена от» планировок, квартиры (у квартиры своей валюты нет) и пункты
 * «отдельно». Есть хоть одна — смена валюты спрашивает: числа не пересчитываются (курс — фаза 2).
 */
const hasPrices = (block: BlockDraft) =>
  block.pricedLayouts > 0 ||
  block.units > 0 ||
  block.priceIncludes.some((row) => !row.included && row.price.trim() !== "");

export function CurrencyField({ block, options, onChange }: CurrencyFieldProps) {
  const t = useTranslations("admin.complexes.blocks");
  const [pending, setPending] = useState<Currency | null>(null);
  const pick = (value: string) => {
    const next = value as Currency;
    if (next === block.currency) return;
    if (hasPrices(block)) setPending(next);
    else onChange({ currency: next });
  };
  return (
    <div className="block-fields__currency">
      <ChoiceField
        id={`block-${block.key}-currency`}
        name={`block-${block.key}-currency`}
        label={t("fields.currency")}
        options={options}
        value={block.currency}
        onChange={pick}
      />
      {pending ? (
        <p className="block-fields__confirm">
          {t("currencyConfirm", { currency: t(`values.${pending}`) })}{" "}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onChange({ currency: pending });
              setPending(null);
            }}
          >
            {t("currencyYes")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
            {t("removeCancel")}
          </Button>
        </p>
      ) : null}
    </div>
  );
}
