"use client";

import { useTranslations } from "next-intl";
import { useCallback, useId } from "react";
import { Segmented, segmentedItemClass } from "@/components/Segmented";
import { useUnitsNotice } from "@/components/UnitsNotice";
import type {
  ChangedResult,
  SetLayoutAvailableInput,
  UnitsAction,
  UnitsBlock,
  UnitsLayout,
} from "@/lib/admin/units/types";
import {
  useLayoutAvailability,
  type StaleAvailability,
} from "@/lib/admin/units/useLayoutAvailability";
import { formatArea, formatPrice } from "@/lib/format";

type UnitsAvailabilityProps = {
  block: Pick<UnitsBlock, "id" | "currency">;
  layouts: readonly UnitsLayout[];
  action: UnitsAction<SetLayoutAvailableInput, ChangedResult>;
};

type Translate = ReturnType<typeof useTranslations<"admin.complexes.units">>;
type Control = ReturnType<typeof useLayoutAvailability>;

/**
 * «Наличие по планировкам» (Н7): у блока без списка квартир сайт знает только «есть / нет в
 * наличии» по типу — его меняют руководитель и менеджер, одним тапом, сразу в базу.
 */
export function UnitsAvailability({ block, layouts, action }: UnitsAvailabilityProps) {
  const t = useTranslations("admin.complexes.units");
  const titleId = useId();
  const setNotice = useUnitsNotice();
  const onStale = useCallback(
    (reason: StaleAvailability) => setNotice({ kind: "stale", blockId: block.id, reason }),
    [block.id, setNotice],
  );
  const control = useLayoutAvailability(layouts, action, onStale);
  const describe = (layout: UnitsLayout) => describeLayout(layout, block.currency, t);
  return (
    <section className="units-availability" aria-labelledby={titleId}>
      <h3 id={titleId} className="units-availability__title">
        {t("availability.title")}
      </h3>
      <p className="units-availability__lead">{t("availability.lead")}</p>
      {layouts.length === 0 ? (
        <p className="units-availability__empty">{t("availability.empty")}</p>
      ) : (
        <ul className="units-availability__rows">
          {layouts.map((layout) => (
            <AvailabilityRow
              key={layout.id}
              layout={layout}
              text={describe(layout)}
              control={control}
            />
          ))}
        </ul>
      )}
      <SavedStatus layouts={layouts} last={control.state.last} describe={describe} />
    </section>
  );
}

type LayoutText = { name: string; price: string };

/** Цена — и в имени группы, и в «Сохранено»: у двух планировок бывают одинаковые комнаты и площадь. */
function describeLayout(
  layout: UnitsLayout,
  currency: UnitsBlock["currency"],
  t: Translate,
): LayoutText {
  return {
    name: t("layoutLabel", { rooms: layout.rooms, area: formatArea(layout.area) }),
    price:
      layout.priceFrom === null
        ? t("availability.priceNone")
        : t("availability.priceFrom", { price: formatPrice(layout.priceFrom, currency) }),
  };
}

type SavedStatusProps = {
  layouts: readonly UnitsLayout[];
  last: Control["state"]["last"];
  describe: (layout: UnitsLayout) => LayoutText;
};

/** Для диктора — что сохранилось последним (отказ он услышит из строки: role=alert). */
function SavedStatus({ layouts, last, describe }: SavedStatusProps) {
  const t = useTranslations("admin.complexes.units");
  const layout = last ? layouts.find((item) => item.id === last.layoutId) : undefined;
  return (
    <p className="sr-only" role="status">
      {last && layout
        ? t("availability.saved", {
            layout: describe(layout).name,
            price: describe(layout).price,
            value: t(last.available ? "availability.available" : "availability.unavailable"),
          })
        : ""}
    </p>
  );
}

const rowClass = (busy: boolean) =>
  busy ? "units-availability__row units-availability__row--busy" : "units-availability__row";

/** Вид варианта сегмента + свой элемент: «доступна» — on, «нет в наличии» — off. */
function optionClass(active: boolean, available: boolean): string {
  const tone = available ? "units-availability__option--on" : "units-availability__option--off";
  return `${segmentedItemClass(active)} units-availability__option ${tone}`;
}

type AvailabilityRowProps = { layout: UnitsLayout; text: LayoutText; control: Control };

function AvailabilityRow({ layout, text, control }: AvailabilityRowProps) {
  const t = useTranslations("admin.complexes.units.availability");
  const tErrors = useTranslations("admin.developers.errors");
  const errorId = useId();
  const busy = layout.id in control.state.pending;
  const error = control.state.errors[layout.id];
  return (
    <li className={rowClass(busy)} aria-busy={busy || undefined}>
      <span className="units-availability__name">{text.name}</span>
      <span className="units-availability__price">{text.price}</span>
      <AvailabilityOptions
        layout={layout}
        text={text}
        control={control}
        describedBy={error ? errorId : undefined}
      />
      {error ? (
        <p id={errorId} className="units-availability__error" role="alert">
          {/* Н7 — право и менеджера: «только руководитель» ввело бы его в заблуждение. */}
          {error === "forbidden" ? t("forbidden") : tErrors(error)}
        </p>
      ) : null}
    </li>
  );
}

type AvailabilityOptionsProps = AvailabilityRowProps & { describedBy: string | undefined };

/** «Доступна | Нет в наличии»; выбранный окрашен (тоны Badge) — по aria-pressed. */
function AvailabilityOptions({ layout, text, control, describedBy }: AvailabilityOptionsProps) {
  const t = useTranslations("admin.complexes.units");
  const value = control.valueOf(layout);
  const busy = layout.id in control.state.pending;
  return (
    <Segmented
      label={t("availability.label", { layout: text.name, price: text.price })}
      className="units-availability__switch"
    >
      {([true, false] as const).map((option) => (
        <button
          key={String(option)}
          type="button"
          className={optionClass(value === option, option)}
          aria-pressed={value === option}
          aria-disabled={busy || undefined}
          aria-describedby={describedBy}
          onClick={() => {
            if (!busy && value !== option) void control.change(layout, option);
          }}
        >
          {t(option ? "availability.available" : "availability.unavailable")}
        </button>
      ))}
    </Segmented>
  );
}
