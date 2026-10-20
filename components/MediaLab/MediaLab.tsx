"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { FocusPreview } from "@/components/FocusPreview";
import { Segmented, segmentedItemClass } from "@/components/Segmented";
import { formatFileSize } from "@/lib/format";
import {
  DEFAULT_FOCUS,
  MEDIA_KINDS,
  MEDIA_LIMITS,
  canBeComplexCover,
  hasExif,
  processImage,
  type FocusPoint,
  type MediaIssue,
  type MediaKind,
  type ProcessedImage,
} from "@/lib/media";

type Prepared = {
  image: ProcessedImage;
  url: string;
  sourceExif: boolean;
  storedExif: boolean;
  milliseconds: number;
};

type LabState =
  | { status: "idle" }
  | { status: "processing" }
  | { status: "rejected"; issue: MediaIssue }
  | ({ status: "ready" } & Prepared);

const exifOf = async (blob: Blob) => hasExif(new Uint8Array(await blob.arrayBuffer()));

async function prepare(file: File, kind: MediaKind): Promise<LabState> {
  const started = performance.now();
  const result = await processImage(file, kind);
  if (!result.ok) return { status: "rejected", issue: result.issue };
  const [sourceExif, storedExif] = await Promise.all([exifOf(file), exifOf(result.image.blob)]);
  return {
    status: "ready",
    image: result.image,
    url: URL.createObjectURL(result.image.blob),
    sourceExif,
    storedExif,
    milliseconds: Math.round(performance.now() - started),
  };
}

/** /dev/media: стенд подготовки фото перед загрузкой (шаг 9). Только разработка. */
export function MediaLab() {
  const t = useTranslations("admin.media");
  const [kind, setKind] = useState<MediaKind>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<LabState>({ status: "idle" });
  const [focus, setFocus] = useState<FocusPoint>(DEFAULT_FOCUS);
  // Быстрая смена вида — несколько подготовок подряд: показываем только последнюю.
  const runId = useRef(0);

  useEffect(
    () => () => (state.status === "ready" ? URL.revokeObjectURL(state.url) : undefined),
    [state],
  );

  const run = async (nextFile: File, nextKind: MediaKind) => {
    const id = (runId.current += 1);
    setState({ status: "processing" });
    const next = await prepare(nextFile, nextKind);
    if (id !== runId.current) return;
    setState(next);
    setFocus(DEFAULT_FOCUS);
  };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    setFile(chosen);
    if (chosen) void run(chosen, kind);
  };

  const chooseKind = (nextKind: MediaKind) => {
    setKind(nextKind);
    if (file) void run(file, nextKind);
  };

  return (
    <main className="media-lab">
      <h1 className="media-lab__title">Подготовка фото перед загрузкой</h1>
      <p className="media-lab__lead">
        Служебная страница шага 9: проверка, уменьшение до 3200 px, без EXIF, blur и точка фокуса. В
        бакет ничего не уходит.
      </p>
      <div className="media-lab__controls">
        <div className="media-lab__kinds">
          <Segmented label="Вид файла">
            {MEDIA_KINDS.map((option) => (
              <button
                key={option}
                type="button"
                className={segmentedItemClass(option === kind)}
                aria-pressed={option === kind}
                onClick={() => chooseKind(option)}
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
          onChange={chooseFile}
          data-testid="media-input"
        />
      </div>
      <MediaLabState state={state} focus={focus} onFocusChange={setFocus} />
    </main>
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
        Готовлю фото…
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

function MediaLabFacts({ prepared }: { prepared: Prepared }) {
  const { image, sourceExif, storedExif, milliseconds } = prepared;
  const facts: [string, string, string][] = [
    [
      "Исходник",
      `${image.source.width} × ${image.source.height} · ${formatFileSize(image.source.bytes)}`,
      "source",
    ],
    [
      "В бакет",
      `${image.width} × ${image.height} · ${formatFileSize(image.blob.size)} · ${image.type}`,
      "stored",
    ],
    [
      "EXIF",
      `исходник — ${sourceExif ? "есть" : "нет"}, в бакет — ${storedExif ? "есть" : "нет"}`,
      "exif",
    ],
    ["Blur", `${image.blur.length} символов`, "blur"],
    ["Время", `${milliseconds} мс`, "time"],
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
