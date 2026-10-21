"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { RisersEditor } from "@/components/RisersEditor";
import { unassignedCount } from "@/lib/admin/units/generator";
import type {
  CreateBlockUnitsInput,
  CreateBlockUnitsResult,
  UnitsAction,
  UnitsLayout,
} from "@/lib/admin/units/types";
import { GeneratorFields } from "./GeneratorFields";
import { GeneratorFeedback, GeneratorNotes, GeneratorTotal } from "./GeneratorParts";
import { useGenerator } from "./useGenerator";

type UnitsGeneratorProps = {
  blockId: string;
  floors: number;
  layouts: readonly UnitsLayout[];
  layoutsHref: string;
  published: boolean;
  action: UnitsAction<CreateBlockUnitsInput, CreateBlockUnitsResult>;
};

/** Генератор одним экраном (№8, Н6): поля → живой итог → стояки → «Создать N квартир». */
export function UnitsGenerator(props: UnitsGeneratorProps) {
  const { blockId, floors, layouts } = props;
  const t = useTranslations("admin.complexes.units");
  const generator = useGenerator(props);
  const { plan, summary, risers, ready } = generator;
  return (
    <section className="units-generator" aria-labelledby={`${blockId}-generator`}>
      <h3 id={`${blockId}-generator`} className="units-generator__title">
        {t("generator.title")}
      </h3>
      <p className="units-generator__lead">{t("generator.lead")}</p>
      <GeneratorFields
        idPrefix={`${blockId}-generator`}
        inputs={generator.inputs}
        floors={floors}
        entrances={plan.unitsPerFloor.length}
        issues={generator.issues}
        onChange={generator.setInputs}
      />
      <GeneratorTotal summary={summary} issues={generator.issues} />
      {summary ? (
        <div className="units-generator__risers">
          <h4 className="units-generator__subtitle">{t("risers.title")}</h4>
          <p className="units-generator__lead">{t("risers.lead")}</p>
          <RisersEditor
            idPrefix={`${blockId}-risers`}
            plan={plan}
            risers={risers}
            layouts={layouts}
            onChange={generator.setRisers}
          />
        </div>
      ) : null}
      <GeneratorNotes {...props} unassigned={ready ? unassignedCount(plan, risers) : 0} />
      <div className="units-generator__actions">
        <GeneratorFeedback result={generator.result} />
        <Button pending={generator.pending} disabled={!ready} onClick={generator.create}>
          {generator.pending
            ? t("generator.creating")
            : summary
              ? t("generator.create", { count: summary.total })
              : t("generator.createAny")}
        </Button>
      </div>
    </section>
  );
}
