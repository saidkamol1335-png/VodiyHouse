"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ComplexSaveFeedback } from "@/components/ComplexSaveFeedback";
import { FormStatus } from "@/components/FormStatus";
import type { CreateBlockUnitsResult, UnitsLayout } from "@/lib/admin/units/types";
import type { BlockPlanIssue, BlockPlanSummary } from "@/lib/units";

type TotalProps = { summary: BlockPlanSummary | null; issues: readonly BlockPlanIssue[] };

/** «120 квартир · № 1–120» и по подъездам; больше 5000 — отказ тут же. */
export function GeneratorTotal({ summary, issues }: TotalProps) {
  const t = useTranslations("admin.complexes.units.generator");
  const tooMany = issues.find((issue) => issue.code === "tooManyUnits");
  return (
    <>
      {/* Живая область стоит всегда: вставленную вместе с текстом диктор не читает. */}
      <p className="units-generator__announce" aria-live="polite">
        {summary ? `${t("total", { count: summary.total })}, ${rangeText(t, summary)}` : ""}
      </p>
      {tooMany ? (
        <p className="units-generator__total units-generator__total--error" role="alert">
          {t("issues.tooManyUnits", tooMany)}
        </p>
      ) : summary ? (
        <SummaryBox summary={summary} />
      ) : null}
    </>
  );
}

type Translate = ReturnType<typeof useTranslations<"admin.complexes.units.generator">>;

const rangeText = (t: Translate, summary: BlockPlanSummary) =>
  t("range", { from: summary.firstNumber, to: summary.lastNumber });

function SummaryBox({ summary }: { summary: BlockPlanSummary }) {
  const t = useTranslations("admin.complexes.units.generator");
  return (
    <div className="units-generator__total">
      <p className="units-generator__count">
        <b>{t("total", { count: summary.total })}</b>
        <span className="units-generator__range">{rangeText(t, summary)}</span>
      </p>
      {summary.entrances.length > 1 ? (
        <ul className="units-generator__by-entrance">
          {summary.entrances.map((item) => (
            <li key={item.entrance}>
              {t("entranceRange", {
                n: item.entrance,
                from: item.firstNumber,
                to: item.lastNumber,
              })}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type NotesProps = {
  layouts: readonly UnitsLayout[];
  layoutsHref: string;
  published: boolean;
  unassigned: number;
};

/** Что стоит знать до «Создать»: квартиры без типа, ЖК уже на сайте, у блока нет планировок. */
export function GeneratorNotes({ layouts, layoutsHref, published, unassigned }: NotesProps) {
  const t = useTranslations("admin.complexes.units.generator");
  const warning =
    layouts.length === 0 ? (
      <>
        {t("noLayouts")} <Link href={layoutsHref}>{t("toLayouts")}</Link>
      </>
    ) : unassigned > 0 ? (
      t("unassigned", { count: unassigned })
    ) : null;
  if (!warning && !published) return null;
  return (
    <ul className="units-generator__notes">
      {warning ? (
        <li className="units-generator__note units-generator__note--warn">{warning}</li>
      ) : null}
      {published ? <li className="units-generator__note">{t("published")}</li> : null}
    </ul>
  );
}

export function GeneratorFeedback({ result }: { result: CreateBlockUnitsResult | null }) {
  const t = useTranslations("admin.complexes.units.generator");
  if (result === null) return null;
  if (result.status === "error") return <ComplexSaveFeedback state={result} />;
  return <FormStatus tone="success">{t("created", { count: result.created })}</FormStatus>;
}
