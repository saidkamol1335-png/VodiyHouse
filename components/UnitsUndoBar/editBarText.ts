import type { EditMessage } from "@/lib/admin/units/editOutcome";
import { subjectText, type BarText, type BarTexts } from "./barText";

// Итог правок руководителя в полосе (12.5): строка, «+ Квартира», цена, отделка, удаление.

function failedText(
  texts: BarTexts,
  message: Extract<EditMessage, { kind: "editFailed" }>,
): BarText {
  const title = texts.bar("editFailed", {
    what: message.what,
    number: message.subject.number ?? "",
    subject: subjectText(texts, message.subject, true),
  });
  if (message.broken.length > 0) {
    const missing = message.broken.map((item) => texts.complexes(`status.missing.${item}`));
    return { title, detail: `${texts.complexes("brokenLead")} ${missing.join(" · ")}` };
  }
  // Ответ мог потеряться уже после записи: список перечитан — проверить глазами.
  if (message.error === "network") return { title, detail: texts.bar("networkEdit") };
  return { title, detail: texts.errors(message.error) };
}

function pricedText(texts: BarTexts, message: Extract<EditMessage, { kind: "priced" }>): BarText {
  const { bar } = texts;
  const title =
    message.changed === 0
      ? bar("pricedSame")
      : bar(message.none ? "pricedNone" : "priced", { count: message.changed });
  const detail =
    message.withoutLayout > 0 ? bar("withoutLayout", { count: message.withoutLayout }) : null;
  return { title, detail };
}

export function editBarText(texts: BarTexts, message: EditMessage): BarText {
  const { bar } = texts;
  switch (message.kind) {
    case "rowSaved":
      return { title: bar("rowSaved", { number: message.number }), detail: null };
    case "added":
      return { title: bar("added", { number: message.number }), detail: null };
    case "priced":
      return pricedText(texts, message);
    case "finished": {
      const title =
        message.changed === 0 ? bar("finishedSame") : bar("finished", { count: message.changed });
      return { title, detail: null };
    }
    case "deleted":
      return { title: bar("deleted", { count: message.count }), detail: null };
    case "rowGone":
      return { title: bar("rowGone", { number: message.number }), detail: null };
    case "editFailed":
      return failedText(texts, message);
  }
}
