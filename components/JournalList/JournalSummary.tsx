import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/Badge";
import type { UnitsSummary } from "@/lib/admin/journal/unitsSummary";
import type { UnitStatus } from "@/lib/units";

// Сводная запись о квартирах (шаг 12): одно действие — одна запись. Что сделано и сколько,
// номера, группы статусов; пометки — то, что требует внимания (без планировки, не тронуты).

/** Цвета статусов — как в мокапе: свободна — зелёный, бронь — янтарь, продана — розовый. */
const STATUS_TONES: Record<UnitStatus, BadgeTone> = { free: "ok", reserved: "amber", sold: "bad" };

type Of<K extends UnitsSummary["kind"]> = Extract<UnitsSummary, { kind: K }>;

export function JournalSummary({ summary }: { summary: UnitsSummary }) {
  switch (summary.kind) {
    case "create":
      return <CreateSummary summary={summary} />;
    case "status":
      return <StatusSummary summary={summary} />;
    case "price":
      return <PriceSummary summary={summary} />;
    case "finishing":
      // Какая отделка — в паре «Отделка White box» ниже; у одной квартиры номер уже в подписи.
      return summary.count === 1 ? null : (
        <Summary>
          <Line>
            <Amount summary={summary} />
          </Line>
        </Summary>
      );
    case "layouts":
      return <LayoutsSummary summary={summary} />;
    case "delete":
    case "delete_list":
      return <DeleteSummary summary={summary} />;
  }
}

function CreateSummary({ summary }: { summary: Of<"create"> }) {
  const t = useTranslations("admin.journal.summary");
  return (
    <Summary>
      <Line>
        {t("create", { count: summary.count })}{" "}
        {summary.count !== 1 ? <Numbers numbers={summary.numbers} /> : null}
      </Line>
      {summary.unassigned > 0 ? (
        <Note>{t("unassigned", { count: summary.unassigned })}</Note>
      ) : null}
    </Summary>
  );
}

function StatusSummary({ summary }: { summary: Of<"status"> }) {
  const t = useTranslations("admin.journal");
  return (
    <Summary>
      {summary.undo ? <Line>{t("summary.undo")}</Line> : null}
      <ul className="journal-list__groups">
        {summary.groups.map((group) => (
          <li key={`${group.from}-${group.to}`} className="journal-list__group">
            <StatusBadge status={group.from} /> {t("arrow")} <StatusBadge status={group.to} />
            <GroupCount summary={summary} group={group} />
          </li>
        ))}
      </ul>
      {summary.skipped > 0 ? <Note>{t("summary.skipped", { count: summary.skipped })}</Note> : null}
      {summary.missing > 0 ? <Note>{t("summary.missing", { count: summary.missing })}</Note> : null}
    </Summary>
  );
}

// Значение цены — в паре «Цена за м² $700/м²» ниже; здесь — сколько и какие, и «Цена снята».
function PriceSummary({ summary }: { summary: Of<"price"> }) {
  const t = useTranslations("admin.journal.summary");
  const removed = summary.mode === "none";
  const many = summary.count !== 1;
  if (!removed && !many && summary.withoutLayout === 0) return null;
  return (
    <Summary>
      {removed || many ? (
        <Line>
          {removed ? <span>{t("price", { mode: summary.mode })}</span> : null}
          <Amount summary={summary} />
        </Line>
      ) : null}
      {summary.withoutLayout > 0 ? (
        <Note>{t("withoutLayout", { count: summary.withoutLayout })}</Note>
      ) : null}
    </Summary>
  );
}

function LayoutsSummary({ summary }: { summary: Of<"layouts"> }) {
  const t = useTranslations("admin.journal.summary");
  return (
    <Summary>
      <Line>
        <span>{t("layouts")}</span>
        <Amount summary={summary} />
      </Line>
      {/* Одна цель — её показывает пара «Планировка было → стало». */}
      {summary.assigned.length > 1 ? (
        <ul className="journal-list__groups">
          {summary.assigned.map((group) => (
            <li key={group.layoutId ?? "none"} className="journal-list__group">
              <span>{group.label ?? t("noLayout")}</span>
              <GroupCount summary={summary} group={group} />
            </li>
          ))}
        </ul>
      ) : null}
    </Summary>
  );
}

function DeleteSummary({ summary }: { summary: Of<"delete" | "delete_list"> }) {
  const t = useTranslations("admin.journal.summary");
  const title = summary.kind === "delete" ? "delete" : "deleteList";
  return (
    <Summary>
      <Line>
        {t(title, { count: summary.count })}{" "}
        {summary.count !== 1 ? <Numbers numbers={summary.numbers} /> : null}
      </Line>
      <Line>{t("statuses", summary.statuses)}</Line>
      {summary.reservedNumbers ? (
        <Line>{t("reservedWere", { numbers: summary.reservedNumbers })}</Line>
      ) : null}
      {summary.soldNumbers ? <Line>{t("soldWere", { numbers: summary.soldNumbers })}</Line> : null}
    </Summary>
  );
}

function StatusBadge({ status }: { status: UnitStatus }) {
  const t = useTranslations("admin.journal.unitStatus");
  return (
    <Badge tone={STATUS_TONES[status]} size="sm">
      {t(status)}
    </Badge>
  );
}

// Одна квартира — номер уже в подписи записи («Блок A · кв. 41»): число и номера не повторяем.
function Amount({ summary }: { summary: UnitsSummary }) {
  if (summary.count === 1) return null;
  return (
    <>
      <Count count={summary.count} /> <Numbers numbers={summary.numbers} />
    </>
  );
}

function GroupCount({
  summary,
  group,
}: {
  summary: UnitsSummary;
  group: { count: number; numbers: string };
}) {
  if (summary.count === 1) return null;
  return (
    <>
      <Count count={group.count} /> <Numbers numbers={group.numbers} />
    </>
  );
}

function Count({ count }: { count: number }) {
  const t = useTranslations("admin.journal.summary");
  return <span>{t("count", { count })}</span>;
}

function Numbers({ numbers }: { numbers: string }) {
  const t = useTranslations("admin.journal.summary");
  if (!numbers) return null;
  return <span className="journal-list__numbers">{t("numbers", { numbers })}</span>;
}

const Summary = ({ children }: { children: ReactNode }) => (
  <div className="journal-list__summary">{children}</div>
);
const Line = ({ children }: { children: ReactNode }) => (
  <p className="journal-list__summary-line">{children}</p>
);
const Note = ({ children }: { children: ReactNode }) => (
  <p className="journal-list__note">{children}</p>
);
