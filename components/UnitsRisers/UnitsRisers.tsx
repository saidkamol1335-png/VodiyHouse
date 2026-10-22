"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useEffect, useRef, useState, useTransition } from "react";
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
  /** Номер чтения списка: сохранённые стояки — правда только до следующего чтения. */
  reads: number;
  layouts: readonly UnitsLayout[];
  action: UnitsAction<SaveRisersInput, SaveRisersResult>;
  /** После сохранения: список перечитывается — стояки собираются из него (12.4). */
  onSaved: () => Promise<boolean>;
};

/** Стояки готового блока (Н5, Н6): свёрнуты над списком; правка меняет планировку квартир. */
// memo: фильтр списка живёт у блока, и без него «Стояки» перерисовывались бы на каждую букву поиска.
export const UnitsRisers = memo(function UnitsRisers({
  blockId,
  ready,
  reads,
  layouts,
  action,
  onSaved,
}: UnitsRisersProps) {
  const t = useTranslations("admin.complexes.units.risers");
  const [open, setOpen] = useState(false);
  const draft = useRisersDraft({ blockId, ready, reads, action, onSaved });
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
        <RisersActions draft={draft} />
      </div>
    </section>
  );
});

function RisersActions({ draft }: { draft: ReturnType<typeof useRisersDraft> }) {
  const t = useTranslations("admin.complexes.units.risers");
  return (
    <div className="units-risers__actions">
      <RisersFeedback result={draft.result} />
      {draft.dirty ? (
        <Button variant="ghost" onClick={draft.reset}>
          {t("reset")}
        </Button>
      ) : null}
      <Button pending={draft.pending} disabled={!draft.dirty || !draft.valid} onClick={draft.save}>
        {draft.pending ? t("saving") : t("save")}
      </Button>
    </div>
  );
}

type Draft = { base: readonly Riser[]; risers: Riser[] };
/** Сохранённые стояки — пока список не перечитан (against — стояки списка на момент сохранения). */
type Saved = { risers: readonly Riser[]; against: ReadyBlockView; reads: number };

/**
 * Правка по снимку («Решения 12.2»): base — стояки, от которых начали, сервер меняет только
 * квартиры, где стояк поменялся, и не трогает поправленные после снимка.
 */
function useRisersDraft({
  blockId,
  ready,
  reads,
  action,
  onSaved,
}: Omit<UnitsRisersProps, "layouts">) {
  const t = useTranslations("admin.complexes.units.risers");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [result, setResult] = useState<SaveRisersResult | null>(null);
  const [pending, startTransition] = useTransition();
  const guard = useUnsavedGuard(t("unsaved"));
  const { current, markSaved } = useSavedRisers(ready, reads);
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
 * иначе мелькнули бы прежние стояки, а новая правка ушла бы со старым снимком. Новое чтение или
 * другие места квартир — правда снова список: снимок стояков (ReadyCache) при неизменных местах
 * тот же, и по одному ему сохранённое держалось бы и после чтения.
 */
function useSavedRisers(ready: ReadyBlockView, reads: number) {
  const [saved, setSaved] = useState<Saved | null>(null);
  // Снимок и номер чтения — на момент ответа сохранения, а не нажатия: чтение, пришедшее, пока
  // шло сохранение, не должно сбросить только что сохранённое.
  const now = useRef({ ready, reads });
  useEffect(() => {
    now.current = { ready, reads };
  });
  const fresh = saved && saved.against === ready && saved.reads === reads;
  const current = fresh ? saved.risers : ready.risers;
  const markSaved = (risers: readonly Riser[]) =>
    setSaved({ risers, against: now.current.ready, reads: now.current.reads });
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
