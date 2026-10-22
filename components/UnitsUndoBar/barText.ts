import type { useTranslations } from "next-intl";
import type { BarMessage } from "@/lib/admin/units/bar";
import type { StatusMessage, StatusSubject } from "@/lib/admin/units/statusOutcome";
import { editBarText } from "./editBarText";

// Текст полосы из исхода (lib/admin/units/statusOutcome, editOutcome): заголовок и пояснение.

type BarT = ReturnType<typeof useTranslations<"admin.complexes.units.list.bar">>;
type StatusT = ReturnType<typeof useTranslations<"admin.journal.unitStatus">>;
type ErrorT = ReturnType<typeof useTranslations<"admin.developers.errors">>;
type MissingT = ReturnType<typeof useTranslations<"admin.complexes">>;

export type BarTexts = { bar: BarT; status: StatusT; errors: ErrorT; complexes: MissingT };

export type BarText = { title: string; detail: string | null };

export function subjectText({ bar }: BarTexts, subject: StatusSubject, inner = false) {
  if (subject.number === null) return bar("many", { count: subject.count });
  return bar(inner ? "oneInner" : "one", { number: subject.number });
}

type ChangeMessage = Extract<StatusMessage, { kind: "saving" | "changed" }>;

function changeText(texts: BarTexts, message: ChangeMessage) {
  const subject = subjectText(texts, message.subject);
  const to = texts.status(message.to);
  if (message.from === null) return texts.bar("changedTo", { subject, to });
  return texts.bar("changed", { subject, from: texts.status(message.from), to });
}

function racedText(texts: BarTexts, message: Extract<StatusMessage, { kind: "raced" }>) {
  const subject = subjectText(texts, message.subject);
  if (message.was === null) return texts.bar("racedMixed", { subject });
  return texts.bar("raced", { subject, was: texts.status(message.was) });
}

function revertedText(texts: BarTexts, message: Extract<StatusMessage, { kind: "reverted" }>) {
  const subject = subjectText(texts, message.subject, true);
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

export function barText(texts: BarTexts, message: BarMessage): BarText {
  return isStatusMessage(message) ? statusText(texts, message) : editBarText(texts, message);
}

const STATUS_KINDS: ReadonlySet<string> = new Set([
  "saving",
  "changed",
  "raced",
  "same",
  "failed",
  "reverting",
  "reverted",
  "revertPartial",
  "nothing",
  "revertFailed",
]);

const isStatusMessage = (message: BarMessage): message is StatusMessage =>
  STATUS_KINDS.has(message.kind);

function statusText(texts: BarTexts, message: StatusMessage): BarText {
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
      const values = { subject: subjectText(texts, message.subject), to: status(message.to) };
      return only(message.raced ? bar("sameRaced", values) : bar("same", values));
    }
    case "failed":
      return {
        title: bar("failed", { subject: subjectText(texts, message.subject, true) }),
        detail: errors(message.error),
      };
    case "reverting":
      return { title: subjectText(texts, message.subject), detail: bar("reverting") };
    case "reverted":
      return only(revertedText(texts, message));
    case "revertPartial":
      return partialText(texts, message);
    case "nothing":
      return only(bar("nothing"));
    case "revertFailed":
      return {
        title: bar("revertFailed", { subject: subjectText(texts, message.subject, true) }),
        detail: errors(message.error),
      };
  }
}
