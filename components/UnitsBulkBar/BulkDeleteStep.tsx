"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { ComplexSaveFeedback } from "@/components/ComplexSaveFeedback";
import { hiddenCount } from "@/lib/admin/units/selection";
import { useEditRequest } from "@/lib/admin/units/useEditRequest";
import { useRefocusAfter } from "@/lib/ui/useRefocus";
import type { UnitRecord } from "@/lib/units";
import type { BulkStepProps } from "./BulkSteps";

const SHOWN_NUMBERS = 20;

/** «41, 42, 43 и ещё 7» — номера брони и продаж в вопросе. */
function numbersLine(units: readonly UnitRecord[], more: (count: number) => string) {
  const numbers = units
    .slice(0, SHOWN_NUMBERS)
    .map((unit) => unit.number)
    .join(", ");
  return units.length > SHOWN_NUMBERS
    ? `${numbers} ${more(units.length - SHOWN_NUMBERS)}`
    : numbers;
}

/**
 * «Удалить N квартир?» с бронями и продажами по номерам, скрытыми фильтром и тем, что сайт их
 * больше не покажет. Весь список так не удаляется — для него «Удалить список блока».
 */
export function BulkDeleteStep(props: BulkStepProps) {
  const t = useTranslations("admin.complexes.units.bulk.remove");
  const { selection, total, onToWhole, onDone } = props;
  const units = selection.selected;
  if (units.length >= total) {
    return (
      <div className="units-bulk__form">
        <p className="units-bulk__warning">{t("whole")}</p>
        <Button variant="ghost" onClick={onToWhole}>
          {t("toWhole")}
        </Button>
      </div>
    );
  }
  return <DeleteQuestion {...props} units={units} onCancel={onDone} />;
}

function DeleteQuestion({
  units,
  visible,
  edit,
  published,
  selection,
  onCancel,
}: BulkStepProps & { units: readonly UnitRecord[]; onCancel: () => void }) {
  const t = useTranslations("admin.complexes.units.bulk.remove");
  const { reply, pending, send, here } = useEditRequest();
  const yes = useRefocusAfter(pending);
  const remove = async () => {
    if (!edit) return;
    if (await send((shown) => edit.removeUnits(units, shown))) return;
    // Снимаются только удалённые: выбранное, пока шёл запрос, остаётся. Шаг закрывается раньше
    // (фокус — на кнопку шага, в панели); ушла и панель — фокус на сводку переставит она сама.
    if (here()) onCancel();
    selection.setMany(units, false);
  };
  return (
    <div
      className="units-bulk__form"
      role="group"
      aria-label={t("question", { count: units.length })}
    >
      <p className="units-bulk__question">{t("question", { count: units.length })}</p>
      <DeleteWarnings units={units} visible={visible} published={published} />
      {reply ? <ComplexSaveFeedback state={reply} /> : null}
      <div className="units-bulk__buttons">
        <Button variant="ghost" onClick={onCancel}>
          {t("no")}
        </Button>
        <Button ref={yes} variant="danger" pending={pending} onClick={() => void remove()}>
          {t("yes")}
        </Button>
      </div>
    </div>
  );
}

type DeleteWarningsProps = {
  units: readonly UnitRecord[];
  visible: readonly UnitRecord[];
  published: boolean;
};

/** Брони и продажи по номерам, скрытые фильтром и «сайт их больше не покажет». */
function DeleteWarnings({ units, visible, published }: DeleteWarningsProps) {
  const t = useTranslations("admin.complexes.units.bulk.remove");
  const more = (count: number) => t("more", { count });
  const reserved = units.filter((unit) => unit.status === "reserved");
  const sold = units.filter((unit) => unit.status === "sold");
  const hidden = hiddenCount(units, visible);
  return (
    <>
      {reserved.length > 0 ? (
        <p className="units-bulk__warning">
          {t("reserved", { numbers: numbersLine(reserved, more) })}
        </p>
      ) : null}
      {sold.length > 0 ? (
        <p className="units-bulk__warning">{t("sold", { numbers: numbersLine(sold, more) })}</p>
      ) : null}
      {hidden > 0 ? <p className="units-bulk__note">{t("hiddenPart", { count: hidden })}</p> : null}
      <p className="units-bulk__note">
        {published ? `${t("published")} ${t("noUndo")}` : t("noUndo")}
      </p>
    </>
  );
}
