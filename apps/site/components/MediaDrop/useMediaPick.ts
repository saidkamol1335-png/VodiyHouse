"use client";

import { useState } from "react";
import { processImage, type MediaIssue, type MediaKind, type ProcessedImage } from "@/lib/media";

export type PickState =
  | { status: "idle" }
  | { status: "busy" }
  /** issue: null — фото подготовлено, но не загрузилось (связь, Storage). */
  | { status: "failed"; issue: MediaIssue | null };

/** Выбор файла → подготовка в браузере (lib/media) → загрузка, которую делает родитель. */
export function useMediaPick(
  kind: MediaKind,
  onPrepared: (image: ProcessedImage) => Promise<void>,
) {
  const [state, setState] = useState<PickState>({ status: "idle" });

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setState({ status: "busy" });
    const result = await processImage(file, kind);
    if (!result.ok) {
      setState({ status: "failed", issue: result.issue });
      return;
    }
    try {
      await onPrepared(result.image);
      setState({ status: "idle" });
    } catch {
      setState({ status: "failed", issue: null });
    }
  };

  return { state, pick };
}
