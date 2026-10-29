"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { submitProgressReportAction } from "@/lib/admin/actions/progressReports";
import type { ProgressFormComplex } from "@/lib/admin/progress/types";
import { PHOTOS_MIN, usePhotoQueue } from "@/lib/admin/progress/usePhotoQueue";
import type { ReportTargetValue } from "./ReportTarget";

export type ReportIssues = { photos?: string; comment?: string; form?: string };

/** Мокап: при смене ЖК блок — последний (самый свежий), квартира и фото сбрасываются. */
const lastBlock = (complex: ProgressFormComplex | undefined) => complex?.blocks.at(-1)?.id ?? "";

const hasComment = (data: FormData) =>
  Boolean(
    String(data.get("comment.ru") ?? "").trim() && String(data.get("comment.uz") ?? "").trim(),
  );

/** ЖК, месяц, блок, квартира и фото этого ЖК: другой ЖК — блок последний, квартира и фото с нуля. */
function useReportTarget(
  complexes: readonly ProgressFormComplex[],
  months: readonly [string, string],
  onChange: () => void,
) {
  const [target, setTarget] = useState<ReportTargetValue>({
    complexId: complexes[0]?.id ?? "",
    month: months[0],
    blockId: lastBlock(complexes[0]),
    unitId: "",
  });
  const queue = usePhotoQueue(target.complexId || null);
  const change = (patch: Partial<ReportTargetValue>) => {
    onChange();
    if (patch.complexId && patch.complexId !== target.complexId) {
      queue.reset();
      const complex = complexes.find((item) => item.id === patch.complexId);
      return setTarget({
        ...target,
        complexId: patch.complexId,
        blockId: lastBlock(complex),
        unitId: "",
      });
    }
    setTarget({ ...target, ...patch, ...(patch.blockId ? { unitId: "" } : {}) });
  };
  const clear = () => {
    queue.reset();
    setTarget((current) => ({ ...current, unitId: "" }));
  };
  return { target, change, queue, clear };
}

/**
 * Состояние «Нового отчёта»: ЖК, месяц, блок, квартира, очередь фото; проверка перед отправкой
 * (3–15 фото загружены, комментарий на двух языках) и отправка. После «Отправлено» — пустая форма и
 * свежие «Мои отчёты» (router.refresh).
 */
export function useReportForm(
  complexes: readonly ProgressFormComplex[],
  months: readonly [string, string],
) {
  const t = useTranslations("admin.video.form");
  const tError = useTranslations("admin.developers.errors");
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [sent, setSent] = useState(false);
  const { target, change, queue, clear } = useReportTarget(complexes, months, () => setSent(false));
  // Поля текста управляемые (счётчик знаков): после отправки форма собирается заново — пустой.
  const [round, setRound] = useState(0);
  const [issues, setIssues] = useState<ReportIssues>({});
  const [pending, start] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const photos = queue.working
      ? t("photosWait")
      : queue.photos.length < PHOTOS_MIN
        ? t("photosMin")
        : undefined;
    const comment = hasComment(data) ? undefined : t("commentMissing");
    setIssues({ photos, comment });
    setSent(false);
    if (photos || comment) return;
    data.set("blockId", target.blockId);
    data.set("unitId", target.unitId);
    data.set("month", target.month);
    data.set("photos", JSON.stringify(queue.photos));
    start(async () => {
      const result = await submitProgressReportAction(data);
      if (result.status === "error") return setIssues({ form: tError(result.error) });
      clear();
      setRound((value) => value + 1);
      setSent(true);
      router.refresh();
    });
  };

  return { form, round, target, change, queue, issues, sent, pending, submit };
}
