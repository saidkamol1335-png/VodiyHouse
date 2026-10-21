"use client";

import { useState, type DragEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Plus, Upload, X } from "lucide-react";
import { FocusPreview } from "@/components/FocusPreview";
import {
  MEDIA_KIND_RULES,
  MEDIA_LIMITS,
  type FocusPoint,
  type MediaKind,
  type ProcessedImage,
} from "@/lib/media";
import { useMediaPick, type PickState } from "./useMediaPick";

/** Уже загруженное фото: адрес, размер и точка фокуса из media_assets. */
export type MediaPreview = { src: string; width: number; height: number; focus: FocusPoint };

type MediaDropProps = {
  id: string;
  kind: MediaKind;
  label: string;
  /** tile — плитка «+» 96 px (логотип), wide — широкая зона (фон, фото) — решение Д4. */
  variant: "tile" | "wide";
  value: MediaPreview | null;
  /** Родитель кладёт файл в бакет и обновляет value; ошибка — «не получилось загрузить». */
  onPrepared: (image: ProcessedImage) => Promise<void>;
  onRemove: () => void;
  onFocusChange?: (focus: FocusPoint) => void;
  /**
   * Нельзя выбрать новый файл: нет отметки правила 1.2 у опубликованного застройщика. «Удалить» и
   * точка фокуса остаются — они ничего нового на сайт не кладут.
   */
  disabled?: boolean;
};

const MEGABYTE = 1024 * 1024;

export function MediaDrop(props: MediaDropProps) {
  const t = useTranslations("admin.media");
  const { state, pick } = useMediaPick(props.kind, props.onPrepared);
  const hint = t("hint", {
    minLongSide: MEDIA_KIND_RULES[props.kind].minLongSide,
    maxMegabytes: MEDIA_LIMITS.maxSourceBytes / MEGABYTE,
  });

  return (
    <div
      className={`media-drop media-drop--${props.variant}${props.disabled ? " media-drop--locked" : ""}`}
    >
      <label className="field__label" htmlFor={props.id}>
        {props.label}
      </label>
      <input
        id={props.id}
        className="media-drop__input"
        type="file"
        accept={MEDIA_LIMITS.acceptedTypes.join(",")}
        disabled={props.disabled}
        onChange={(event) => {
          void pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <DropTarget onFile={pick} disabled={props.disabled}>
        {props.variant === "tile" ? (
          <Tile {...props} busy={state.status === "busy"} />
        ) : (
          <Wide {...props} busy={state.status === "busy"} hint={hint} />
        )}
      </DropTarget>
      {props.variant === "tile" ? <p className="media-drop__hint">{hint}</p> : null}
      <PickIssue state={state} />
    </div>
  );
}

type DropTargetProps = {
  children: ReactNode;
  onFile: (file?: File) => void;
  /** Без обработчиков браузер сам покажет «нельзя» и файл не примет. */
  disabled?: boolean;
};

/** Перетаскивание файла на десктопе; на телефоне — обычный выбор файла. */
function DropTarget({ children, onFile, disabled }: DropTargetProps) {
  const [dragging, setDragging] = useState(false);
  if (disabled) return <div className="media-drop__target">{children}</div>;
  const over = (event: DragEvent) => {
    event.preventDefault();
    setDragging(true);
  };
  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    onFile(event.dataTransfer.files[0]);
  };
  return (
    <div
      className={
        dragging ? "media-drop__target media-drop__target--dragging" : "media-drop__target"
      }
      onDragOver={over}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
    >
      {children}
    </div>
  );
}

type PartProps = MediaDropProps & { busy: boolean };

function Tile({ id, value, busy, disabled, onRemove }: PartProps) {
  const t = useTranslations("admin.media");
  if (!value) {
    return (
      <label
        className="media-drop__tile"
        htmlFor={id}
        aria-busy={busy}
        aria-disabled={disabled || undefined}
        data-testid={`${id}-pick`}
      >
        {busy ? (
          <span className="media-drop__busy">{t("processing")}</span>
        ) : (
          <Plus size={22} aria-label={t("add")} />
        )}
      </label>
    );
  }
  return (
    <div className="media-drop__tile media-drop__tile--filled">
      <label
        htmlFor={id}
        className="media-drop__tile-pick"
        aria-label={t("replace")}
        aria-disabled={disabled || undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- превью до загрузки — blob: URL */}
        <img className="media-drop__tile-image" src={value.src} alt="" />
      </label>
      <button
        type="button"
        className="media-drop__remove"
        aria-label={t("remove")}
        onClick={onRemove}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

function Wide(props: PartProps & { hint: string }) {
  const { id, value, busy, hint, disabled, onRemove, onFocusChange } = props;
  const t = useTranslations("admin.media");
  if (!value) {
    return (
      <label
        className="media-drop__zone"
        htmlFor={id}
        aria-busy={busy}
        aria-disabled={disabled || undefined}
        data-testid={`${id}-pick`}
      >
        <span className="media-drop__icon" aria-hidden="true">
          <Upload size={18} />
        </span>
        <b className="media-drop__title">{busy ? t("processing") : t("upload")}</b>
        <span className="media-drop__hint">{hint}</span>
        <span className="media-drop__hint media-drop__hint--desktop">{t("dropHint")}</span>
      </label>
    );
  }
  return (
    <div className="media-drop__filled">
      <FocusPreview
        src={value.src}
        size={value}
        focus={value.focus}
        onFocusChange={onFocusChange ?? (() => {})}
      />
      <div className="media-drop__actions">
        <label
          htmlFor={id}
          className="button button--ghost button--sm"
          aria-disabled={disabled || undefined}
        >
          {busy ? t("processing") : t("replace")}
        </label>
        <button type="button" className="button button--ghost button--sm" onClick={onRemove}>
          {t("remove")}
        </button>
      </div>
    </div>
  );
}

function PickIssue({ state }: { state: PickState }) {
  const t = useTranslations("admin.media");
  if (state.status !== "failed") return null;
  return (
    <p className="media-drop__issue" role="alert">
      {state.issue ? t(`issues.${state.issue.code}`, state.issue) : t("uploadFailed")}
    </p>
  );
}
