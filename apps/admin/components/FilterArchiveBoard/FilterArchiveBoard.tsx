"use client";

import type { FilterArchive } from "@vh/shared/filterArchive";
import { formatDate } from "@vh/shared/format";
import { Archive, ArchiveRestore, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState, useTransition } from "react";
import { ActionToast, type ToastMessage } from "@/components/ActionToast";
import { AdminPanel } from "@/components/AdminPanel";
import { Button } from "@/components/Button";
import type { FilterArchiveMode, FilterArchiveResult } from "@/lib/admin/actions/filterArchive";
import type { FilterArchiveGroup, FilterArchiveOption } from "@/lib/admin/filterArchive/groups";
import { settle } from "@/lib/ui/settle";

type FilterArchiveBoardProps = {
  groups: FilterArchiveGroup[];
  /** Каталог сайта не ответил — показаны только постоянные кнопки и архив. */
  catalogMissing: boolean;
  action: (id: string, mode: FilterArchiveMode) => Promise<FilterArchiveResult>;
};

const dateOf = (iso: string) => formatDate(new Date(iso));

/**
 * «Настройки → Фильтр сайта» (06.11.2026): кнопки фильтра каталога по блокам, как на сайте. Клик по
 * кнопке — в архив (пропадает с сайта), по кнопке из архива — обратно. Ниже — список архива.
 */
export function FilterArchiveBoard({
  groups: initial,
  catalogMissing,
  action,
}: FilterArchiveBoardProps) {
  const t = useTranslations("admin");
  const { groups, busy, toggle, toast, closeToast } = useArchiveToggle(initial, action);
  return (
    <>
      <AdminPanel title={t("filterArchive.title")} wide>
        <div className="filter-archive">
          <p className="filter-archive__lead">{t("filterArchive.lead")}</p>
          {catalogMissing ? (
            <p className="filter-archive__warn">{t("filterArchive.catalogUnavailable")}</p>
          ) : null}
          {groups.map((group) => (
            <FilterGroup key={group.id} group={group} busy={busy} onToggle={toggle} />
          ))}
        </div>
      </AdminPanel>
      <ArchiveList groups={groups} busy={busy} onToggle={toggle} />
      <ActionToast message={toast} closeLabel={t("filterArchive.close")} onClose={closeToast} />
    </>
  );
}

/** Пометки «в архиве» по ответу сервера: архив целиком, а не одна кнопка — сразу видны правки коллег. */
function withArchive(groups: FilterArchiveGroup[], archive: FilterArchive): FilterArchiveGroup[] {
  const at = new Map(archive.items.map((item) => [item.id, item.at]));
  return groups.map((group) => ({
    ...group,
    archivedAt: at.get(group.id) ?? null,
    options: group.options.map((option) => ({ ...option, archivedAt: at.get(option.id) ?? null })),
  }));
}

const NO_CONNECTION: FilterArchiveResult = { status: "error", error: "network" };

type ArchiveError = Extract<FilterArchiveResult, { status: "error" }>["error"];

/** Свои тексты — переполнение и одновременная правка; остальное — общие ошибки кабинета. */
function errorText(t: ReturnType<typeof useTranslations<"admin">>, error: ArchiveError): string {
  if (error === "tooMany") return t("filterArchive.full");
  if (error === "busy") return t("filterArchive.busy");
  return t(`developers.errors.${error}`);
}

/** «В архив» / «Вернуть»: одно действие за раз, итог — полосой снизу. */
function useArchiveToggle(
  initial: FilterArchiveGroup[],
  action: FilterArchiveBoardProps["action"],
) {
  const t = useTranslations("admin");
  const [groups, setGroups] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const toggle = (id: string, label: string, mode: FilterArchiveMode) => {
    setBusy(id);
    startTransition(async () => {
      const result = await settle(() => action(id, mode), NO_CONNECTION);
      setBusy(null);
      if (result.status === "error") {
        setToast({ id: Date.now(), tone: "error", text: errorText(t, result.error) });
        return;
      }
      setGroups((current) => withArchive(current, result.archive));
      const key = mode === "archive" ? "filterArchive.archived" : "filterArchive.restored";
      setToast({ id: Date.now(), tone: "success", text: t(key, { label }) });
    });
  };
  return { groups, busy, toggle, toast, closeToast };
}

type ToggleProps = {
  busy: string | null;
  onToggle: (id: string, label: string, mode: FilterArchiveMode) => void;
};

function FilterGroup({ group, busy, onToggle }: ToggleProps & { group: FilterArchiveGroup }) {
  const t = useTranslations("admin.filterArchive");
  const title = t(`sections.${group.section}`);
  const hidden = group.archivedAt !== null;
  return (
    <section
      className={
        hidden ? "filter-archive__group filter-archive__group--hidden" : "filter-archive__group"
      }
      aria-label={title}
    >
      <div className="filter-archive__head">
        <h3 className="filter-archive__title">{title}</h3>
        <Button
          size="sm"
          variant={hidden ? "outline" : "ghost"}
          pending={busy === group.id}
          disabled={busy !== null && busy !== group.id}
          onClick={() => onToggle(group.id, title, hidden ? "restore" : "archive")}
        >
          {hidden ? (
            <ArchiveRestore size={15} aria-hidden="true" />
          ) : (
            <EyeOff size={15} aria-hidden="true" />
          )}
          {hidden ? t("restoreSection") : t("hideSection")}
        </Button>
      </div>
      {hidden ? <p className="filter-archive__note">{t("sectionHidden")}</p> : null}
      {group.section === "price" ? <p className="filter-archive__note">{t("priceHint")}</p> : null}
      {group.section !== "price" && group.options.length === 0 ? (
        <p className="filter-archive__note">{t("emptyGroup")}</p>
      ) : null}
      {group.options.length > 0 ? (
        <ul className="filter-archive__chips">
          {group.options.map((option) => (
            <li key={option.id}>
              <OptionChip option={option} disabled={hidden} busy={busy} onToggle={onToggle} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function OptionChip({
  option,
  disabled,
  busy,
  onToggle,
}: ToggleProps & { option: FilterArchiveOption; disabled: boolean }) {
  const t = useTranslations("admin.filterArchive");
  const archived = option.archivedAt !== null;
  return (
    <button
      type="button"
      className={
        archived ? "filter-archive__chip filter-archive__chip--archived" : "filter-archive__chip"
      }
      aria-pressed={archived}
      aria-label={
        archived
          ? t("fromArchive", { label: option.label })
          : t("toArchive", { label: option.label })
      }
      aria-busy={busy === option.id || undefined}
      disabled={disabled || (busy !== null && busy !== option.id)}
      onClick={() => onToggle(option.id, option.label, archived ? "restore" : "archive")}
    >
      <span className="filter-archive__chip-label">{option.label}</span>
      {archived ? (
        <ArchiveRestore size={14} aria-hidden="true" />
      ) : (
        <Archive size={14} aria-hidden="true" />
      )}
    </button>
  );
}

type ArchivedRow = { id: string; section: string; label: string | null; at: string };

function archivedRows(
  groups: readonly FilterArchiveGroup[],
  sectionTitle: (group: FilterArchiveGroup) => string,
): ArchivedRow[] {
  return groups
    .flatMap((group) => [
      ...(group.archivedAt
        ? [{ id: group.id, section: sectionTitle(group), label: null, at: group.archivedAt }]
        : []),
      ...group.options.flatMap((option) =>
        option.archivedAt && option.id !== group.id
          ? [
              {
                id: option.id,
                section: sectionTitle(group),
                label: option.label,
                at: option.archivedAt,
              },
            ]
          : [],
      ),
    ])
    .sort((a, b) => b.at.localeCompare(a.at));
}

function ArchiveList({ groups, busy, onToggle }: ToggleProps & { groups: FilterArchiveGroup[] }) {
  const t = useTranslations("admin.filterArchive");
  const rows = archivedRows(groups, (group) => t(`sections.${group.section}`));
  return (
    <AdminPanel title={t("archiveTitle")} wide>
      <p className="filter-archive__lead">{t("archiveLead")}</p>
      {rows.length === 0 ? (
        <p className="filter-archive__empty">{t("archiveEmpty")}</p>
      ) : (
        <ul className="filter-archive__list">
          {rows.map((row) => (
            <li key={row.id} className="filter-archive__row">
              <span className="filter-archive__row-name">
                <b>{row.label ?? row.section}</b>
                <span className="filter-archive__row-meta">
                  {row.label ? row.section : t("wholeSection")} ·{" "}
                  {t("archivedAt", { date: dateOf(row.at) })}
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                pending={busy === row.id}
                disabled={busy !== null && busy !== row.id}
                onClick={() => onToggle(row.id, row.label ?? row.section, "restore")}
              >
                <ArchiveRestore size={15} aria-hidden="true" />
                {t("restore")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </AdminPanel>
  );
}
