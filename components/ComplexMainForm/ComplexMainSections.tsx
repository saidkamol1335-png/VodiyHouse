"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AdminPanel } from "@/components/AdminPanel";
import { BilingualField } from "@/components/BilingualField";
import { ChoiceField } from "@/components/ChoiceField";
import { Field } from "@/components/Field";
import { PointField } from "@/components/PointField";
import { SelectField, type SelectOption } from "@/components/SelectField";
import { COMPLEX_LIMITS, type ComplexMainFields } from "@/lib/admin/complexes/mainForm";
import { COMPLEX_CLASSES, HOUSE_TYPES, PARKING_TYPES } from "@/lib/admin/complexes/record";
import type { DeveloperOption } from "@/lib/admin/complexes/types";

// Три панели «Основного» (И1) — как разделы страницы ЖК на сайте: «О ЖК» (8 фактов),
// «Расположение», «Проверено Vodiy House». Поля — общие компоненты кабинета (Д3, «реши сам»).

export type SectionProps = {
  fields: ComplexMainFields;
  issue: (field: keyof ComplexMainFields) => string | undefined;
  developers: readonly DeveloperOption[];
  locations: readonly SelectOption[];
  floors: string | null;
  blocksHref: string;
};

export function AboutPanel({ fields, issue, developers, floors, blocksHref }: SectionProps) {
  const t = useTranslations("admin.complexes");
  const values = (group: "class" | "houseType" | "parking", keys: readonly string[]) =>
    keys.map((key) => ({
      value: key,
      label: t(`values.${group}.${key}` as "values.class.econom"),
    }));
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
        <div className="complex-main__row">
          <SelectField
            id="complex-developer"
            name="developerId"
            label={t("fields.developer")}
            options={developers.map((developer) => ({
              value: developer.id,
              label: developer.name,
            }))}
            defaultValue={fields.developerId}
            error={issue("developerId")}
          />
          <ChoiceField
            id="complex-class"
            name="class"
            label={t("fields.class")}
            options={values("class", COMPLEX_CLASSES)}
            defaultValue={fields.class}
            clearLabel={t("clear")}
            error={issue("class")}
          />
        </div>
        <div className="complex-main__row complex-main__row--three">
          <ChoiceField
            id="complex-house-type"
            name="houseType"
            label={t("fields.houseType")}
            options={values("houseType", HOUSE_TYPES)}
            defaultValue={fields.houseType}
            clearLabel={t("clear")}
            error={issue("houseType")}
          />
          <ChoiceField
            id="complex-parking"
            name="parking"
            label={t("fields.parking")}
            options={values("parking", PARKING_TYPES)}
            defaultValue={fields.parking}
            clearLabel={t("clear")}
            error={issue("parking")}
          />
          <Field
            id="complex-ceiling"
            name="ceilingHeight"
            label={t("fields.ceilingHeight")}
            inputMode="decimal"
            placeholder="3,0"
            defaultValue={fields.ceilingHeight}
            error={issue("ceilingHeight")}
          />
        </div>
        <p className="complex-main__floors">
          {floors ? t("floors", { floors }) : t("floorsEmpty")}{" "}
          <Link href={blocksHref}>{t("floorsLink")}</Link>
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

export function LocationPanel({ fields, issue, locations }: SectionProps) {
  const t = useTranslations("admin.complexes");
  return (
    <AdminPanel title={t("sections.location")} wide>
      <div className="complex-main__grid">
        <div className="complex-main__row">
          <SelectField
            id="complex-location"
            name="locationId"
            label={t("fields.location")}
            placeholder={t("fields.locationPlaceholder")}
            options={locations}
            defaultValue={fields.locationId}
            error={issue("locationId")}
          />
          <Field
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
        <PointField
          id="complex-point"
          name="point"
          label={t("fields.point")}
          defaultValue={fields.point}
          error={issue("point")}
        />
      </div>
    </AdminPanel>
  );
}

export function ChecksPanel({ fields, issue }: SectionProps) {
  const t = useTranslations("admin.complexes");
  const date = (name: "permitCheckedAt" | "landCheckedAt" | "staffVisitedAt") => (
    <Field
      id={`complex-${name}`}
      name={name}
      label={t(`fields.${name}`)}
      type="date"
      defaultValue={fields[name]}
      error={issue(name)}
    />
  );
  return (
    <AdminPanel title={t("sections.checks")} wide>
      <div className="complex-main__row complex-main__row--three">
        {date("permitCheckedAt")}
        {date("landCheckedAt")}
        {date("staffVisitedAt")}
      </div>
      <p className="field__meta">{t("fields.checksHint")}</p>
    </AdminPanel>
  );
}
