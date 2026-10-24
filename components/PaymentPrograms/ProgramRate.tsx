"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import type { ProgramsT } from "@/components/ProgramCard/cardText";
import type { ProgramActionResult, ProgramActions, RateSetting } from "@/lib/admin/programs/types";
import { formatDate, formatRate } from "@/lib/format";
import { formOf, type ProgramsState } from "./useProgramsState";

type RateActions = Pick<ProgramActions, "setManualRate" | "refreshCbuRate">;
type RateResult = ProgramActionResult<RateSetting>;
type Mode = "idle" | "fix" | "return";

type ProgramRateProps = {
  state: ProgramsState;
  /** null — менеджер: строка курса без кнопок. */
  actions: RateActions | null;
  t: ProgramsT;
};

const dateOf = (iso: string) => formatDate(new Date(iso));

/** Строка курса мокапа (моно) и у руководителя — «Зафиксировать» / «Вернуть курс ЦБ» (Р6). */
export function ProgramRate({ state, actions, t }: ProgramRateProps) {
  return (
    <div className="program-rate" data-testid="program-rate">
      <RateLine rate={state.rate} t={t} />
      {actions ? <RateControls state={state} actions={actions} t={t} /> : null}
    </div>
  );
}

function RateLine({ rate, t }: { rate: RateSetting; t: ProgramsT }) {
  const part = rate.manual ?? rate.cbu;
  if (!part) return <p className="program-rate__none">{t("rate.none")}</p>;
  const values = { rate: formatRate(part.usdUzs), date: dateOf(part.date) };
  return (
    <p className="program-rate__line">
      {rate.manual ? t("rate.manual", values) : t("rate.cbu", values)}
      {rate.manual ? (
        <Badge tone="amber" size="sm">
          {t("rate.manualBadge")}
        </Badge>
      ) : null}
    </p>
  );
}

/** Действие курса: ответ — новый курс на экран и полоса; ошибка ввода — под полем. */
function useRateRun(state: ProgramsState, t: ProgramsT, onDone: () => void) {
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<RateResult>, done: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") {
        const issue = result.fieldErrors.rate as "required" | "number" | "range" | undefined;
        if (issue) return setError(t(`rate.issues.${issue}`));
        return state.failed(result);
      }
      state.setRate(result.payload);
      setError(undefined);
      onDone();
      state.notify("success", done);
    });
  return { error, pending, run };
}

type FixRateFormProps = {
  error: string | undefined;
  pending: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
  t: ProgramsT;
};

/** «Зафиксировать курс»: поле на месте строки, «Сохранить / Отмена». */
function FixRateForm({ error, pending, onSave, onCancel, t }: FixRateFormProps) {
  const [value, setValue] = useState("");
  return (
    <div className="program-rate__form">
      <Field
        id="program-rate-manual"
        label={t("rate.inputLabel")}
        inputMode="decimal"
        value={value}
        error={error}
        onChange={(event) => setValue(event.target.value)}
      />
      <RateFormButtons
        pending={pending}
        onYes={() => onSave(value)}
        onNo={onCancel}
        labels={[t("rate.save"), t("rate.cancel")]}
      />
    </div>
  );
}

function RateControls({ state, actions, t }: ProgramRateProps & { actions: RateActions }) {
  const [mode, setMode] = useState<Mode>("idle");
  const { error, pending, run } = useRateRun(state, t, () => setMode("idle"));
  const manual = (fields: Record<string, string>, done: string) =>
    run(() => actions.setManualRate(formOf(fields)), done);
  const back = () => setMode("idle");
  if (mode === "fix") {
    const save = (rate: string) => manual({ rate }, t("rate.saved"));
    return <FixRateForm error={error} pending={pending} onSave={save} onCancel={back} t={t} />;
  }
  if (mode === "return") {
    return (
      <div className="program-rate__form" role="group" aria-label={t("rate.returnConfirm")}>
        <span>{t("rate.returnConfirm")}</span>
        <RateFormButtons
          pending={pending}
          onYes={() => manual({ clear: "1" }, t("rate.returned"))}
          onNo={back}
          labels={[t("rate.yes"), t("rate.no")]}
        />
      </div>
    );
  }
  const refresh = () => run(() => actions.refreshCbuRate(new FormData()), t("rate.refreshed"));
  return (
    <RateButtons
      manual={Boolean(state.rate.manual)}
      pending={pending}
      onMode={setMode}
      onRefresh={refresh}
      t={t}
    />
  );
}

type RateFormButtonsProps = {
  pending: boolean;
  onYes: () => void;
  onNo: () => void;
  labels: readonly [string, string];
};

function RateFormButtons({ pending, onYes, onNo, labels }: RateFormButtonsProps) {
  return (
    <>
      <Button size="sm" pending={pending} onClick={onYes}>
        {labels[0]}
      </Button>
      <Button size="sm" variant="ghost" onClick={onNo}>
        {labels[1]}
      </Button>
    </>
  );
}

type RateButtonsProps = {
  manual: boolean;
  pending: boolean;
  onMode: (mode: Mode) => void;
  onRefresh: () => void;
  t: ProgramsT;
};

function RateButtons({ manual, pending, onMode, onRefresh, t }: RateButtonsProps) {
  return (
    <div className="program-rate__buttons">
      <Button size="sm" variant="ghost" onClick={() => onMode("fix")}>
        {t("rate.fix")}
      </Button>
      {manual ? (
        <Button size="sm" variant="ghost" onClick={() => onMode("return")}>
          {t("rate.returnCbu")}
        </Button>
      ) : (
        <Button size="sm" variant="ghost" pending={pending} onClick={onRefresh}>
          {t("rate.refresh")}
        </Button>
      )}
    </div>
  );
}
