"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { saveProgressDraftAction, submitProgressReportAction } from "@/lib/admin/actions/progressReports";
import type { StaffRole } from "@/lib/admin/access";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import type { ProgressEdit, ProgressFormComplex } from "@/lib/admin/progress/types";
import { usePhotoQueue } from "@/lib/admin/progress/usePhotoQueue";
import { useVideoUpload } from "@/lib/admin/progress/useVideoUpload";
import { hasIssues, reportIssues, type ReportIssues } from "./issues";
import type { ReportTargetValue } from "./ReportTarget";

/** Мокап: при смене ЖК блок — последний (самый свежий), квартира и фото сбрасываются. */
const lastBlock = (complex: ProgressFormComplex | undefined) => complex?.blocks.at(-1)?.id ?? "";

export type ReportStart = { complexId: string | null; blockId: string | null };

/** Правка — как в отчёте (блок с тех пор сдан — последний строящийся); «Снять отчёт» — ЖК и блок задания. */
function initialTarget(
  complexes: readonly ProgressFormComplex[],
  today: string,
  edit: ProgressEdit | null,
  start: ReportStart,
): ReportTargetValue {
  const complexId = edit?.complexId ?? start.complexId ?? complexes[0]?.id ?? "";
  const complex = complexes.find((item) => item.id === complexId) ?? (edit ? undefined : complexes[0]);
  const wanted = edit?.blockId ?? start.blockId;
  const blockId = complex?.blocks.some((block) => block.id === wanted) ? wanted! : lastBlock(complex);
  const keepUnit = Boolean(edit && blockId === edit.blockId);
  return {
    complexId: complex?.id ?? complexId,
    shotOn: edit?.shotOn ?? today,
    blockId,
    unitId: keepUnit ? (edit?.unitId ?? "") : "",
  };
}

type Owner = { userId: string; role: StaffRole };

/** ЖК, дата, блок, квартира и фото этого ЖК: другой ЖК — блок последний, квартира и фото с нуля. */
function useReportTarget(
  complexes: readonly ProgressFormComplex[],
  today: string,
  owner: Owner,
  edit: ProgressEdit | null,
  start: ReportStart,
) {
  const [target, setTarget] = useState<ReportTargetValue>(() => initialTarget(complexes, today, edit, start));
  const queue = usePhotoQueue({ userId: owner.userId, complexId: target.complexId || null }, edit?.photos);
  const { video, pick, remove } = useVideoUpload(
    { userId: owner.userId, complexId: target.complexId || null },
    edit?.videoPath ?? null,
  );
  const change = (patch: Partial<ReportTargetValue>) => {
    if (patch.complexId && patch.complexId !== target.complexId) {
      queue.reset();
      remove();
      const complex = complexes.find((item) => item.id === patch.complexId);
      return setTarget({ ...target, complexId: patch.complexId, blockId: lastBlock(complex), unitId: "" });
    }
    setTarget({ ...target, ...patch, ...(patch.blockId ? { unitId: "" } : {}) });
  };
  return { target, change, queue, video: { state: video, pick, remove } };
}

type Notice = "draftSaved" | "draftPartial" | null;
type Target = ReturnType<typeof useReportTarget>;

/** Форма → данные действия и что мешает сохранить (черновик берёт только уже загруженное). */
function collect(form: HTMLFormElement, kind: "draft" | "submit", { target, queue, video }: Target, id: string | null) {
  const data = new FormData(form);
  const comment = { ru: String(data.get("comment.ru") ?? ""), uz: String(data.get("comment.uz") ?? "") };
  const issues = reportIssues({
    mode: kind,
    shotOn: target.shotOn,
    photosWorking: queue.working,
    photos: queue.photos.length,
    videoStatus: video.state.status,
    hasLink: Boolean(String(data.get("youtube") ?? "").trim()),
    comment,
  });
  if (video.state.status === "done" && video.state.path) data.set("videoPath", video.state.path);
  data.set("blockId", target.blockId);
  data.set("unitId", target.unitId);
  data.set("shotOn", target.shotOn);
  data.set("photos", JSON.stringify(queue.photos));
  if (id) data.set("id", id);
  return { data, issues };
}

/**
 * Состояние формы отчёта (фаза E, пп. 32, 37): «Сохранить черновик» — что уже загружено (после первого
 * сохранения адрес становится ?id=, форма и очередь загрузок не пересоздаются); «На проверку» — полная
 * проверка и отправка: мобилограф — в «Мои отчёты», руководитель — в ящик отчёта.
 */
export function useReportForm(
  complexes: readonly ProgressFormComplex[],
  today: string,
  owner: Owner,
  edit: ProgressEdit | null,
  start: ReportStart,
) {
  const t = useTranslations("admin.video.form");
  const tError = useTranslations("admin.developers.errors");
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const state = useReportTarget(complexes, today, owner, edit, start);
  const [id, setId] = useState<string | null>(edit?.id ?? null);
  const [issues, setIssues] = useState<ReportIssues>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"draft" | "submit">("submit");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const kind = submitter?.value === "draft" ? "draft" : "submit";
    const { data, issues: found } = collect(event.currentTarget, kind, state, id);
    setIssues(found);
    setFailure(null);
    setNotice(null);
    if (hasIssues(found)) return;
    setMode(kind);
    startTransition(async () => {
      const result = await (kind === "draft" ? saveProgressDraftAction : submitProgressReportAction)(data);
      if (result.status === "error") return setFailure(tError(result.error));
      if (result.status === "done") return router.push(sentHref(owner.role, result.id, result.notified));
      setId(result.id);
      // Адрес — ?id= черновика: Next не пересобирает страницу, очередь загрузок живёт.
      if (!id) window.history.replaceState(null, "", `${ADMIN_ROUTES.videoNew}?id=${result.id}`);
      const uploading = state.video.state.status === "uploading" || state.video.state.status === "offline";
      setNotice(state.queue.working || uploading ? "draftPartial" : "draftSaved");
    });
  };

  const issueText = (key: keyof ReportIssues) => (issues[key] ? t(issues[key]!) : undefined);
  return { form, ...state, issueText, failure, notice, pending, mode, submit, id };
}

/** После «На проверку»: руководитель — в ящик своего отчёта, мобилограф — в «Мои отчёты» с итогом. */
const sentHref = (role: StaffRole, id: string, notified: boolean) =>
  role === "head"
    ? `${ADMIN_ROUTES.video}?report=${id}`
    : `${ADMIN_ROUTES.videoMine}?sent=${notified ? "1" : "quiet"}`;
