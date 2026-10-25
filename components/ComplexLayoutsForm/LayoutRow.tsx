"use client";

import { Copy, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/Badge";
import { ChoiceField } from "@/components/ChoiceField";
import { DrawingTile } from "@/components/DrawingTile";
import { Field } from "@/components/Field";
import type { Currency } from "@/lib/admin/complexes/blocks";
import { ROOM_CHOICES, type LayoutDraft, type LayoutRowErrors } from "@/lib/admin/complexes/layouts";
import { formatPrice } from "@/lib/format";

type LayoutRowProps = {
  row: LayoutDraft;
  currency: Currency;
  /** У блока есть список квартир: «цена от» и «доступна» — из квартир (PLAN §3.1). */
  hasUnits: boolean;
  issues: LayoutRowErrors[string] | undefined;
  /** Нет отметки 1.2 у опубликованного ЖК: чертёж не загрузить. */
  uploadLocked: boolean;
  /** Номер варианта у двойника по комнатам и площади (layoutVariants); иначе null. */
  variant: number | null;
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
  const { row, issues, onChange } = props;
  const t = useTranslations("admin.complexes.layouts");
  const rooms = useTranslations("admin.complexes.rooms");
  const drawing = useDrawingPick(props.onDrawing);
  const issue = (field: "rooms" | "area" | "priceFrom") => (issues?.[field] ? t(`issues.${issues[field]}`) : undefined);
  return (
    <li className="layout-row" data-testid="layout-row">
      <RowDrawing {...props} busy={drawing.busy} onPick={drawing.pick} />
      <ChoiceField
        id={fieldId(row, "rooms")}
        name={fieldId(row, "rooms")}
        label={t("fields.rooms")}
        options={roomOptions(row.rooms, rooms("studio"))}
        value={row.rooms === null ? "" : String(row.rooms)}
        error={issue("rooms")}
        onChange={(value) => onChange({ rooms: value === "" ? null : Number(value) })}
      />
      <Field
        className="layout-row__area"
        id={fieldId(row, "area")}
        label={t("fields.area")}
        inputMode="decimal"
        value={row.area}
        error={issue("area")}
        onChange={(event) => onChange({ area: event.target.value })}
      />
      <RowPrice {...props} error={issue("priceFrom")} />
      <RowEnd {...props} />
      {/* Последним ребёнком строки: ошибка загрузки встаёт на всю ширину под ней. */}
      {drawing.error ? <p className="field__error layout-row__issue">{drawing.error}</p> : null}
    </li>
  );
}

const fieldId = (row: LayoutDraft, field: string) => `layout-${row.key}-${field}`;

/** Загрузка чертежа: пока идёт — плитка занята; отказ — текст под строкой. */
function useDrawingPick(onDrawing: LayoutRowProps["onDrawing"]) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(await onDrawing(file));
    setBusy(false);
  };
  return { busy, error, pick };
}

type RowDrawingProps = LayoutRowProps & {
  busy: boolean;
  onPick: (file: File | undefined) => Promise<void>;
};

function RowDrawing({ row, uploadLocked, busy, onPick, onChange }: RowDrawingProps) {
  const t = useTranslations("admin.complexes.layouts");
  return (
    <div className="layout-row__drawing">
      <DrawingTile
        id={fieldId(row, "drawing")}
        src={row.drawingSrc}
        busy={busy}
        disabled={uploadLocked}
        label={t("drawingAdd")}
        onPick={(file) => void onPick(file)}
        onRemove={() => onChange({ drawingId: null, drawingSrc: null })}
      />
    </div>
  );
}

/** «Цена от»: у блока со списком — из квартир (только чтение), иначе — поле. */
function RowPrice({ row, currency, hasUnits, error, onChange }: LayoutRowProps & { error?: string }) {
  const t = useTranslations("admin.complexes.layouts");
  if (hasUnits) return <OfferText row={row} currency={currency} />;
  return (
    <div className="layout-row__price">
      <Field
        id={fieldId(row, "price")}
        label={t("fields.priceFrom", { currency: t(`currency.${currency}`) })}
        inputMode="numeric"
        value={row.priceFrom}
        error={error}
        onChange={(event) => onChange({ priceFrom: event.target.value })}
      />
    </div>
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

function RowEnd({ row, hasUnits, variant, onDuplicate, onRemove }: LayoutRowProps) {
  const t = useTranslations("admin.complexes.layouts");
  return (
    <div className="layout-row__end">
      <RowBadges row={row} hasUnits={hasUnits} variant={variant} />
      <button type="button" className="layout-row__icon" aria-label={t("duplicate")} onClick={onDuplicate}>
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

function RowBadges({ row, hasUnits, variant }: Pick<LayoutRowProps, "row" | "hasUnits" | "variant">) {
  const t = useTranslations("admin.complexes.layouts");
  const priced = hasUnits ? row.offer?.priceFrom != null : Boolean(row.priceFrom.trim());
  return (
    <span className="layout-row__badges">
      {row.drawingSrc ? null : (
        <Badge tone="amber" size="sm">
          {t("noDrawing")}
        </Badge>
      )}
      {priced ? null : <Badge size="sm">{t("noPrice")}</Badge>}
      {/* Двойник (те же комнаты и площадь) — тот же «вариант N», что в списках «Квартир». */}
      {variant ? <Badge size="sm">{t("variant", { n: variant })}</Badge> : null}
      {/* «Нет в наличии» ставят на «Квартирах» (Н7) — здесь только видно, почему сайт так пишет. */}
      {!hasUnits && !row.available ? (
        <span title={t("unavailableHint")}>
          <Badge tone="bad" size="sm">
            {t("unavailable")}
          </Badge>
        </span>
      ) : null}
    </span>
  );
}
