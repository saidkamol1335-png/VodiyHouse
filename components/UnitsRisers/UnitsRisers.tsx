"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { ComplexSaveFeedback } from "@/components/ComplexSaveFeedback";
import { FormStatus } from "@/components/FormStatus";
import { RisersEditor } from "@/components/RisersEditor";
import type {
  ReadyBlockView,
  SaveRisersInput,
  SaveRisersResult,
  UnitsAction,
  UnitsLayout,
} from "@/lib/admin/units/types";
import { unitsFailure } from "@/lib/admin/units/errors";
import { settle } from "@/lib/ui/settle";
import { uncoveredSlots, validateRisers, type Riser } from "@/lib/units";
import { useUnsavedGuard } from "@/lib/ui/useUnsavedGuard";

type UnitsRisersProps = {
  blockId: string;
  ready: ReadyBlockView;
  layouts: readonly UnitsLayout[];
  action: UnitsAction<SaveRisersInput, SaveRisersResult>;
  /** После сохранения: список перечитывается — стояки собираются из него (12.4). */
  onSaved: () => Promise<boolean>;
};

/** Стояки готового блока (Н5, Н6): свёрнуты над списком; правка меняет планировку квартир. */
export function UnitsRisers({ blockId, ready, layouts, action, onSaved }: UnitsRisersProps) {
  const t = useTranslations("admin.complexes.units.risers");
  const [open, setOpen] = useState(false);
  const draft = useRisersDraft(blockId, ready, action, onSaved);
  const bodyId = `${blockId}-risers`;
  return (
    <section className={open ? "units-risers units-risers--open" : "units-risers"}>
      <button
        type="button"
        className="units-risers__toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
      >
        {t("toggle", { count: draft.shown.length })}
        <ChevronDown className="units-risers__chevron" aria-hidden="true" size={18} />
      </button>
      <div id={bodyId} className="units-risers__body" hidden={!open}>
        <p className="units-risers__lead">{t("lead")}</p>
        <RisersEditor
          idPrefix={bodyId}
          plan={ready.plan}
          risers={draft.shown}
          layouts={layouts}
          onChange={draft.edit}
        />
        {draft.dirty && draft.uncovered > 0 ? (
          <p className="units-risers__warning">{t("uncovered", { count: draft.uncovered })}</p>
        ) : null}
        <div className="units-risers__actions">
          <RisersFeedback result={draft.result} />
          {draft.dirty ? (
            <Button variant="ghost" onClick={draft.reset}>
              {t("reset")}
            </Button>
          ) : null}
          <Button
            pending={draft.pending}
            disabled={!draft.dirty || !draft.valid}
            onClick={draft.save}
          >
            {draft.pending ? t("saving") : t("save")}
          </Button>
        </div>
      </div>
    </section>
  );
}

type Draft = { base: readonly Riser[]; risers: Riser[] };
/** Сохранённые стояки — пока список не перечитан (against — стояки списка на момент сохранения). */
type Saved = { risers: readonly Riser[]; against: ReadyBlockView };

/**
 * Правка по снимку («Решения 12.2»): base — стояки, от которых начали, сервер меняет только
 * квартиры, где стояк поменялся, и не трогает поправленные после снимка.
 */
function useRisersDraft(
  blockId: string,
  ready: ReadyBlockView,
  action: UnitsAction<SaveRisersInput, SaveRisersResult>,
  onSaved: () => Promise<boolean>,
) {
  const t = useTranslations("admin.complexes.units.risers");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [result, setResult] = useState<SaveRisersResult | null>(null);
  const [pending, startTransition] = useTransition();
  const guard = useUnsavedGuard(t("unsaved"));
  const { current, markSaved } = useSavedRisers(ready);
  const shown = draft?.risers ?? current;
  const edit = (risers: Riser[]) => {
    setDraft({ base: draft?.base ?? current, risers });
    setResult(null);
    guard.onInput();
  };
  const reset = () => {
    setDraft(null);
    setResult(null);
    guard.reset();
  };
  const save = () => {
    if (!draft) return;
    startTransition(async () => {
      const input = { blockId, base: draft.base, risers: draft.risers };
      const next = await settle(() => action(input), unitsFailure("network"));
      setResult(next);
      if (next.status !== "done") return;
      markSaved(draft.risers);
      setDraft(null);
      guard.reset();
      // Не ждём внутри перехода: иначе навигация кабинета стояла бы, пока читаются 5000 строк.
      void onSaved();
    });
  };
  const valid = validateRisers(ready.plan, shown).length === 0;
  const uncovered = uncoveredSlots(ready.plan, shown);
  return { shown, dirty: draft !== null, valid, uncovered, result, pending, edit, reset, save };
}

/**
 * Пока список не перечитан (или чтение не удалось), правда — сохранённое, а не прежний список:
 * иначе мелькнули бы прежние стояки, а новая правка ушла бы со старым снимком.
 */
function useSavedRisers(ready: ReadyBlockView) {
  const [saved, setSaved] = useState<Saved | null>(null);
  const current = saved && saved.against === ready ? saved.risers : ready.risers;
  const markSaved = (risers: readonly Riser[]) => setSaved({ risers, against: ready });
  return { current, markSaved };
}

function RisersFeedback({ result }: { result: SaveRisersResult | null }) {
  const t = useTranslations("admin.complexes.units.risers");
  if (result === null) return null;
  if (result.status === "error") return <ComplexSaveFeedback state={result} />;
  return (
    <>
      <FormStatus tone={result.changed > 0 ? "success" : "notice"}>
        {result.changed > 0 ? t("saved", { count: result.changed }) : t("nothing")}
      </FormStatus>
      {result.skipped.length > 0 ? (
        <FormStatus tone="notice">
          {t("skipped", { numbers: result.skipped.join(", ") })}
        </FormStatus>
      ) : null}
    </>
  );
}
