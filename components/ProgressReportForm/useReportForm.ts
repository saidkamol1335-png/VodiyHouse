"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { submitProgressReportAction } from "@/lib/admin/actions/progressReports";
import type { ProgressFormComplex } from "@/lib/admin/progress/types";
import { PHOTOS_MIN, usePhotoQueue } from "@/lib/admin/progress/usePhotoQueue";
import { useVideoUpload } from "@/lib/admin/progress/useVideoUpload";
import type { ReportTargetValue } from "./ReportTarget";

export type ReportIssues = { photos?: string; video?: string; comment?: string; form?: string };

/** Мокап: при смене ЖК блок — последний (самый свежий), квартира и фото сбрасываются. */
const lastBlock = (complex: ProgressFormComplex | undefined) => complex?.blocks.at(-1)?.id ?? "";

const hasComment = (data: FormData) =>
  Boolean(
    String(data.get("comment.ru") ?? "").trim() && String(data.get("comment.uz") ?? "").trim(),
  );

/** Что мешает отправить: фото (3–15, загружены), видео (загружено, не вместе со ссылкой), комментарий. */
function issuesOf(
  data: FormData,
  queue: { working: boolean; photos: readonly unknown[] },
  videoStatus: string,
  t: (key: "photosWait" | "photosMin" | "videoWait" | "videoBoth" | "commentMissing") => string,
): ReportIssues {
  const photos = queue.working
    ? "photosWait"
    : queue.photos.length < PHOTOS_MIN
      ? "photosMin"
      : null;
  return {
    photos: photos ? t(photos) : undefined,
    video: videoIssue(videoStatus, Boolean(String(data.get("youtube") ?? "").trim()), t),
    comment: hasComment(data) ? undefined : t("commentMissing"),
  };
}

/** Видео ещё грузится или выбраны и файл, и ссылка YouTube — отправлять рано. */
function videoIssue(
  status: string,
  hasLink: boolean,
  t: (key: "videoWait" | "videoBoth") => string,
): string | undefined {
  if (status === "uploading" || status === "offline") return t("videoWait");
  if (status === "done" && hasLink) return t("videoBoth");
  return undefined;
}

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
  const { video, pick, remove } = useVideoUpload(target.complexId || null);
  const change = (patch: Partial<ReportTargetValue>) => {
    onChange();
    if (patch.complexId && patch.complexId !== target.complexId) {
      queue.reset();
      remove();
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
    remove();
    setTarget((current) => ({ ...current, unitId: "" }));
  };
  return { target, change, queue, video: { state: video, pick, remove }, clear };
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
  const { target, change, queue, video, clear } = useReportTarget(complexes, months, () =>
    setSent(false),
  );
  // Поля текста управляемые (счётчик знаков): после отправки форма собирается заново — пустой.
  const [round, setRound] = useState(0);
  const [issues, setIssues] = useState<ReportIssues>({});
  const [pending, start] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const found = issuesOf(data, queue, video.state.status, t);
    setIssues(found);
    setSent(false);
    if (found.photos || found.video || found.comment) return;
    if (video.state.path) data.set("videoPath", video.state.path);
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

  return { form, round, target, change, queue, video, issues, sent, pending, submit };
}
