"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import { CONTOUR_POINTS, type Point } from "@/lib/admin/facade/contours";
import type { FacadeActions, FacadeBlock, FacadeImage } from "@/lib/admin/facade/types";
import type { ContentErrorCode } from "@/lib/admin/developers/errors";
import { ContourEditor } from "./ContourEditor";
import { ContourTools } from "./ContourTools";

type BlockContoursProps = {
  facade: FacadeImage;
  blocks: FacadeBlock[];
  actions: FacadeActions;
  onChanged: () => void;
};

/** Контуры блоков на фасаде: выбрать блок → обвести его силуэт → «Сохранить контур». */
export function BlockContours({ facade, blocks, actions, onChanged }: BlockContoursProps) {
  const t = useTranslations("admin.complexes.facade");
  const tErrors = useTranslations("admin.developers.errors");
  const [blockId, setBlockId] = useState(blocks[0]?.id ?? null);
  const block = blocks.find((item) => item.id === blockId) ?? null;
  const [points, setPoints] = useState<Point[]>(block?.contour ?? []);
  const [result, setResult] = useState<{ error: ContentErrorCode | null } | null>(null);
  const [pending, startTransition] = useTransition();
  const choose = (next: FacadeBlock) => {
    setBlockId(next.id);
    setPoints(next.contour ?? []);
    setResult(null);
  };
  const save = (contour: Point[] | null) =>
    startTransition(async () => {
      const answer = await actions.setBlockContour(block!.id, contour);
      setResult({ error: answer.status === "error" ? answer.error : null });
      if (answer.status !== "done") return;
      if (contour === null) setPoints([]);
      onChanged();
    });
  if (!block) return <p className="field__meta">{t("noBlocks")}</p>;
  const others = blocks.filter((item) => item.id !== block.id && item.contour).map((item) => ({ key: item.id, label: item.name, points: item.contour! }));
  return (
    <div className="facade-tab__contours">
      <BlockPills blocks={blocks} active={block.id} onChoose={choose} />
      <ContourEditor image={facade} alt={t("facade")} others={others} value={points} onChange={setPoints} />
      <ContourTools points={points} onChange={setPoints}>
        {block.contour ? (
          <Button variant="danger" size="sm" pending={pending} onClick={() => save(null)}>
            {t("removeContour")}
          </Button>
        ) : null}
        <Button size="sm" pending={pending} disabled={points.length < CONTOUR_POINTS.min || points.length > CONTOUR_POINTS.max} onClick={() => save(points)}>
          {t("saveContour")}
        </Button>
      </ContourTools>
      {result ? <FormStatus tone={result.error ? "error" : "success"}>{result.error ? tErrors(result.error) : t("saved")}</FormStatus> : null}
    </div>
  );
}

function BlockPills({ blocks, active, onChoose }: { blocks: FacadeBlock[]; active: string; onChoose: (block: FacadeBlock) => void }) {
  const t = useTranslations("admin.complexes.facade");
  return (
    <div className="facade-tab__pills" role="group" aria-label={t("contours")}>
      {blocks.map((item) => (
        <button key={item.id} type="button" className="facade-tab__pill" aria-pressed={item.id === active} onClick={() => onChoose(item)}>
          {t("block", { name: item.name })}
          <small>{item.contour ? t("hasContour") : t("noContour")}</small>
        </button>
      ))}
    </div>
  );
}
