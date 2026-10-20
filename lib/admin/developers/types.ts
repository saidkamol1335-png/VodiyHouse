import type { BilingualValue } from "../bilingual";
import type { PublicationStatus } from "../publication";
import type { ContentErrorCode } from "./errors";
import type { DeveloperFieldIssue, DeveloperMainErrors, DeveloperMainFields } from "./mainForm";
import type { PrivateNotes, PrivateNotesErrors } from "./privateNotes";
import type { ProjectRowErrors } from "./projects";
import type { PublishRequirement } from "./publication";

// Данные страницы застройщика и ответы действий — отдельно от "use server" файла (там только
// функции). Каждый ответ «сохранено» несёт время: форма показывает «Сохранено» и после повтора.

export type DeveloperRecord = {
  id: string;
  slug: string;
  name: string;
  status: PublicationStatus;
  foundedYear: number | null;
  flatsDelivered: number | null;
  deliveredCheckedAt: string | null;
  about: BilingualValue | null;
  founders: BilingualValue | null;
  archivedAt: string | null;
};

export type CreateDeveloperResult =
  | { status: "idle" }
  | {
      status: "error";
      error: ContentErrorCode | null;
      fieldErrors: { name?: DeveloperFieldIssue };
      name: string;
    };

export type SaveMainResult =
  | { status: "idle" }
  | { status: "saved"; at: number }
  | {
      status: "error";
      error: ContentErrorCode | null;
      fieldErrors: DeveloperMainErrors;
      fields: DeveloperMainFields;
    };

export type StatusResult =
  | { status: "idle" }
  | { status: "done"; to: PublicationStatus; at: number }
  | { status: "error"; error: ContentErrorCode; missing: PublishRequirement[] };

export type SaveProjectsResult =
  | { status: "idle" }
  | { status: "saved"; at: number }
  | { status: "error"; error: ContentErrorCode | null; rowErrors: ProjectRowErrors };

export type SavePrivateResult =
  | { status: "idle" }
  | { status: "saved"; at: number }
  | {
      status: "error";
      error: ContentErrorCode | null;
      fieldErrors: PrivateNotesErrors;
      fields: PrivateNotes;
    };

/** Действия вкладок: на странице — Server Actions, на служебном стенде — подделка. */
export type FormAction<Result> = (formData: FormData) => Promise<Result>;

export type DeveloperActionSet = {
  saveMain: FormAction<SaveMainResult>;
  setStatus: FormAction<StatusResult>;
  saveProjects: FormAction<SaveProjectsResult>;
  savePrivate: FormAction<SavePrivateResult>;
};
