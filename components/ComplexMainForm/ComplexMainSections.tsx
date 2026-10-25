"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AdminPanel } from "@/components/AdminPanel";
import { BilingualField } from "@/components/BilingualField";
import { ChoiceField } from "@/components/ChoiceField";
import { Field } from "@/components/Field";
import { NearbyEditor } from "@/components/NearbyEditor";
import { PointField } from "@/components/PointField";
import { SelectField, type SelectOption } from "@/components/SelectField";
import { COMPLEX_LIMITS, type ComplexMainFields } from "@/lib/admin/complexes/mainForm";
import { COMPLEX_CLASSES, HOUSE_TYPES, PARKING_TYPES } from "@/lib/admin/complexes/record";
import type { DeveloperOption } from "@/lib/admin/complexes/types";

// Три панели «Основного» (И1) — как разделы страницы ЖК на сайте: «О ЖК» (8 фактов),
// «Расположение», «Проверено Vodiy House». Поля — общие компоненты кабинета (Д3, «реши сам»).

/** Поле в ряду на общей сетке: подписи разной высоты, а поля на одной линии. */
const ROW_FIELD = "field--subgrid complex-main__field";

export type SectionProps = {
  fields: ComplexMainFields;
  issue: (field: keyof ComplexMainFields) => string | undefined;
  developers: readonly DeveloperOption[];
  locations: readonly SelectOption[];
  floors: string | null;
  blocksHref: string;
};

type Translate = ReturnType<typeof useTranslations<"admin.complexes">>;

/** Варианты сегмента из словаря значений ЖК («Эконом · Комфорт · …»). */
const choiceValues = (t: Translate, group: "class" | "houseType" | "parking", keys: readonly string[]) =>
  keys.map((key) => ({
    value: key,
    label: t(`values.${group}.${key}` as "values.class.econom"),
  }));

export function AboutPanel(props: SectionProps) {
  const { fields, issue, floors, blocksHref } = props;
  const t = useTranslations("admin.complexes");
  return (
    <AdminPanel title={t("sections.about")} wide>
      <div className="complex-main__grid">
        <BilingualField
          id="complex-name"
          name="name"
          label={t("fields.name")}
          uzLabel={t("fields.nameUz")}
          maxLength={COMPLEX_LIMITS.nameMax}
          defaultValue={fields.name}
          error={issue("name")}
        />
        <DeveloperClassRow {...props} />
        <HouseRow {...props} />
        <p className="complex-main__floors">
          {floors ? t("floors", { floors }) : t("floorsEmpty")} <Link href={blocksHref}>{t("floorsLink")}</Link>
        </p>
        <BilingualField
          id="complex-short"
          name="shortDescription"
          label={t("fields.shortDescription")}
          uzLabel={t("fields.shortDescriptionUz")}
          maxLength={COMPLEX_LIMITS.shortDescriptionMax}
          defaultValue={fields.shortDescription}
          error={issue("shortDescription")}
        />
        <p className="field__meta">{t("fields.shortDescriptionHint")}</p>
      </div>
    </AdminPanel>
  );
}

function DeveloperClassRow({ fields, issue, developers }: SectionProps) {
  const t = useTranslations("admin.complexes");
  return (
    <div className="complex-main__row">
      <SelectField
        className={ROW_FIELD}
        id="complex-developer"
        name="developerId"
        label={t("fields.developer")}
        options={developers.map((developer) => ({ value: developer.id, label: developer.name }))}
        defaultValue={fields.developerId}
        error={issue("developerId")}
      />
      <ChoiceField
        className={ROW_FIELD}
        id="complex-class"
        name="class"
        label={t("fields.class")}
        options={choiceValues(t, "class", COMPLEX_CLASSES)}
        defaultValue={fields.class}
        clearLabel={t("clear")}
        error={issue("class")}
      />
    </div>
  );
}

function HouseRow({ fields, issue }: SectionProps) {
  const t = useTranslations("admin.complexes");
  return (
    <div className="complex-main__row complex-main__row--three">
      <ChoiceField
        className={ROW_FIELD}
        id="complex-house-type"
        name="houseType"
        label={t("fields.houseType")}
        options={choiceValues(t, "houseType", HOUSE_TYPES)}
        defaultValue={fields.houseType}
        clearLabel={t("clear")}
        error={issue("houseType")}
      />
      <ChoiceField
        className={ROW_FIELD}
        id="complex-parking"
        name="parking"
        label={t("fields.parking")}
        options={choiceValues(t, "parking", PARKING_TYPES)}
        defaultValue={fields.parking}
        clearLabel={t("clear")}
        error={issue("parking")}
      />
      <Field
        className={ROW_FIELD}
        id="complex-ceiling"
        name="ceilingHeight"
        label={t("fields.ceilingHeight")}
        inputMode="decimal"
        placeholder="3,0"
        defaultValue={fields.ceilingHeight}
        error={issue("ceilingHeight")}
      />
    </div>
  );
}

export function LocationPanel(props: SectionProps) {
  const { fields, issue } = props;
  const t = useTranslations("admin.complexes");
  return (
    <AdminPanel title={t("sections.location")} wide>
      <div className="complex-main__grid">
        <LocationRow {...props} />
        <BilingualField
          id="complex-address"
          name="address"
          label={t("fields.address")}
          uzLabel={t("fields.addressUz")}
          maxLength={COMPLEX_LIMITS.addressMax}
          defaultValue={fields.address}
          error={issue("address")}
        />
        <BilingualField
          id="complex-landmark"
          name="landmark"
          label={t("fields.landmark")}
          uzLabel={t("fields.landmarkUz")}
          maxLength={COMPLEX_LIMITS.landmarkMax}
          defaultValue={fields.landmark}
          error={issue("landmark")}
        />
        <PointField id="complex-point" name="point" label={t("fields.point")} defaultValue={fields.point} error={issue("point")} />
      </div>
      <NearbyEditor initial={fields.nearby} error={issue("nearby")} />
    </AdminPanel>
  );
}

function LocationRow({ fields, issue, locations }: SectionProps) {
  const t = useTranslations("admin.complexes");
  return (
    <div className="complex-main__row">
      <SelectField
        className={ROW_FIELD}
        id="complex-location"
        name="locationId"
        label={t("fields.location")}
        placeholder={t("fields.locationPlaceholder")}
        options={locations}
        defaultValue={fields.locationId}
        error={issue("locationId")}
      />
      <Field
        className={ROW_FIELD}
        id="complex-minutes"
        name="minutesToCenter"
        label={t("fields.minutesToCenter")}
        type="number"
        inputMode="numeric"
        min={0}
        max={COMPLEX_LIMITS.minutesMax}
        defaultValue={fields.minutesToCenter}
        error={issue("minutesToCenter")}
      />
    </div>
  );
}

export function ChecksPanel({ fields, issue }: SectionProps) {
  const t = useTranslations("admin.complexes");
  return (
    <AdminPanel title={t("sections.checks")} wide>
      <div className="complex-main__row complex-main__row--three">
        <Field className={ROW_FIELD} id="complex-staffVisitedAt" name="staffVisitedAt" label={t("fields.staffVisitedAt")} type="date" defaultValue={fields.staffVisitedAt} error={issue("staffVisitedAt")} />
      </div>
      <p className="field__meta">{t("fields.checksHint")}</p>
    </AdminPanel>
  );
}
