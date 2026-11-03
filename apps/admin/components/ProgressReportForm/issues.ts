// Что мешает сохранить отчёт (фаза E, п. 32): черновику — почти ничего (идущие загрузки он просто не
// берёт); «На проверку» — 3–15 загруженных фото, загруженное видео не вместе со ссылкой, комментарий RU и UZ.

export type ReportIssueKey =
  | "photosWait"
  | "photosMin"
  | "videoWait"
  | "videoBoth"
  | "commentMissing"
  | "shotDateMissing";

export type ReportIssues = Partial<Record<"photos" | "video" | "comment" | "shot", ReportIssueKey>>;

export type IssueInput = {
  mode: "draft" | "submit";
  shotOn: string;
  photosWorking: boolean;
  photos: number;
  videoStatus: "idle" | "uploading" | "offline" | "done" | "error";
  hasLink: boolean;
  comment: { ru: string; uz: string };
};

export const PHOTOS_MIN = 3;

export function reportIssues(input: IssueInput): ReportIssues {
  const issues: ReportIssues = {};
  if (!input.shotOn) issues.shot = "shotDateMissing";
  if (input.videoStatus === "done" && input.hasLink) issues.video = "videoBoth";
  if (input.mode === "draft") return issues;
  if (input.photosWorking) issues.photos = "photosWait";
  else if (input.photos < PHOTOS_MIN) issues.photos = "photosMin";
  if (input.videoStatus === "uploading" || input.videoStatus === "offline") issues.video = "videoWait";
  if (!input.comment.ru.trim() || !input.comment.uz.trim()) issues.comment = "commentMissing";
  return issues;
}

export const hasIssues = (issues: ReportIssues) => Object.values(issues).some(Boolean);
