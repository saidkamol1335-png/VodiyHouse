"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { submitProgressReportAction } from "@/lib/admin/actions/progressReports";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import type { ProgressFix, ProgressFormComplex } from "@/lib/admin/progress/types";
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

/** Исправление — как в отчёте; блок отчёта с тех пор сдан — последний строящийся, без квартиры. */
function initialTarget(
  complexes: readonly ProgressFormComplex[],
  months: readonly string[],
  fix: ProgressFix | null,
): ReportTargetValue {
  if (!fix) {
    return {
      complexId: complexes[0]?.id ?? "",
      month: months[0] ?? "",
      blockId: lastBlock(complexes[0]),
      unitId: "",
    };
  }
  const complex = complexes.find((item) => item.id === fix.complexId);
  const building = complex?.blocks.some((block) => block.id === fix.blockId) ?? false;
  return building
    ? { complexId: fix.complexId, month: fix.month, blockId: fix.blockId, unitId: fix.unitId ?? "" }
    : { complexId: fix.complexId, month: fix.month, blockId: lastBlock(complex), unitId: "" };
}

/** ЖК, месяц, блок, квартира и фото этого ЖК: другой ЖК — блок последний, квартира и фото с нуля. */
function useReportTarget(
  complexes: readonly ProgressFormComplex[],
  months: readonly string[],
  onChange: () => void,
  fix: ProgressFix | null,
) {
  const [target, setTarget] = useState<ReportTargetValue>(() =>
    initialTarget(complexes, months, fix),
  );
  const queue = usePhotoQueue(target.complexId || null, fix?.photos);
  const { video, pick, remove } = useVideoUpload(target.complexId || null, fix?.videoPath ?? null);
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
 * свежие «Мои отчёты» (router.refresh); исправленный возвращённый отчёт — обратно на экран без ?fix.
 */
export function useReportForm(
  complexes: readonly ProgressFormComplex[],
  months: readonly string[],
  fix: ProgressFix | null = null,
) {
  const t = useTranslations("admin.video.form");
  const tError = useTranslations("admin.developers.errors");
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [sent, setSent] = useState(false);
  const { target, change, queue, video, clear } = useReportTarget(
    complexes,
    months,
    () => setSent(false),
    fix,
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
    if (fix) data.set("id", fix.id);
    start(async () => {
      const result = await submitProgressReportAction(data);
      if (result.status === "error") return setIssues({ form: tError(result.error) });
      if (fix) return router.replace(ADMIN_ROUTES.video);
      clear();
      setRound((value) => value + 1);
      setSent(true);
      router.refresh();
    });
  };

  return { form, round, target, change, queue, video, issues, sent, pending, submit };
}
