"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, type DetailedError } from "tus-js-client";
import { PROGRESS_VIDEO_BUCKET, progressVideoPath } from "@/lib/media";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

// Видео отчёта с телефона (фаза 5, мокап CabVideo: «если связь оборвётся, загрузка продолжится с того же
// места»): загрузка с докачкой Storage (TUS) частями по 6 МБ — такой размер требует Supabase. Обрыв —
// повторы сами; закрыли вкладку и выбрали тот же файл — загрузка продолжается (отпечаток в браузере).
// Политика Storage: только MP4 в папку существующего ЖК, видеограф и руководитель.

const CHUNK = 6 * 1024 * 1024;
const RETRIES = [0, 3_000, 5_000, 10_000, 20_000, 30_000, 60_000, 60_000, 120_000, 120_000];

export type VideoUploadError = "notMp4" | "tooLarge" | "failed";

export type VideoUploadState = {
  status: "idle" | "uploading" | "offline" | "done" | "error";
  name: string;
  size: number;
  percent: number;
  /** Связь вернулась после обрыва — «докачиваем с N%». */
  resumedAt: number | null;
  path: string | null;
  error: VideoUploadError | null;
};

const IDLE: VideoUploadState = {
  status: "idle",
  name: "",
  size: 0,
  percent: 0,
  resumedAt: null,
  path: null,
  error: null,
};

const statusOf = (error: Error) => (error as DetailedError).originalResponse?.getStatus() ?? 0;

const NO_RETRY = [400, 401, 403, 413];

type Callbacks = {
  update: (patch: Partial<VideoUploadState>) => void;
  /** Сеть пропала и повторы tus кончились: ждём «online», чтобы продолжить с того же места. */
  stall: () => void;
};

/** Загрузка с докачкой; запускает её вызывающий — после проверки, что её ещё не отменили. */
async function prepareUpload(file: File, complexId: string, { update, stall }: Callbacks) {
  const supabase = createSupabaseBrowserClient();
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const path = progressVideoPath(complexId);
  const upload = new Upload(file, {
    endpoint: `${base}/storage/v1/upload/resumable`,
    chunkSize: CHUNK,
    retryDelays: RETRIES,
    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      "x-upsert": "false",
    },
    metadata: {
      bucketName: PROGRESS_VIDEO_BUCKET,
      objectName: path,
      contentType: "video/mp4",
      cacheControl: "31536000",
    },
    // Токен сессии живёт около часа, а загрузка с телефона бывает дольше — свежий перед каждым запросом.
    onBeforeRequest: async (request) => {
      const { data } = await supabase.auth.getSession();
      request.setHeader("authorization", `Bearer ${data.session?.access_token ?? ""}`);
    },
    // Отказ права или лимита повтором не исправить — сразу ошибка.
    onShouldRetry: (error) => !NO_RETRY.includes(statusOf(error)),
    onProgress: (sent, total) => update({ percent: total ? Math.floor((sent / total) * 100) : 0 }),
    onSuccess: () =>
      update({ status: "done", percent: 100, path: upload.options.metadata?.objectName ?? path }),
    onError: (error) => {
      if (!navigator.onLine) return stall();
      update({ status: "error", error: statusOf(error) === 413 ? "tooLarge" : "failed" });
    },
  });
  await resumePrevious(upload, complexId);
  return upload;
}

/** Тот же файл уже начинали грузить в этот ЖК — продолжаем с того места и в тот же путь. */
async function resumePrevious(upload: Upload, complexId: string): Promise<void> {
  const previous = (await upload.findPreviousUploads()).find((item) =>
    item.metadata.objectName?.startsWith(`complexes/${complexId}/`),
  );
  if (!previous) return;
  upload.options.metadata = {
    ...upload.options.metadata,
    objectName: previous.metadata.objectName!,
  };
  upload.resumeFromPreviousUpload(previous);
}

const storedState = (path: string): VideoUploadState => ({
  ...IDLE,
  status: "done",
  name: path.split("/").at(-1) ?? "",
  percent: 100,
  path,
});

/** Одно видео отчёта: выбрать, следить за процентами и обрывом связи, убрать. */
export function useVideoUpload(complexId: string | null, initialPath: string | null = null) {
  // Исправление возвращённого отчёта: его видео уже в бакете.
  const [state, setState] = useState<VideoUploadState>(() =>
    initialPath ? storedState(initialPath) : IDLE,
  );
  const upload = useRef<Upload | null>(null);
  // Номер попытки: убрали видео или сменили ЖК — ответы прежней загрузки форму больше не трогают.
  const attempt = useRef(0);
  const stalled = useRef(false);
  useOnlineStatus(state.status, setState, () => {
    if (!stalled.current) return;
    stalled.current = false;
    upload.current?.start();
  });
  useEffect(() => () => void upload.current?.abort(), []);

  const pick = (file: File) => {
    if (!complexId) return;
    if (file.type !== "video/mp4" && !/\.mp4$/i.test(file.name)) {
      return setState({ ...IDLE, status: "error", name: file.name, error: "notMp4" });
    }
    const mine = ++attempt.current;
    const update = (patch: Partial<VideoUploadState>) => {
      if (attempt.current === mine) setState((current) => ({ ...current, ...patch }));
    };
    const stall = () => {
      stalled.current = true;
      update({ status: "offline" });
    };
    setState({ ...IDLE, status: "uploading", name: file.name, size: file.size });
    void prepareUpload(file, complexId, { update, stall }).then((prepared) => {
      if (attempt.current !== mine) return;
      upload.current = prepared;
      prepared.start();
    });
  };
  // Не загрузилось до конца — загрузка отменяется; загруженный файл останется в папке ЖК.
  const remove = () => {
    attempt.current += 1;
    // Отменять (и стирать на сервере) — только незаконченную: завершённую сервер уже не отдаёт (409).
    if (state.status === "uploading" || state.status === "offline")
      void upload.current?.abort(true);
    upload.current = null;
    stalled.current = false;
    setState(IDLE);
  };
  return { video: state, pick, remove };
}

/**
 * «Связь прервалась на 47%» / «Связь восстановлена — докачиваем с 47%»: пока tus повторяет, он
 * продолжит сам; если повторы кончились без сети — resume запускает загрузку с того же места.
 */
function useOnlineStatus(
  status: VideoUploadState["status"],
  setState: (next: (current: VideoUploadState) => VideoUploadState) => void,
  resume: () => void,
) {
  const resumeRef = useRef(resume);
  useEffect(() => {
    resumeRef.current = resume;
  });
  useEffect(() => {
    if (status !== "uploading" && status !== "offline") return;
    const offline = () => setState((current) => ({ ...current, status: "offline" }));
    const online = () => {
      setState((current) => ({ ...current, status: "uploading", resumedAt: current.percent }));
      resumeRef.current();
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [status, setState]);
}
