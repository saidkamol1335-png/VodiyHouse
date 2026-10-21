import type { useTranslations } from "next-intl";
import type { StatusMessage, StatusSubject } from "@/lib/admin/units/statusOutcome";

// Текст полосы статуса из исхода (lib/admin/units/statusOutcome): заголовок и строка пояснения.

type BarT = ReturnType<typeof useTranslations<"admin.complexes.units.list.bar">>;
type StatusT = ReturnType<typeof useTranslations<"admin.journal.unitStatus">>;
type ErrorT = ReturnType<typeof useTranslations<"admin.developers.errors">>;

export type BarTexts = { bar: BarT; status: StatusT; errors: ErrorT };

export type BarText = { title: string; detail: string | null };

function subjectOf({ bar }: BarTexts, subject: StatusSubject, inner = false) {
  if (subject.number === null) return bar("many", { count: subject.count });
  return bar(inner ? "oneInner" : "one", { number: subject.number });
}

type ChangeMessage = Extract<StatusMessage, { kind: "saving" | "changed" }>;

function changeText(texts: BarTexts, message: ChangeMessage) {
  const subject = subjectOf(texts, message.subject);
  const to = texts.status(message.to);
  if (message.from === null) return texts.bar("changedTo", { subject, to });
  return texts.bar("changed", { subject, from: texts.status(message.from), to });
}

function racedText(texts: BarTexts, message: Extract<StatusMessage, { kind: "raced" }>) {
  const subject = subjectOf(texts, message.subject);
  if (message.was === null) return texts.bar("racedMixed", { subject });
  return texts.bar("raced", { subject, was: texts.status(message.was) });
}

function revertedText(texts: BarTexts, message: Extract<StatusMessage, { kind: "reverted" }>) {
  const subject = subjectOf(texts, message.subject, true);
  if (message.to === null) return texts.bar("revertedMixed", { subject });
  return texts.bar("reverted", { subject, to: texts.status(message.to) });
}

function partialText(texts: BarTexts, message: Extract<StatusMessage, { kind: "revertPartial" }>) {
  const { bar } = texts;
  const skipped =
    message.skipped.length > 0 ? bar("skipped", { numbers: message.skipped.join(", ") }) : null;
  const missing = message.missing > 0 ? bar("missing", { count: message.missing }) : null;
  return { title: skipped ?? missing ?? bar("nothing"), detail: skipped ? missing : null };
}

export function barText(texts: BarTexts, message: StatusMessage): BarText {
  const { bar, status, errors } = texts;
  const only = (title: string): BarText => ({ title, detail: null });
  switch (message.kind) {
    case "saving":
      return { title: changeText(texts, message), detail: bar("saving") };
    case "changed":
      return only(changeText(texts, message));
    case "raced":
      return only(racedText(texts, message));
    case "same": {
      const values = { subject: subjectOf(texts, message.subject), to: status(message.to) };
      return only(message.raced ? bar("sameRaced", values) : bar("same", values));
    }
    case "failed":
      return {
        title: bar("failed", { subject: subjectOf(texts, message.subject, true) }),
        detail: errors(message.error),
      };
    case "reverting":
      return { title: subjectOf(texts, message.subject), detail: bar("reverting") };
    case "reverted":
      return only(revertedText(texts, message));
    case "revertPartial":
      return partialText(texts, message);
    case "nothing":
      return only(bar("nothing"));
    case "revertFailed":
      return {
        title: bar("revertFailed", { subject: subjectOf(texts, message.subject, true) }),
        detail: errors(message.error),
      };
  }
}
