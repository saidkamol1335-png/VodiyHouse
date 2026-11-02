"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { MEDIA_LIMITS } from "@/lib/media";

type DrawingTileProps = {
  id: string;
  src: string | null;
  busy: boolean;
  /** Нет отметки правила 1.2 у опубликованного ЖК — выбрать файл нельзя. */
  disabled: boolean;
  label: string;
  onPick: (file: File | undefined) => void;
  onRemove: () => void;
};

/** Чертёж в строке планировки (И5): плитка 64×44, «+» — загрузка, тап — крупно в окне. */
export function DrawingTile(props: DrawingTileProps) {
  return props.src ? <FilledTile {...props} src={props.src} /> : <EmptyTile {...props} />;
}

type DrawingInputProps = {
  id: string;
  disabled: boolean;
  onPick: (file: File | undefined) => void;
  /** После выбора файла: окно «крупно» закрывается. */
  onPicked?: () => void;
};

function DrawingInput({ id, disabled, onPick, onPicked }: DrawingInputProps) {
  return (
    <input
      id={id}
      className="drawing-tile__input"
      type="file"
      accept={MEDIA_LIMITS.acceptedTypes.join(",")}
      disabled={disabled}
      onChange={(event) => {
        onPick(event.target.files?.[0]);
        event.target.value = "";
        onPicked?.();
      }}
    />
  );
}

function EmptyTile({ id, busy, disabled, label, onPick }: DrawingTileProps) {
  const t = useTranslations("admin.complexes.layouts");
  return (
    <label
      className="drawing-tile"
      htmlFor={id}
      aria-disabled={disabled || undefined}
      aria-busy={busy}
    >
      <DrawingInput id={id} disabled={disabled || busy} onPick={onPick} />
      {busy ? (
        <span className="drawing-tile__busy">{t("processing")}</span>
      ) : (
        <Plus size={18} aria-label={label} />
      )}
    </label>
  );
}

function FilledTile({ src, ...props }: DrawingTileProps & { src: string }) {
  const t = useTranslations("admin.complexes.layouts");
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        className="drawing-tile drawing-tile--filled"
        aria-label={t("drawingOpen")}
        onClick={() => dialog.current?.showModal()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- превью чертежа в кабинете; next/image — на сайте */}
        <img className="drawing-tile__image" src={src} alt="" loading="lazy" decoding="async" />
      </button>
      <dialog ref={dialog} className="drawing-tile__dialog" aria-label={t("drawingTitle")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- чертёж крупно, как «Клик по чертежу» ТЗ 7.4 */}
        <img
          className="drawing-tile__large"
          src={src}
          alt={t("drawingTitle")}
          loading="lazy"
          decoding="async"
        />
        <DrawingActions {...props} onClose={() => dialog.current?.close()} />
      </dialog>
    </>
  );
}

type DrawingActionsProps = Omit<DrawingTileProps, "src" | "label"> & { onClose: () => void };

function DrawingActions({ id, busy, disabled, onPick, onRemove, onClose }: DrawingActionsProps) {
  const t = useTranslations("admin.complexes.layouts");
  return (
    <div className="drawing-tile__actions">
      <label
        className="button button--ghost button--sm"
        htmlFor={id}
        aria-disabled={disabled || undefined}
      >
        <DrawingInput id={id} disabled={disabled || busy} onPick={onPick} onPicked={onClose} />
        {t("drawingReplace")}
      </label>
      <button
        type="button"
        className="button button--ghost button--sm"
        onClick={() => {
          onRemove();
          onClose();
        }}
      >
        {t("drawingRemove")}
      </button>
      <button type="button" className="button button--ghost button--sm" onClick={onClose}>
        <X size={14} aria-hidden="true" />
        {t("drawingClose")}
      </button>
    </div>
  );
}
