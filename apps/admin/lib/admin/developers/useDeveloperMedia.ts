"use client";

import type { MediaPreview } from "@/components/MediaDrop";
import { useOwnedMedia } from "../media/useOwnedMedia";
import type { DeveloperMediaActions } from "./types";

// Логотип или фон застройщика во вкладке «Основное» (шаг 9.4) — общий хук одного фото владельца
// (lib/admin/media/useOwnedMedia.ts, с 3.16а он же у обложек витрины).

type DeveloperMediaKind = "logo" | "cover";

type UseDeveloperMediaParams = {
  developerId: string;
  kind: DeveloperMediaKind;
  initial: MediaPreview | null;
  /** null — без облака: только превью в браузере. */
  actions: DeveloperMediaActions | null;
  /** Отметка правила 1.2 — у опубликованного застройщика без неё база отказывает (И8). */
  rule12?: boolean;
};

export function useDeveloperMedia(params: UseDeveloperMediaParams) {
  return useOwnedMedia({
    owner: { type: "developer", id: params.developerId },
    kind: params.kind,
    initial: params.initial,
    actions: params.actions,
    rule12: params.rule12,
  });
}
