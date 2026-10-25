"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { FilterPills } from "@/components/FilterPills";
import { SearchField } from "@/components/SearchField";
import { SelectField } from "@/components/SelectField";
import { LEADS_QUERY_MAX, type LeadsFilter, type LeadsScreen } from "@/lib/admin/leads/screen";
import { LEAD_STATUSES, LEAD_TYPES, type LeadStatus, type LeadType } from "@/lib/leads/types";

type LeadsFiltersProps = {
  screen: LeadsScreen;
  filter: LeadsFilter;
  onChange: (filter: LeadsFilter) => void;
  /** «CSV» — та же выборка файлом (Excel открывает по двойному щелчку). */
  csvHref: string;
};

const SEARCH_DELAY_MS = 300;

/**
 * Поиск ждёт паузы в наборе: каждая буква не перечитывает список с сервера. Отправка — из набора,
 * а не из эффекта по адресу. Адрес сменился извне («Заявки» в меню, «Назад») — поле берёт его;
 * ответ на свой же запрос поле не трогает (набранные за это время буквы не пропадут). Пилюля или
 * тип в паузе набора уходят вместе с набранным текстом.
 */
function useLeadsSearch(filter: LeadsFilter, onChange: (filter: LeadsFilter) => void) {
  const [query, setQuery] = useState(filter.query);
  const [shown, setShown] = useState(filter.query);
  const [sent, setSent] = useState(filter.query);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Последний фильтр — запрошенный или пришедший с сервера: таймер собирает запрос из него.
  const latest = useRef({ filter, onChange });
  useEffect(() => {
    latest.current = { filter, onChange };
  }, [filter, onChange]);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (filter.query !== shown) {
    setShown(filter.query);
    if (filter.query !== sent) {
      setQuery(filter.query);
      setSent(filter.query);
    }
  }
  const dispatch = (next: LeadsFilter) => {
    clearTimeout(timer.current);
    setSent(next.query);
    latest.current = { ...latest.current, filter: next };
    latest.current.onChange(next);
  };
  const type = (value: string) => {
    setQuery(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const current = latest.current.filter;
      if (cleanQuery(value) !== current.query) dispatch({ ...current, query: cleanQuery(value) });
    }, SEARCH_DELAY_MS);
  };
  const change = (patch: Partial<LeadsFilter>) => dispatch({ ...latest.current.filter, ...patch, query: cleanQuery(query) });
  return { query, type, change };
}

const cleanQuery = (value: string) => value.trim().slice(0, LEADS_QUERY_MAX);

/** Фильтры мокапа CabLeads: пилюли статусов со счётчиками, тип заявки, поиск, CSV. */
export function LeadsFilters({ screen, filter, onChange, csvHref }: LeadsFiltersProps) {
  const t = useTranslations("admin.leads");
  const search = useLeadsSearch(filter, onChange);
  const pills = [
    { key: "all" as const, label: t("filters.all"), count: screen.total },
    ...LEAD_STATUSES.map((status) => ({ key: status, label: t(`statuses.${status}`), count: screen.counts[status] })),
  ];
  return (
    <div className="leads-screen__filters">
      <FilterPills
        label={t("filters.label")}
        pills={pills}
        value={filter.status ?? "all"}
        onChange={(key) => search.change({ status: key === "all" ? null : (key as LeadStatus) })}
      />
      <div className="leads-screen__tools">
        <SelectField
          id="leads-type"
          label={t("filters.type")}
          value={filter.type ?? ""}
          placeholder={t("filters.allTypes")}
          options={LEAD_TYPES.map((type) => ({ value: type, label: t(`types.${type}`) }))}
          onChange={(event) => search.change({ type: (event.target.value || null) as LeadType | null })}
          className="leads-screen__type"
          labelHidden
        />
        <SearchField
          id="leads-search"
          label={t("filters.search")}
          placeholder={t("filters.searchPlaceholder")}
          value={search.query}
          onChange={search.type}
          maxLength={LEADS_QUERY_MAX}
          className="leads-screen__search"
        />
        <Button variant="outline" href={csvHref} download className="leads-screen__csv">
          <Download size={16} aria-hidden="true" />
          {t("filters.csv")}
        </Button>
      </div>
    </div>
  );
}
