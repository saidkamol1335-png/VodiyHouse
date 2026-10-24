"use client";

import { type Ref, useState, useTransition } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import type { ProgramsT } from "@/components/ProgramCard/cardText";
import {
  NETWORK_FAILURE,
  type ProgramActionResult,
  type ProgramActions,
  type RateSetting,
} from "@/lib/admin/programs/types";
import { formatDate, formatRate } from "@/lib/format";
import { settle } from "@/lib/ui/settle";
import { useSwapFocus } from "@/lib/ui/useSwapFocus";
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
      const result = await settle(action, NETWORK_FAILURE);
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
  return { error, pending, run, reset: () => setError(undefined) };
}

type FixRateFormProps = {
  error: string | undefined;
  pending: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
  t: ProgramsT;
};

/** «Зафиксировать курс»: поле на месте строки (фокус сразу в нём), «Сохранить / Отмена». */
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
        autoFocus
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

/**
 * Кнопки курса и формы на их месте. Пока запрос идёт, отменить и открыть другое нельзя — иначе
 * поздний ответ закрыл бы форму, открытую уже после него. После формы фокус — на «Зафиксировать».
 */
function RateControls({ state, actions, t }: ProgramRateProps & { actions: RateActions }) {
  const [mode, setMode] = useState<Mode>("idle");
  const { error, pending, run, reset } = useRateRun(state, t, () => setMode("idle"));
  const { trigger, target } = useSwapFocus(mode !== "idle");
  const go = (next: Mode) => {
    reset();
    setMode(next);
  };
  const manual = (fields: Record<string, string>, done: string) =>
    run(() => actions.setManualRate(formOf(fields)), done);
  if (mode === "fix") {
    const save = (rate: string) => manual({ rate }, t("rate.saved"));
    return (
      <FixRateForm
        error={error}
        pending={pending}
        onSave={save}
        onCancel={() => go("idle")}
        t={t}
      />
    );
  }
  if (mode === "return") {
    const yes = () => manual({ clear: "1" }, t("rate.returned"));
    return (
      <ReturnConfirm pending={pending} yesRef={target} onYes={yes} onNo={() => go("idle")} t={t} />
    );
  }
  const refresh = () => run(() => actions.refreshCbuRate(new FormData()), t("rate.refreshed"));
  return (
    <RateButtons
      manual={Boolean(state.rate.manual)}
      pending={pending}
      fixRef={trigger}
      onMode={go}
      onRefresh={refresh}
      t={t}
    />
  );
}

type ReturnConfirmProps = {
  pending: boolean;
  yesRef: Ref<HTMLButtonElement>;
  onYes: () => void;
  onNo: () => void;
  t: ProgramsT;
};

/** «Вернуть курс ЦБ?» — «Да / Отмена» на месте кнопок; фокус сразу на «Да». */
function ReturnConfirm({ pending, yesRef, onYes, onNo, t }: ReturnConfirmProps) {
  return (
    <div className="program-rate__form" role="group" aria-label={t("rate.returnConfirm")}>
      <span>{t("rate.returnConfirm")}</span>
      <RateFormButtons
        pending={pending}
        yesRef={yesRef}
        onYes={onYes}
        onNo={onNo}
        labels={[t("rate.yes"), t("rate.no")]}
      />
    </div>
  );
}

type RateFormButtonsProps = {
  pending: boolean;
  yesRef?: Ref<HTMLButtonElement>;
  onYes: () => void;
  onNo: () => void;
  labels: readonly [string, string];
};

function RateFormButtons({ pending, yesRef, onYes, onNo, labels }: RateFormButtonsProps) {
  return (
    <>
      <Button ref={yesRef} size="sm" pending={pending} onClick={onYes}>
        {labels[0]}
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={onNo}>
        {labels[1]}
      </Button>
    </>
  );
}

type RateButtonsProps = {
  manual: boolean;
  pending: boolean;
  fixRef: Ref<HTMLButtonElement>;
  onMode: (mode: Mode) => void;
  onRefresh: () => void;
  t: ProgramsT;
};

function RateButtons({ manual, pending, fixRef, onMode, onRefresh, t }: RateButtonsProps) {
  return (
    <div className="program-rate__buttons">
      <Button
        ref={fixRef}
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => onMode("fix")}
      >
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
