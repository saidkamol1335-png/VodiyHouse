"use client";

import type { ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { FocusPreview } from "@/components/FocusPreview";
import { Segmented, segmentedItemClass } from "@/components/Segmented";
import { formatFileSize } from "@/lib/format";
import {
  MEDIA_KINDS,
  MEDIA_LIMITS,
  canBeComplexCover,
  type FocusPoint,
  type MediaKind,
} from "@/lib/media";
import { useMediaLab, type LabState, type Prepared } from "./useMediaLab";

/** /dev/media: стенд подготовки фото перед загрузкой (шаг 9). Только разработка. */
export function MediaLab() {
  const lab = useTranslations("admin.dev.media");
  const { kind, state, focus, setFocus, chooseFile, chooseKind } = useMediaLab();
  return (
    <main className="media-lab">
      <h1 className="media-lab__title">{lab("title")}</h1>
      <p className="media-lab__lead">{lab("lead")}</p>
      <MediaLabControls kind={kind} onKind={chooseKind} onFile={chooseFile} />
      <MediaLabState state={state} focus={focus} onFocusChange={setFocus} />
    </main>
  );
}

type ControlsProps = {
  kind: MediaKind;
  onKind: (kind: MediaKind) => void;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
};

function MediaLabControls({ kind, onKind, onFile }: ControlsProps) {
  const t = useTranslations("admin.media");
  const lab = useTranslations("admin.dev.media");
  return (
    <div className="media-lab__controls">
      <div className="media-lab__kinds">
        <Segmented label={lab("kindLabel")}>
          {MEDIA_KINDS.map((option) => (
            <button
              key={option}
              type="button"
              className={segmentedItemClass(option === kind)}
              aria-pressed={option === kind}
              onClick={() => onKind(option)}
            >
              {t(`kinds.${option}`)}
            </button>
          ))}
        </Segmented>
      </div>
      <input
        className="media-lab__input"
        type="file"
        accept={MEDIA_LIMITS.acceptedTypes.join(",")}
        onChange={onFile}
        aria-label={t("fileLabel")}
        data-testid="media-input"
      />
    </div>
  );
}

type MediaLabStateProps = {
  state: LabState;
  focus: FocusPoint;
  onFocusChange: (focus: FocusPoint) => void;
};

function MediaLabState({ state, focus, onFocusChange }: MediaLabStateProps) {
  const t = useTranslations("admin.media");
  if (state.status === "idle") return null;
  if (state.status === "processing") {
    return (
      <p className="media-lab__status" role="status">
        {t("processing")}
      </p>
    );
  }
  if (state.status === "rejected") {
    return (
      <p className="media-lab__issue" role="alert" data-testid="media-issue">
        {t(`issues.${state.issue.code}`, state.issue)}
      </p>
    );
  }
  return (
    <section className="media-lab__result" data-testid="media-result">
      <MediaLabFacts prepared={state} />
      {canBeComplexCover(state.image) ? null : (
        <p className="media-lab__note" data-testid="media-not-cover">
          {t("notCover", { minLongSide: MEDIA_LIMITS.complexCoverMinLongSide })}
        </p>
      )}
      <FocusPreview
        src={state.url}
        size={state.image}
        focus={focus}
        onFocusChange={onFocusChange}
      />
    </section>
  );
}

const yesNo = (value: boolean) => (value ? "yes" : "no");

function MediaLabFacts({ prepared }: { prepared: Prepared }) {
  const t = useTranslations("admin.dev.media.facts");
  const { image, sourceExif, storedExif, milliseconds } = prepared;
  const facts: [string, string, string][] = [
    [
      t("source"),
      `${image.source.width} × ${image.source.height} · ${formatFileSize(image.source.bytes)}`,
      "source",
    ],
    [
      t("stored"),
      `${image.width} × ${image.height} · ${formatFileSize(image.blob.size)} · ${image.type}`,
      "stored",
    ],
    [t("exif"), t("exifValue", { source: yesNo(sourceExif), stored: yesNo(storedExif) }), "exif"],
    [t("blur"), t("blurValue", { count: image.blur.length }), "blur"],
    [t("time"), t("timeValue", { ms: milliseconds }), "time"],
  ];
  return (
    <div className="media-lab__summary">
      <dl className="media-lab__facts">
        {facts.map(([label, value, key]) => (
          <div key={key} className="media-lab__fact">
            <dt className="media-lab__fact-label">{label}</dt>
            <dd className="media-lab__fact-value" data-testid={`fact-${key}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL заглушки, как увидит её next/image */}
      <img className="media-lab__blur" src={image.blur} alt="" data-testid="media-blur" />
    </div>
  );
}
