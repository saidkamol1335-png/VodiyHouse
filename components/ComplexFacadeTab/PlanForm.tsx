"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import { MediaDrop } from "@/components/MediaDrop";
import { Rule12Check } from "@/components/Rule12Check";
import { uploadComplexFile } from "@/lib/admin/complexes/upload";
import type { ContentErrorCode } from "@/lib/admin/developers/errors";
import { parseFloorRange } from "@/lib/admin/facade/contours";
import type { FacadeActions, FacadeBlock, FacadePlan } from "@/lib/admin/facade/types";
import { UploadRefused } from "@/lib/admin/storageUpload";
import type { ProcessedImage } from "@/lib/media";

type PlanFormProps = {
  complexId: string;
  published: boolean;
  block: FacadeBlock;
  /** null — новый план: этажи и подъезд, затем картинка. */
  plan: FacadePlan | null;
  actions: FacadeActions;
  onChanged: () => void;
};

/**
 * Подъезд и этажи плана, картинка. Новый план сохраняется вместе с картинкой (без неё плана нет);
 * у готового — «Сохранить этажи» и «Заменить картинку» (контуры квартир тогда рисуются заново).
 */
export function PlanForm(props: PlanFormProps) {
  const t = useTranslations("admin.complexes.facade");
  const { published, block, plan } = props;
  const { id, entrance, setEntrance, from, setFrom, to, setTo, rule12, setRule12, error, range, upload, saveFloors } = usePlanForm(props);
  const [saving, startSaving] = useTransition();
  return (
    <div className="facade-tab__plan-form">
      <PlanFields id={id} block={block} entrance={entrance} from={from} to={to} onEntrance={setEntrance} onFrom={setFrom} onTo={setTo}>
        {plan ? (
          <Button variant="outline" size="sm" pending={saving} onClick={() => startSaving(saveFloors)}>
            {t("savePlan")}
          </Button>
        ) : null}
      </PlanFields>
      {published ? <Rule12Check id={`${id}-rule12`} checked={rule12} onChange={setRule12} context="facade" /> : null}
      <MediaDrop
        id={`${id}-image`}
        kind="floor_plan"
        variant="wide"
        label={plan ? t("replaceImage") : t("image")}
        disabled={(published && !rule12) || !range}
        value={null}
        onPrepared={upload}
        onRemove={() => undefined}
      />
      <p className="field__meta">{plan ? t("replaceHint") : t("plansHint")}</p>
      {error ? <FormStatus tone="error">{error}</FormStatus> : null}
      {!range && !error ? <p className="field__meta">{t("floorsInvalid", { max: block.floorsTotal ?? 100 })}</p> : null}
    </div>
  );
}

type PlanFieldsProps = {
  id: string;
  block: FacadeBlock;
  entrance: string;
  from: string;
  to: string;
  onEntrance: (value: string) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  children: ReactNode;
};

/** Подъезд («Весь этаж» или подъезд из списка квартир) и этажи «с … по». */
function PlanFields({ id, block, entrance, from, to, onEntrance, onFrom, onTo, children }: PlanFieldsProps) {
  const t = useTranslations("admin.complexes.facade");
  return (
    <div className="facade-tab__fields">
      <label className="field">
        <span className="field__label">{t("entrance")}</span>
        <select className="field__input" value={entrance} onChange={(event) => onEntrance(event.target.value)}>
          <option value="">{t("wholeFloor")}</option>
          {block.entrances.map((value) => (
            <option key={value} value={value}>
              {t("entranceN", { n: value })}
            </option>
          ))}
        </select>
      </label>
      <Field id={`${id}-from`} label={t("floorFrom")} inputMode="numeric" value={from} onChange={(event) => onFrom(event.target.value)} />
      <Field id={`${id}-to`} label={t("floorTo")} inputMode="numeric" value={to} onChange={(event) => onTo(event.target.value)} />
      {children}
    </div>
  );
}

/** Поля плана и сохранение: этажи — сразу, картинка — через бакет и то же действие. */
function usePlanForm({ complexId, block, plan, actions, onChanged }: PlanFormProps) {
  const t = useTranslations("admin.complexes.facade");
  const tErrors = useTranslations("admin.developers.errors");
  const id = plan?.id ?? `new-${block.id}`;
  const [entrance, setEntrance] = useState(plan?.entrance === null || !plan ? "" : String(plan.entrance));
  const [from, setFrom] = useState(String(plan?.floorFrom ?? 1));
  const [to, setTo] = useState(String(plan?.floorTo ?? block.floorsTotal ?? ""));
  const [rule12, setRule12] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const range = parseFloorRange(from, to, block.floorsTotal);
  const fields = (data: FormData) => {
    if (plan) data.append("plan", plan.id);
    data.append("block", block.id);
    data.append("entrance", entrance);
    data.append("from", from);
    data.append("to", to);
    return data;
  };
  // Пересечение этажей с другим планом блока — своим текстом, а не общим «уже есть».
  const refused = (code: ContentErrorCode) => setError(code === "duplicate" ? t("floorsTaken") : tErrors(code));
  const upload = async (image: ProcessedImage) => {
    if (!range) return setError(t("floorsInvalid", { max: block.floorsTotal ?? 100 }));
    setError(null);
    try {
      await uploadComplexFile({ complexId, image, attach: (data) => actions.savePlan(fields(data)), rule12 });
      setRule12(false);
      onChanged();
    } catch (failure) {
      refused(failure instanceof UploadRefused ? failure.code : "unknown");
    }
  };
  const saveFloors = async () => {
    if (!range) return setError(t("floorsInvalid", { max: block.floorsTotal ?? 100 }));
    const result = await actions.savePlan(fields(new FormData()));
    if (result.status === "error") return refused(result.error);
    setError(null);
    onChanged();
  };
  return { id, entrance, setEntrance, from, setFrom, to, setTo, rule12, setRule12, error, range, upload, saveFloors };
}
