"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  DEFAULT_FOCUS,
  hasExif,
  processImage,
  type FocusPoint,
  type MediaIssue,
  type MediaKind,
  type ProcessedImage,
} from "@/lib/media";

// Состояние стенда /dev/media: файл и вид → подготовка в браузере → факты и точка фокуса.

export type Prepared = {
  image: ProcessedImage;
  url: string;
  sourceExif: boolean;
  storedExif: boolean;
  milliseconds: number;
};

export type LabState =
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

/** Выбор файла и вида; смена любого — новая подготовка того же файла. */
export function useMediaLab() {
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
  return { kind, state, focus, setFocus, chooseFile, chooseKind };
}
