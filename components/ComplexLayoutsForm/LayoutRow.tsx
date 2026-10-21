"use client";

import { Copy, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/Badge";
import { ChoiceField } from "@/components/ChoiceField";
import { DrawingTile } from "@/components/DrawingTile";
import { Field } from "@/components/Field";
import type { Currency } from "@/lib/admin/complexes/blocks";
import {
  ROOM_CHOICES,
  type LayoutDraft,
  type LayoutRowErrors,
} from "@/lib/admin/complexes/layouts";
import { formatPrice } from "@/lib/format";

type LayoutRowProps = {
  row: LayoutDraft;
  currency: Currency;
  /** У блока есть список квартир: «цена от» и «доступна» — из квартир (PLAN §3.1). */
  hasUnits: boolean;
  issues: LayoutRowErrors[string] | undefined;
  /** Нет отметки 1.2 у опубликованного ЖК: чертёж не загрузить. */
  uploadLocked: boolean;
  onChange: (patch: Partial<LayoutDraft>) => void;
  onDrawing: (file: File | undefined) => Promise<string | null>;
  onDuplicate: () => void;
  onRemove: () => void;
};

function roomOptions(current: number | null, studioLabel: string) {
  const choices: number[] = [...ROOM_CHOICES];
  if (current !== null && !choices.includes(current)) choices.push(current);
  return choices.map((rooms) => ({
    value: String(rooms),
    label: rooms === 0 ? studioLabel : String(rooms),
  }));
}

/** Строка планировки (И5): чертёж · комнаты · площадь · «цена от» · «доступна» · плашки. */
export function LayoutRow(props: LayoutRowProps) {
  const { row, currency, hasUnits, issues, onChange } = props;
  const t = useTranslations("admin.complexes.layouts");
  const rooms = useTranslations("admin.complexes.rooms");
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const issue = (field: "rooms" | "area" | "priceFrom") =>
    issues?.[field] ? t(`issues.${issues[field]}`) : undefined;
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setUploadError(await props.onDrawing(file));
    setBusy(false);
  };
  const id = (field: string) => `layout-${row.key}-${field}`;
  return (
    <li className="layout-row" data-testid="layout-row">
      <div className="layout-row__drawing">
        <DrawingTile
          id={id("drawing")}
          src={row.drawingSrc}
          busy={busy}
          disabled={props.uploadLocked}
          label={t("drawingAdd")}
          onPick={(file) => void pick(file)}
          onRemove={() => onChange({ drawingId: null, drawingSrc: null })}
        />
      </div>
      <ChoiceField
        id={id("rooms")}
        name={id("rooms")}
        label={t("fields.rooms")}
        options={roomOptions(row.rooms, rooms("studio"))}
        value={row.rooms === null ? "" : String(row.rooms)}
        error={issue("rooms")}
        onChange={(value) => onChange({ rooms: value === "" ? null : Number(value) })}
      />
      <Field
        id={id("area")}
        label={t("fields.area")}
        inputMode="decimal"
        value={row.area}
        error={issue("area")}
        onChange={(event) => onChange({ area: event.target.value })}
      />
      {hasUnits ? (
        <OfferText row={row} currency={currency} />
      ) : (
        <div className="layout-row__price">
          <Field
            id={id("price")}
            label={t("fields.priceFrom", { currency: t(`currency.${currency}`) })}
            inputMode="numeric"
            value={row.priceFrom}
            error={issue("priceFrom")}
            onChange={(event) => onChange({ priceFrom: event.target.value })}
          />
          <label className="layout-row__available">
            <input
              type="checkbox"
              checked={row.available}
              onChange={(event) => onChange({ available: event.target.checked })}
            />
            {t("fields.available")}
          </label>
        </div>
      )}
      <RowEnd {...props} />
      {uploadError ? <p className="field__error layout-row__issue">{uploadError}</p> : null}
    </li>
  );
}

function OfferText({ row, currency }: { row: LayoutDraft; currency: Currency }) {
  const t = useTranslations("admin.complexes.layouts");
  const offer = row.offer;
  const text =
    offer && offer.freeCount && offer.priceFrom !== null
      ? t("offer", { price: formatPrice(offer.priceFrom, currency), count: offer.freeCount })
      : t("offerNone");
  return (
    <p className="layout-row__offer">
      <span className="field__label">{t("fields.fromUnits")}</span>
      {text}
    </p>
  );
}

function RowEnd({ row, hasUnits, onDuplicate, onRemove }: LayoutRowProps) {
  const t = useTranslations("admin.complexes.layouts");
  const priced = hasUnits ? row.offer?.priceFrom != null : Boolean(row.priceFrom.trim());
  return (
    <div className="layout-row__end">
      <span className="layout-row__badges">
        {row.drawingSrc ? null : (
          <Badge tone="amber" size="sm">
            {t("noDrawing")}
          </Badge>
        )}
        {priced ? null : <Badge size="sm">{t("noPrice")}</Badge>}
      </span>
      <button
        type="button"
        className="layout-row__icon"
        aria-label={t("duplicate")}
        onClick={onDuplicate}
      >
        <Copy size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="layout-row__icon"
        aria-label={t("remove")}
        title={row.units > 0 ? t("hasUnits", { count: row.units }) : undefined}
        disabled={row.units > 0}
        onClick={onRemove}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
