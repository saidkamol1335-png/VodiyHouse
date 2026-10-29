"use client";

import { Film, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { VideoUploadState } from "@/lib/admin/progress/useVideoUpload";
import { formatFileSize } from "@/lib/format";

type ReportVideoProps = {
  video: VideoUploadState;
  onPick: (file: File) => void;
  onRemove: () => void;
};

/**
 * «Видео» (мокап CabVideo .drop / .upl): пусто — зона «Загрузить видео с телефона»; идёт загрузка —
 * карточка с именем, процентом и полосой; обрыв связи и докачка — строкой под полосой.
 */
export function ReportVideo({ video, onPick, onRemove }: ReportVideoProps) {
  const t = useTranslations("admin.video.form");
  if (video.status === "idle" || (video.status === "error" && video.error === "notMp4")) {
    return <VideoDrop notMp4={video.error === "notMp4"} onPick={onPick} />;
  }
  return (
    <div className="progress-form__field">
      <span className="progress-form__label">{t("video")}</span>
      <div className={`progress-form__upload progress-form__upload--${video.status}`}>
        <Film size={18} aria-hidden="true" />
        <span className="progress-form__upload-name">{video.name}</span>
        <span className="progress-form__upload-percent">{video.percent}%</span>
        <button
          type="button"
          className="progress-form__upload-remove"
          aria-label={t("videoRemove")}
          onClick={onRemove}
        >
          <X size={16} aria-hidden="true" />
        </button>
        <span className="progress-form__upload-bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${video.percent / 100})` }} />
        </span>
      </div>
      <p
        className={`progress-form__upload-note progress-form__upload-note--${video.status}`}
        role="status"
      >
        {noteOf(video, t)}
      </p>
    </div>
  );
}

/** «Загрузить видео с телефона · MP4 · если связь оборвётся, загрузка продолжится с того же места». */
function VideoDrop({ notMp4, onPick }: { notMp4: boolean; onPick: (file: File) => void }) {
  const t = useTranslations("admin.video.form");
  return (
    <div className="progress-form__field">
      <span className="progress-form__label">{t("video")}</span>
      <label className="progress-form__drop">
        <Upload size={22} aria-hidden="true" />
        <span className="progress-form__drop-title">{t("videoDrop")}</span>
        <span className="progress-form__drop-hint">{t("videoDropHint")}</span>
        <input
          type="file"
          accept="video/mp4"
          onChange={(event) => event.target.files?.[0] && onPick(event.target.files[0])}
        />
      </label>
      {notMp4 ? (
        <p className="progress-form__error" role="alert">
          {t("videoNotMp4")}
        </p>
      ) : null}
    </div>
  );
}

function noteOf(
  video: VideoUploadState,
  t: ReturnType<typeof useTranslations<"admin.video.form">>,
): string {
  if (video.status === "done") return t("videoDone");
  if (video.status === "offline") return t("videoOffline", { percent: video.percent });
  if (video.status === "error")
    return video.error === "tooLarge" ? t("videoTooLarge") : t("videoFailed");
  if (video.resumedAt !== null) return t("videoResumed", { percent: video.resumedAt });
  return t("videoStarted", { size: formatFileSize(video.size) });
}
