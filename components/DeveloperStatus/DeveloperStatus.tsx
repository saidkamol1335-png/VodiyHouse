"use client";

import { PublishCheck, type PublishFile } from "@/components/PublishCheck";
import { StatusCapsule } from "@/components/StatusCapsule";
import type { FormAction, StatusResult } from "@/lib/admin/developers/types";
import type { PublicationStatus } from "@/lib/admin/publication";

type DeveloperStatusProps = {
  developer: { id: string; name: string; status: PublicationStatus; archivedAt: string | null };
  action: FormAction<StatusResult>;
  /** Логотип и фон: при «Опубликовать» их проверяют по правилу 1.2 (И8, как у ЖК). */
  files: readonly PublishFile[];
};

/** Статус застройщика в шапке страницы: плашка, переходы, архив с вводом названия. */
export function DeveloperStatus({ developer, action, files }: DeveloperStatusProps) {
  return (
    <StatusCapsule
      entity={developer}
      name={developer.name}
      action={action}
      messages="admin.developers.status"
      publishPanel={(panel) => (
        <PublishCheck
          {...panel}
          entityId={developer.id}
          files={files}
          messages="admin.developers.publish"
        />
      )}
    />
  );
}
