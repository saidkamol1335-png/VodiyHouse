"use client";

import { useTranslations } from "next-intl";
import { Field } from "@/components/Field";
import { SelectField, type SelectOption } from "@/components/SelectField";
import { FILTER_FIELD_PREFIX, filterQuery, filterValues } from "@/lib/admin/showcase/filterForm";
import type { FilterSearch, LocationOption } from "@/lib/admin/showcase/types";
import { PAYMENT_KINDS, ROOM_CHIPS } from "@/lib/site/catalog/filter";

// Условия фильтра каталога у подборки и рекламы (3.16а): те же параметры, что в адресе каталога
// (комнаты, цена, срок, город, способ оплаты); значения уходят полями `filter.<параметр>`.

const DEADLINE_YEARS = 3;

const fieldName = (param: string) => `${FILTER_FIELD_PREFIX}${param}`;

type FilterFieldsProps = {
  filter: FilterSearch;
  locations: readonly LocationOption[];
  error?: string;
  idPrefix: string;
};

export function FilterFields({ filter, locations, error, idPrefix }: FilterFieldsProps) {
  const t = useTranslations("admin.showcase.form");
  return (
    <div className="showcase-form__filter" role="group" aria-labelledby={`${idPrefix}-filter-title`}>
      <p id={`${idPrefix}-filter-title`} className="showcase-form__filter-title">
        {t("filter")}
      </p>
      <Chips
        name={fieldName("komnat")}
        label={t("filterRooms")}
        options={ROOM_CHIPS.map((rooms) => ({ value: String(rooms), label: t(`rooms.${rooms}`) }))}
        selected={filterValues(filter, "komnat")}
      />
      <PriceAndDeadline filter={filter} idPrefix={idPrefix} />
      <LocationSelect filter={filter} locations={locations} idPrefix={idPrefix} />
      <Chips
        name={fieldName("oplata")}
        label={t("filterPayment")}
        options={PAYMENT_KINDS.map((kind) => ({ value: kind, label: t(`payments.${kind}`) }))}
        selected={filterValues(filter, "oplata")}
      />
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : (
        <p className="showcase-form__query">{t("filterQuery", { query: filterQuery(filter) })}</p>
      )}
    </div>
  );
}

type PartProps = { filter: FilterSearch; idPrefix: string };

/** Цена от / до и срок сдачи: «Сдан» или «до года» на три года вперёд. */
function PriceAndDeadline({ filter, idPrefix }: PartProps) {
  const t = useTranslations("admin.showcase.form");
  const year = new Date().getFullYear();
  const deadlines: SelectOption[] = [
    { value: "built", label: t("deadlineBuilt") },
    ...Array.from({ length: DEADLINE_YEARS }, (_, index) => year + index).map((value) => ({
      value: String(value),
      label: t("deadlineUpTo", { year: value }),
    })),
  ];
  return (
    <div className="showcase-form__row showcase-form__row--three">
      <Field id={`${idPrefix}-ot`} name={fieldName("ot")} label={t("filterPriceFrom")} type="number" inputMode="numeric" min={0} defaultValue={filter.ot ?? ""} />
      <Field id={`${idPrefix}-do`} name={fieldName("do")} label={t("filterPriceTo")} type="number" inputMode="numeric" min={0} defaultValue={filter.do ?? ""} />
      <SelectField
        id={`${idPrefix}-srok`}
        name={fieldName("srok")}
        label={t("filterDeadline")}
        placeholder={t("deadlineAny")}
        options={deadlines}
        defaultValue={filter.srok ?? ""}
      />
    </div>
  );
}

/** Город или район — одно значение из справочника (группы: города, районы). */
function LocationSelect({ filter, locations, idPrefix }: PartProps & { locations: readonly LocationOption[] }) {
  const t = useTranslations("admin.showcase.form");
  const options: SelectOption[] = locations.map((location) => ({
    value: location.slug,
    label: location.name,
    group: location.kind === "city" ? t("locationCities") : t("locationDistricts"),
  }));
  return (
    <SelectField
      id={`${idPrefix}-gorod`}
      name={fieldName("gorod")}
      label={t("filterLocation")}
      placeholder={t("locationAll")}
      options={options}
      defaultValue={filter.gorod ?? ""}
    />
  );
}

type ChipsProps = {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  selected: readonly string[];
};

/** Чипы с отметками (комнаты, способ оплаты) — как чипы фильтра каталога. */
function Chips({ name, label, options, selected }: ChipsProps) {
  return (
    <fieldset className="showcase-form__chipset">
      <legend className="field__label">{label}</legend>
      <div className="showcase-form__chips">
        {options.map((option) => (
          <label key={option.value} className="showcase-form__chip">
            <input type="checkbox" name={name} value={option.value} defaultChecked={selected.includes(option.value)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
