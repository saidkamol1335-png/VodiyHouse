"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import type { ContentErrorCode } from "@/lib/admin/developers/errors";
import type { FacadeActions, FacadeBlock, FacadePlan } from "@/lib/admin/facade/types";
import { ConfirmRow } from "./ConfirmRow";
import { PlanForm } from "./PlanForm";
import { PlanUnits } from "./PlanUnits";

type FloorPlansProps = {
  complexId: string;
  published: boolean;
  blocks: FacadeBlock[];
  plans: FacadePlan[];
  actions: FacadeActions;
  onChanged: () => void;
};

/** Планы этажей по блокам: список планов блока (этажи, картинка, квартиры) и «Новый план». */
export function FloorPlans({ complexId, published, blocks, plans, actions, onChanged }: FloorPlansProps) {
  const t = useTranslations("admin.complexes.facade");
  const [blockId, setBlockId] = useState(blocks[0]?.id ?? null);
  const block = blocks.find((item) => item.id === blockId) ?? null;
  if (!block) return <p className="field__meta">{t("noBlocks")}</p>;
  const own = plans.filter((plan) => plan.blockId === block.id);
  return (
    <div className="facade-tab__plans">
      <div className="facade-tab__pills" role="group" aria-label={t("plans")}>
        {blocks.map((item) => (
          <button key={item.id} type="button" className="facade-tab__pill" aria-pressed={item.id === block.id} onClick={() => setBlockId(item.id)}>
            {t("block", { name: item.name })}
            <small>{plans.filter((plan) => plan.blockId === item.id).length}</small>
          </button>
        ))}
      </div>
      {block.slots.length === 0 ? <FormStatus tone="notice">{t("noUnits")}</FormStatus> : null}
      {own.map((plan) => (
        <PlanCard key={plan.id} complexId={complexId} published={published} block={block} plan={plan} actions={actions} onChanged={onChanged} />
      ))}
      <details className="facade-tab__card" open={own.length === 0}>
        <summary className="facade-tab__card-title">{t("newPlan")}</summary>
        <PlanForm key={`${block.id}-${own.length}`} complexId={complexId} published={published} block={block} plan={null} actions={actions} onChanged={onChanged} />
      </details>
    </div>
  );
}

type PlanCardProps = { complexId: string; published: boolean; block: FacadeBlock; plan: FacadePlan; actions: FacadeActions; onChanged: () => void };

function PlanCard({ complexId, published, block, plan, actions, onChanged }: PlanCardProps) {
  const t = useTranslations("admin.complexes.facade");
  const tErrors = useTranslations("admin.developers.errors");
  const [error, setError] = useState<ContentErrorCode | null>(null);
  const [confirming, setConfirming] = useState(false);
  const remove = async () => {
    const result = await actions.deletePlan(plan.id);
    setConfirming(false);
    if (result.status === "error") return setError(result.error);
    onChanged();
  };
  const entrance = plan.entrance === null ? t("wholeFloor") : t("entranceN", { n: plan.entrance });
  return (
    <details className="facade-tab__card">
      <summary className="facade-tab__card-title">
        {t("planTitle", { entrance, from: plan.floorFrom, to: plan.floorTo })}
        <small>{t("contoursCount", { done: plan.contours.length, total: block.slots.filter((slot) => plan.entrance === null || slot.entrance === plan.entrance).length })}</small>
      </summary>
      <PlanUnits key={`${plan.id}-${plan.image.src}-${plan.entrance}`} block={block} plan={plan} actions={actions} onChanged={onChanged} />
      <PlanForm key={`${plan.id}-form`} complexId={complexId} published={published} block={block} plan={plan} actions={actions} onChanged={onChanged} />
      {confirming ? (
        <ConfirmRow question={t("deletePlanConfirm")} action={t("deletePlan")} onConfirm={remove} onCancel={() => setConfirming(false)} />
      ) : (
        <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
          {t("deletePlan")}
        </Button>
      )}
      {error ? <FormStatus tone="error">{tErrors(error)}</FormStatus> : null}
    </details>
  );
}
