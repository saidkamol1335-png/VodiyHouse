"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useUnitsNotice } from "@/components/UnitsNotice";
import {
  generatorDefaults,
  generatorIssues,
  generatorPlan,
  samePlanShape,
  type GeneratorInputs,
} from "@/lib/admin/units/generator";
import type {
  CreateBlockUnitsInput,
  CreateBlockUnitsResult,
  UnitsAction,
} from "@/lib/admin/units/types";
import {
  defaultRisers,
  fitRisersToPlan,
  summarizeBlockPlan,
  validateBlockPlan,
  validateRisers,
  type BlockPlan,
  type Riser,
} from "@/lib/units";
import { useUnsavedGuard } from "@/lib/ui/useUnsavedGuard";

type GeneratorOptions = {
  blockId: string;
  floors: number;
  action: UnitsAction<CreateBlockUnitsInput, CreateBlockUnitsResult>;
};

type Draft = { inputs: GeneratorInputs; risers: Riser[]; fittedTo: BlockPlan };

function initialDraft(floors: number): Draft {
  const inputs = generatorDefaults(floors);
  const plan = generatorPlan(inputs, floors);
  return { inputs, risers: defaultRisers(plan), fittedTo: plan };
}

/**
 * Поля и стояки — черновик. Стояки подгоняются под план только при смене его формы (подъезды,
 * этажи, квартир на этаже), и то, пока план верный: правку этажа в стояке ничто не трогает.
 */
export function useGenerator({ blockId, floors, action }: GeneratorOptions) {
  const t = useTranslations("admin.complexes.units.generator");
  const [draft, setDraft] = useState(() => initialDraft(floors));
  const [result, setResult] = useState<CreateBlockUnitsResult | null>(null);
  const [pending, startTransition] = useTransition();
  const guard = useUnsavedGuard(t("unsaved"));
  const notify = useUnitsNotice();
  const plan = generatorPlan(draft.inputs, floors);
  const summary = summarizeBlockPlan(plan);
  const touched = () => {
    setResult(null);
    guard.onInput();
  };
  const setInputs = (inputs: GeneratorInputs) => {
    const next = generatorPlan(inputs, floors);
    const refit = summarizeBlockPlan(next) !== null && !samePlanShape(next, draft.fittedTo);
    setDraft(
      refit
        ? { inputs, risers: fitRisersToPlan(draft.risers, next, draft.fittedTo), fittedTo: next }
        : { ...draft, inputs },
    );
    touched();
  };
  const setRisers = (risers: Riser[]) => {
    setDraft({ ...draft, risers });
    touched();
  };
  const create = () =>
    startTransition(async () => {
      const next = await action({ blockId, plan, risers: draft.risers });
      setResult(next);
      if (next.status !== "done") return;
      guard.reset();
      notify({ blockId, created: next.created, unassigned: next.unassigned });
    });
  const ready = summary !== null && validateRisers(plan, draft.risers).length === 0;
  const issues = generatorIssues(validateBlockPlan(plan));
  return { ...draft, plan, summary, issues, ready, result, pending, setInputs, setRisers, create };
}
