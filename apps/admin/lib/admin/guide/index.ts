import { HEAD_GUIDE } from "./head";
import { MANAGER_GUIDE } from "./manager";
import { MOBILOGRAPHER_GUIDE } from "./mobilographer";
import type { Guide, GuideRole } from "./types";

export type { Guide, GuideBlock, GuideRole, GuideSection } from "./types";

export const GUIDES: Record<GuideRole, Guide> = {
  head: HEAD_GUIDE,
  manager: MANAGER_GUIDE,
  mobilographer: MOBILOGRAPHER_GUIDE,
};

/** Файл памятки в docs/ (корень репозитория). */
export const GUIDE_FILES: Record<GuideRole, string> = {
  head: "docs/head-guide.md",
  manager: "docs/manager-guide.md",
  mobilographer: "docs/mobilographer-guide.md",
};
