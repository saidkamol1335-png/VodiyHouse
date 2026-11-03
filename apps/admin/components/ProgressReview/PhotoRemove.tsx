"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { removeProgressPhotoAction } from "@/lib/admin/actions/progressReview";

type PhotoRemoveProps = {
  photoId: string;
  /** Осталось 3 фото — убирать нельзя, подсказка вместо кнопки. */
  disabled: boolean;
  index: number;
};

/** «Убрать кадр» (фаза E, п. 38): руководитель убирает кадр с контактами застройщика вместо возврата. */
export function PhotoRemove({ photoId, disabled, index }: PhotoRemoveProps) {
  const t = useTranslations("admin.video.review");
  const tError = useTranslations("admin.developers.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const remove = () => {
    if (!window.confirm(t("removeFrameConfirm"))) return;
    const data = new FormData();
    data.set("photo", photoId);
    start(async () => {
      const result = await removeProgressPhotoAction(data);
      if (result.status === "error") return setError(tError(result.error));
      router.refresh();
    });
  };
  return (
    <>
      <button
        type="button"
        className="progress-review__remove"
        onClick={remove}
        disabled={disabled || pending}
        title={disabled ? t("removeFrameMin") : undefined}
        aria-label={`${t("removeFrame")} ${index + 1}`}
      >
        <Trash2 size={14} aria-hidden="true" />
        <span>{t("removeFrame")}</span>
      </button>
      {error ? (
        <span className="progress-review__remove-error" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}
