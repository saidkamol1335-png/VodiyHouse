"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormStatus } from "@/components/FormStatus";
import { MediaDrop } from "@/components/MediaDrop";
import { Rule12Check } from "@/components/Rule12Check";
import { ConfirmRow } from "./ConfirmRow";
import { uploadComplexFile } from "@/lib/admin/complexes/upload";
import type { ContentErrorCode } from "@/lib/admin/developers/errors";
import type { FacadeActions, FacadeImage as Image } from "@/lib/admin/facade/types";
import { UploadRefused } from "@/lib/admin/storageUpload";
import type { ProcessedImage } from "@/lib/media";

type FacadeImageProps = {
  complexId: string;
  published: boolean;
  facade: Image | null;
  actions: FacadeActions;
  onChanged: () => void;
};

/** Фасад ЖК: широкая зона загрузки (как фото), у опубликованного ЖК — с отметкой правила 1.2. */
export function FacadeImage({ complexId, published, facade, actions, onChanged }: FacadeImageProps) {
  const t = useTranslations("admin.complexes.facade");
  const tErrors = useTranslations("admin.developers.errors");
  const [rule12, setRule12] = useState(false);
  const [error, setError] = useState<ContentErrorCode | null>(null);
  const [confirming, setConfirming] = useState(false);
  const upload = async (image: ProcessedImage) => {
    setError(null);
    try {
      await uploadComplexFile({ complexId, image, attach: actions.setFacade, rule12 });
      setRule12(false);
      onChanged();
    } catch (failure) {
      setError(failure instanceof UploadRefused ? failure.code : "unknown");
    }
  };
  const remove = async () => {
    const result = await actions.removeFacade(complexId);
    setConfirming(false);
    if (result.status === "error") return setError(result.error);
    onChanged();
  };
  return (
    <div className="facade-tab__facade">
      {published ? <Rule12Check id="facade-rule12" checked={rule12} onChange={setRule12} context="facade" /> : null}
      <MediaDrop
        id="facade-image"
        kind="facade"
        variant="wide"
        label={t("facade")}
        disabled={published && !rule12}
        value={facade ? { ...facade, focus: { x: 0.5, y: 0.5 } } : null}
        onPrepared={upload}
        onRemove={() => setConfirming(true)}
      />
      {confirming ? <ConfirmRow question={t("removeFacadeConfirm")} action={t("removeFacade")} onConfirm={remove} onCancel={() => setConfirming(false)} /> : null}
      <p className="field__meta">{t("facadeHint")}</p>
      {error ? <FormStatus tone="error">{tErrors(error)}</FormStatus> : null}
    </div>
  );
}
