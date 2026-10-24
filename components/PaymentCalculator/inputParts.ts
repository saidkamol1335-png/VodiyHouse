import type { CalcDownChip } from "@/components/CalcDown";
import type { CalcProgramChoice } from "@/components/CalcPrograms";
import type { CalcTermButton, CalcTermMessage } from "@/components/CalcTerm";
import type { CalcParams } from "@/lib/calc/params";
import type { DownOption, ProgramOption } from "@/lib/calc/options";
import type { CalcStock } from "@/lib/calc/priceSource";
import { type CalcProgram, isTiered } from "@/lib/calc/programs";
import { type TermOutcome, tierIndexFor } from "@/lib/calc/terms";
import type { CalcView } from "@/lib/calc/view";
import { formatPercent, initialsOf } from "@/lib/format";
import {
  type CalcLocale,
  type CalcT,
  blocksNote,
  programNote,
  programTitle,
  termText,
} from "./calcText";

// Что показывают поля калькулятора: карточки программ, чипы взноса, кнопки срока и строка
// превышения — из состояния (lib/calc/view). Кабинет дописывает своё (скидки) через extras.

export type CalcExtras<P extends CalcProgram> = {
  /** «· скидка 12%» к условиям программы — только кабинет. */
  programSuffix?: (option: ProgramOption<P>, options: readonly ProgramOption<P>[]) => string | null;
  /** «→ −6%» у чипа взноса — только кабинет. */
  downBadge?: (
    option: ProgramOption<P>,
    down: DownOption,
    options: readonly ProgramOption<P>[],
  ) => string | null;
  /** Заголовок ряда чипов: кабинет — «Скидка за первый взнос». */
  downTitle?: string;
};

type Patch = (patch: Partial<CalcParams>) => void;

/** После перерисовки: то, на чём был фокус, исчезло — ставим его на то, что пришло на смену. */
export function focusLater(selector: string) {
  requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus());
}

export function programChoices<P extends CalcProgram>(
  view: CalcView<P>,
  stock: CalcStock,
  context: { developerName: string; t: CalcT; locale: CalcLocale; extras: CalcExtras<P> },
): CalcProgramChoice[] {
  const { t, locale, extras } = context;
  return view.options.map((option) => {
    // Программы, что действуют для этой стоимости (блок квартиры), — не все у застройщика.
    const suffix = extras.programSuffix?.(option, view.options);
    const note = programNote(option, t);
    return {
      id: option.id,
      mark: initialsOf(option.bankName?.[locale] ?? context.developerName),
      title: programTitle(option, t, locale),
      subtitle: option.bankName ? t(`kinds.${option.kind}`) : null,
      note: suffix ? `${note} · ${suffix}` : note,
      place: blocksNote(option, stock, t, locale),
    };
  });
}

/** Чип активен: у схемы — ступень, куда попал взнос; у банка — тот же взнос. */
function chipActive(program: CalcProgram, down: DownOption, downPct: number): boolean {
  if (down.targetId !== null) return false;
  if (!isTiered(program)) return down.downPct === downPct;
  return program.tiers[tierIndexFor(program.tiers, downPct)]?.minDownPct === down.downPct;
}

export function downChips<P extends CalcProgram>(
  view: CalcView<P>,
  update: Patch,
  context: { t: CalcT; extras: CalcExtras<P> },
): CalcDownChip[] {
  const selected = view.selected;
  if (!selected) return [];
  const { t, extras } = context;
  return view.downOptions.map((down) => ({
    key: `${down.targetId ?? "down"}-${down.downPct}`,
    label: formatPercent(down.downPct),
    note: down.maxMonths
      ? t("down.upTo", { term: termText(down.maxMonths, t) })
      : down.targetId
        ? t("down.now")
        : null,
    badge: extras.downBadge?.(selected, down, view.options) ?? null,
    active: chipActive(selected.program, down, view.downPct),
    onPick: () => {
      if (!down.targetId) return update({ downPct: down.downPct, months: null });
      update({ program: down.targetId, months: null });
      // Чип исчез вместе со взносом (у «100% оплаты» его нет) — фокус на выбранную программу.
      focusLater(`input[type="radio"][value="${down.targetId}"]`);
    },
  }));
}

export function termButtonsOf<P extends CalcProgram>(
  view: CalcView<P>,
  t: CalcT,
): CalcTermButton[] {
  const program = view.selected?.program;
  if (!program || program.type === "full") return [];
  return view.termButtons.map((months) => {
    const rate = isTiered(program)
      ? 0
      : (program.terms.find((row) => row.months === months)?.ratePct ?? 0);
    const note = isTiered(program)
      ? t("term.scheme")
      : program.method === "markup"
        ? t("term.markup", { rate: formatPercent(rate) })
        : t("term.bank", { rate: formatPercent(rate) });
    return { months, label: termText(months, t), note };
  });
}

/** Строка под сроком (решение фазы 2): сверх максимума — block / suggest_tier / lead. */
export function termMessage(
  term: TermOutcome | null,
  downPct: number,
  update: Patch,
  t: CalcT,
): CalcTermMessage | null {
  if (!term) return null;
  const down = formatPercent(downPct);
  if (term.status === "belowMin")
    return { tone: "info", text: t("term.belowMin", { min: term.min }) };
  if (term.status !== "aboveMax") return null;
  if (term.behavior === "lead")
    return { tone: "warn", text: t("term.lead", { max: term.max, down }) };
  const suggestion = term.suggestion;
  if (term.behavior === "suggest_tier" && suggestion) {
    const from = formatPercent(suggestion.fromDownPct);
    const values = {
      months: suggestion.months,
      from,
      to: formatPercent(suggestion.toDownPct),
      max: term.max,
    };
    return {
      tone: "warn",
      text: t("term.suggest", values),
      action: {
        label: t("term.suggestButton", { from }),
        onClick: () => {
          update({ downPct: suggestion.fromDownPct, months: suggestion.months });
          // Строка с кнопкой исчезла — фокус на срок, который теперь посчитан.
          focusLater(".calc-term__button--active, .calc-term__input");
        },
      },
    };
  }
  return { tone: "warn", text: t("term.aboveMax", { down, max: term.max }) };
}
