"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { ComplexSaveFeedback } from "@/components/ComplexSaveFeedback";
import type { SelectOption } from "@/components/SelectField";
import type { ComplexMainFields, ComplexMainSection } from "@/lib/admin/complexes/mainForm";
import { nearbyDrafts } from "@/lib/admin/complexes/nearby";
import type { ComplexRecord } from "@/lib/admin/complexes/record";
import type { DeveloperOption, SaveComplexMainResult } from "@/lib/admin/complexes/types";
import type { FormAction } from "@/lib/admin/developers/types";
import { formatCoordinates } from "@/lib/geo";
import { submitKeepingForm } from "@/lib/ui/submitKeepingForm";
import { useUnsavedGuard } from "@/lib/ui/useUnsavedGuard";
import {
  AboutPanel,
  ChecksPanel,
  DescriptionPanel,
  LocationPanel,
  type SectionProps,
} from "./ComplexMainSections";

type ComplexMainFormProps = {
  /** Какая вкладка экрана 3: свои поля и своя «Сохранить» (PLAN §10, п. 21). */
  section: ComplexMainSection;
  complex: ComplexRecord;
  action: FormAction<SaveComplexMainResult>;
  developers: readonly DeveloperOption[];
  locations: readonly SelectOption[];
  /** «12 этажей» по блокам (И3); null — блоков с этажностью ещё нет. */
  floors: string | null;
  blocksHref: string;
};

const IDLE: SaveComplexMainResult = { status: "idle" };
const CEILING = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

function fieldsOf(complex: ComplexRecord): ComplexMainFields {
  const empty = { ru: "", uz: "" };
  return {
    name: complex.name,
    developerId: complex.developerId ?? "",
    class: complex.class ?? "",
    houseType: complex.houseType ?? "",
    ceilingHeight: complex.ceilingHeight === null ? "" : CEILING.format(complex.ceilingHeight),
    parking: complex.parking ?? "",
    shortDescription: complex.shortDescription ?? empty,
    locationId: complex.locationId?.toString() ?? "",
    address: complex.address ?? empty,
    landmark: complex.landmark ?? empty,
    minutesToCenter: complex.minutesToCenter?.toString() ?? "",
    point:
      complex.lat !== null && complex.lng !== null
        ? formatCoordinates({ lat: complex.lat, lng: complex.lng })
        : "",
    nearby: nearbyDrafts(complex.nearby),
    staffVisitedAt: complex.staffVisitedAt ?? "",
  };
}

const PANELS: Record<ComplexMainSection, (props: SectionProps) => ReactNode> = {
  main: AboutPanel,
  about: DescriptionPanel,
  location: LocationPanel,
  checks: ChecksPanel,
};

/** Поля ЖК одной вкладки экрана 3 и её «Сохранить» (И1). */
export function ComplexMainForm(props: ComplexMainFormProps) {
  const t = useTranslations("admin.complexes");
  const [state, formAction, pending] = useActionState(
    (_previous: SaveComplexMainResult, formData: FormData) => props.action(formData),
    IDLE,
  );
  const guard = useUnsavedGuard(t("unsaved"));
  const { reset } = guard;
  const savedAt = state.status === "saved" ? state.at : null;
  useEffect(() => {
    if (savedAt) reset();
  }, [savedAt, reset]);

  const failed = state.status === "error" ? state : null;
  const fields = failed?.fields ?? fieldsOf(props.complex);
  const issue = (field: keyof ComplexMainFields) => {
    const code = failed?.fieldErrors[field];
    return code ? t(`issues.${code}`) : undefined;
  };
  const Panel = PANELS[props.section];

  return (
    <form
      className="complex-main"
      onSubmit={submitKeepingForm(formAction)}
      onInput={guard.onInput}
      noValidate
    >
      <input type="hidden" name="id" value={props.complex.id} />
      <input type="hidden" name="section" value={props.section} />
      <Panel {...props} fields={fields} issue={issue} />
      <div className="complex-main__save">
        <ComplexSaveFeedback state={state} />
        <Button type="submit" pending={pending} className="complex-main__submit">
          {pending ? t("pending") : t("save")}
        </Button>
      </div>
    </form>
  );
}
