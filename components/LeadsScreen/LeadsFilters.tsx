"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { FilterPills } from "@/components/FilterPills";
import { SearchField } from "@/components/SearchField";
import { SelectField } from "@/components/SelectField";
import type { LeadsFilter, LeadsScreen } from "@/lib/admin/leads/screen";
import { LEAD_STATUSES, LEAD_TYPES, type LeadStatus, type LeadType } from "@/lib/leads/types";

type LeadsFiltersProps = {
  screen: LeadsScreen;
  filter: LeadsFilter;
  onChange: (filter: LeadsFilter) => void;
  /** «CSV» — та же выборка файлом (Excel открывает по двойному щелчку). */
  csvHref: string;
};

const SEARCH_DELAY_MS = 300;

/** Поиск ждёт паузы в наборе: каждая буква не перечитывает список с сервера. */
function useDebouncedQuery(filter: LeadsFilter, onChange: (filter: LeadsFilter) => void) {
  const [query, setQuery] = useState(filter.query);
  useEffect(() => {
    if (query.trim() === filter.query) return;
    const timer = setTimeout(() => onChange({ ...filter, query: query.trim() }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query, filter, onChange]);
  return [query, setQuery] as const;
}

/** Фильтры мокапа CabLeads: пилюли статусов со счётчиками, тип заявки, поиск, CSV. */
export function LeadsFilters({ screen, filter, onChange, csvHref }: LeadsFiltersProps) {
  const t = useTranslations("admin.leads");
  const [query, setQuery] = useDebouncedQuery(filter, onChange);
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
        onChange={(key) => onChange({ ...filter, status: key === "all" ? null : (key as LeadStatus) })}
      />
      <div className="leads-screen__tools">
        <SelectField
          id="leads-type"
          label={t("filters.type")}
          value={filter.type ?? ""}
          placeholder={t("filters.allTypes")}
          options={LEAD_TYPES.map((type) => ({ value: type, label: t(`types.${type}`) }))}
          onChange={(event) => onChange({ ...filter, type: (event.target.value || null) as LeadType | null })}
          className="leads-screen__type"
          labelHidden
        />
        <SearchField
          id="leads-search"
          label={t("filters.search")}
          placeholder={t("filters.searchPlaceholder")}
          value={query}
          onChange={setQuery}
          className="leads-screen__search"
        />
        <Button variant="outline" href={csvHref} className="leads-screen__csv">
          <Download size={16} aria-hidden="true" />
          {t("filters.csv")}
        </Button>
      </div>
    </div>
  );
}
