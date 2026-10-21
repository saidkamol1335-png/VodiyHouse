"use client";

import { StatusCapsule } from "@/components/StatusCapsule";
import type { FormAction, StatusResult } from "@/lib/admin/developers/types";
import type { PublicationStatus } from "@/lib/admin/publication";

type DeveloperStatusProps = {
  developer: { id: string; name: string; status: PublicationStatus; archivedAt: string | null };
  action: FormAction<StatusResult>;
};

/** Статус застройщика в шапке страницы: плашка, переходы, архив с вводом названия. */
export function DeveloperStatus({ developer, action }: DeveloperStatusProps) {
  return (
    <StatusCapsule
      entity={developer}
      name={developer.name}
      action={action}
      messages="admin.developers.status"
    />
  );
}
