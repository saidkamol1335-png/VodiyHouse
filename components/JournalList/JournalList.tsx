"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import type { ContentErrorCode } from "@/lib/admin/developers/errors";
import type {
  JournalAction,
  JournalEntry,
  JournalLoadResult,
  JournalPage,
  JournalScope,
  JournalValue,
} from "@/lib/admin/journal/format";
import { formatDate, formatDateTime } from "@/lib/format";

export type JournalLoader = (scope: JournalScope, before: number) => Promise<JournalLoadResult>;

type JournalListProps = {
  page: JournalPage;
  /** Чей журнал: застройщика, ЖК или весь («Настройки → Журнал»). */
  scope: JournalScope;
  /** «Показать ещё» — Server Action; null — без продолжения (служебный стенд). */
  load: JournalLoader | null;
};

const ACTION_TONES: Record<JournalAction, BadgeTone> = {
  insert: "ok",
  update: "neutral",
  delete: "bad",
};

/** Журнал изменений (ТЗ 13.1): кто, когда и что поменял — от новых к старым, страницами. */
export function JournalList({ page, scope, load }: JournalListProps) {
  const t = useTranslations("admin");
  const [entries, setEntries] = useState(page.entries);
  const [nextBefore, setNextBefore] = useState(page.nextBefore);
  const [error, setError] = useState<ContentErrorCode | null>(null);
  const [loading, startLoading] = useTransition();

  const more = () =>
    startLoading(async () => {
      if (!load || nextBefore === null) return;
      const result = await load(scope, nextBefore);
      if (result.status === "error") return setError(result.error);
      setError(null);
      setEntries((current) => [...current, ...result.page.entries]);
      setNextBefore(result.page.nextBefore);
    });

  if (entries.length === 0) return <p className="journal-list__empty">{t("journal.empty")}</p>;
  return (
    <div className="journal-list">
      <ol className="journal-list__entries">
        {entries.map((entry) => (
          <JournalRow key={entry.id} entry={entry} />
        ))}
      </ol>
      {error ? <FormStatus tone="error">{t(`developers.errors.${error}`)}</FormStatus> : null}
      {load && nextBefore !== null ? (
        <Button variant="ghost" size="sm" pending={loading} onClick={more}>
          {loading ? t("journal.loading") : t("journal.more")}
        </Button>
      ) : null}
    </div>
  );
}

function JournalRow({ entry }: { entry: JournalEntry }) {
  const t = useTranslations("admin.journal");
  const label = (group: "entities" | "fields", key: string) => {
    const path = `${group}.${key}` as Parameters<typeof t>[0];
    return t.has(path) ? t(path) : key;
  };
  return (
    <li className="journal-list__entry">
      <time className="journal-list__time" dateTime={entry.at}>
        {formatDateTime(new Date(entry.at))}
      </time>
      <div className="journal-list__body">
        <p className="journal-list__head">
          <Badge tone={ACTION_TONES[entry.action]} size="sm">
            {t(`actions.${entry.action}`)}
          </Badge>
          <span className="journal-list__entity">{label("entities", entry.entity)}</span>
          {entry.subject ? <span className="journal-list__subject">{entry.subject}</span> : null}
        </p>
        {entry.changes.length > 0 ? (
          <ul className="journal-list__changes">
            {entry.changes.map((change) => (
              <li key={change.field} className="journal-list__change">
                <span className="journal-list__field">{label("fields", change.field)}</span>{" "}
                {change.opaque ? (
                  <span className="journal-list__value">{t("changed")}</span>
                ) : (
                  <>
                    <JournalValueText value={change.before} /> {t("arrow")}{" "}
                    <JournalValueText value={change.after} />
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <span className="journal-list__actor">{entry.actor ?? t("system")}</span>
    </li>
  );
}

/** Значение «было» или «стало»: пусто — «—», текст на двух языках — оба. */
function JournalValueText({ value }: { value: JournalValue }) {
  const t = useTranslations("admin");
  switch (value.kind) {
    case "empty":
      return (
        <span className="journal-list__value journal-list__value--empty">
          {t("journal.empty_value")}
        </span>
      );
    case "flag":
      return (
        <span className="journal-list__value">{value.on ? t("journal.yes") : t("journal.no")}</span>
      );
    case "status":
      return <span className="journal-list__value">{t(`publication.${value.status}`)}</span>;
    case "date":
      return (
        <span className="journal-list__value">
          {value.iso.includes("T")
            ? formatDateTime(new Date(value.iso))
            : formatDate(new Date(value.iso))}
        </span>
      );
    case "bilingual":
      return (
        <span className="journal-list__value">
          <span lang="ru">{value.ru}</span> · <span lang="uz">{value.uz}</span>
        </span>
      );
    case "text":
      return <span className="journal-list__value">{value.text}</span>;
  }
}
