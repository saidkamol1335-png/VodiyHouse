"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import type { ContentErrorCode } from "@/lib/admin/developers/errors";
import type {
  JournalAction,
  JournalChange,
  JournalEntry,
  JournalLoadResult,
  JournalPage,
  JournalScope,
  JournalValue,
} from "@/lib/admin/journal/format";
import {
  formatAmount,
  formatDate,
  formatDateTime,
  formatPrice,
  formatPricePerM2,
} from "@/lib/format";
import { JournalSummary } from "./JournalSummary";

export type JournalLoader = (scope: JournalScope, before: number) => Promise<JournalLoadResult>;

type JournalListProps = {
  page: JournalPage;
  /** Чей журнал: застройщика, ЖК или весь («Настройки → Журнал»). */
  scope: JournalScope;
  /** «Показать ещё» — Server Action; null — без продолжения (служебный стенд). */
  load: JournalLoader | null;
  /** Названия отделок по id — в записи только номер справочника. */
  finishings?: Readonly<Record<number, string>>;
};

const ACTION_TONES: Record<JournalAction, BadgeTone> = {
  insert: "ok",
  update: "neutral",
  delete: "bad",
};

/** Журнал изменений (ТЗ 13.1): кто, когда и что поменял — от новых к старым, страницами. */
export function JournalList({ page, scope, load, finishings = {} }: JournalListProps) {
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
          <JournalRow key={entry.id} entry={entry} finishings={finishings} />
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

type Finishings = Readonly<Record<number, string>>;

/** Подпись сущности или поля; незнакомый ключ — как есть. */
function useJournalLabel() {
  const t = useTranslations("admin.journal");
  return (group: "entities" | "fields", key: string) => {
    const path = `${group}.${key}` as Parameters<typeof t>[0];
    return t.has(path) ? t(path) : key;
  };
}

function JournalRow({ entry, finishings }: { entry: JournalEntry; finishings: Finishings }) {
  const t = useTranslations("admin.journal");
  const label = useJournalLabel();
  // Сводка на несколько квартир — «Квартиры», а не «Квартира · Блок A» на 180 квартир.
  const entity =
    entry.summary && entry.summary.count !== 1
      ? t("entities.units_many")
      : label("entities", entry.entity);
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
          <span className="journal-list__entity">{entity}</span>
          {entry.subject ? <span className="journal-list__subject">{entry.subject}</span> : null}
        </p>
        {entry.summary ? <JournalSummary summary={entry.summary} /> : null}
        {entry.changes.length > 0 ? (
          <ul className="journal-list__changes">
            {entry.changes.map((change) => (
              <JournalChangeRow key={change.field} change={change} finishings={finishings} />
            ))}
          </ul>
        ) : null}
      </div>
      <span className="journal-list__actor">{entry.actor ?? t("system")}</span>
    </li>
  );
}

/** «Поле было → стало»; файл и составной список — «изменено»; у сводки — только «стало». */
function JournalChangeRow({
  change,
  finishings,
}: {
  change: JournalChange;
  finishings: Finishings;
}) {
  const t = useTranslations("admin.journal");
  const label = useJournalLabel();
  return (
    <li className="journal-list__change">
      <span className="journal-list__field">{label("fields", change.field)}</span>{" "}
      {change.opaque ? (
        <span className="journal-list__value">{t("changed")}</span>
      ) : change.afterOnly ? (
        <JournalValueText value={change.after} finishings={finishings} />
      ) : (
        <>
          <JournalValueText value={change.before} finishings={finishings} /> {t("arrow")}{" "}
          <JournalValueText value={change.after} finishings={finishings} />
        </>
      )}
    </li>
  );
}

type ValueProps = { value: JournalValue; finishings: Finishings };

/** Значение «было» или «стало»: пусто — «—», текст на двух языках — оба. */
function JournalValueText({ value, finishings }: ValueProps) {
  const t = useTranslations("admin");
  switch (value.kind) {
    case "unitStatus":
    case "money":
    case "finishing":
      return <UnitValueText value={value} finishings={finishings} />;
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

/** Значения квартир (шаг 12): статус, цена с валютой блока, отделка из справочника. */
function UnitValueText({ value, finishings }: ValueProps) {
  const t = useTranslations("admin.journal");
  if (value.kind === "unitStatus")
    return <span className="journal-list__value">{t(`unitStatus.${value.status}`)}</span>;
  if (value.kind === "money")
    return <span className="journal-list__value">{moneyText(value)}</span>;
  if (value.kind !== "finishing") return null;
  if (value.id === null)
    return (
      <span className="journal-list__value journal-list__value--empty">
        {value.inherit ? t("summary.inherit") : t("empty_value")}
      </span>
    );
  return <span className="journal-list__value">{finishings[value.id] ?? `#${value.id}`}</span>;
}

/** Цена с валютой блока; старые записи без валюты — числом с разрядами. */
function moneyText(value: Extract<JournalValue, { kind: "money" }>): string {
  if (!value.currency) return formatAmount(value.amount);
  return value.perM2
    ? formatPricePerM2(value.amount, value.currency)
    : formatPrice(value.amount, value.currency);
}
