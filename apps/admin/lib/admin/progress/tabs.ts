import type { StaffRole } from "@/lib/admin/access";
import { ADMIN_ROUTES } from "@/lib/admin/nav";

// Вкладки раздела «Видео и ход стройки» (фаза E, п. 38): мобилограф — «Задания · Новый отчёт · Мои отчёты ·
// Медиа ЖК», руководитель — «Проверка» вместо «Заданий», менеджер — «Проверка · Медиа ЖК».

export type VideoTabKey = "home" | "new" | "mine" | "media";

type VideoTab = { key: VideoTabKey; segment: string | null; href: string; roles: readonly StaffRole[] };

export const VIDEO_TABS: readonly VideoTab[] = [
  { key: "home", segment: null, href: ADMIN_ROUTES.video, roles: ["head", "manager", "mobilographer"] },
  { key: "new", segment: "novyy", href: ADMIN_ROUTES.videoNew, roles: ["head", "mobilographer"] },
  { key: "mine", segment: "moi", href: ADMIN_ROUTES.videoMine, roles: ["head", "mobilographer"] },
  { key: "media", segment: "media", href: ADMIN_ROUTES.videoMedia, roles: ["head", "manager", "mobilographer"] },
];

export const videoTabsFor = (role: StaffRole) => VIDEO_TABS.filter((tab) => tab.roles.includes(role));

export const canOpenVideoTab = (role: StaffRole, key: VideoTabKey) =>
  VIDEO_TABS.some((tab) => tab.key === key && tab.roles.includes(role));

/** Подпись вкладки: первая у мобилографа — «Задания», у руководителя и менеджера — «Проверка». */
export const videoTabLabelKey = (role: StaffRole, key: VideoTabKey) =>
  key === "home" ? (role === "mobilographer" ? "tasks" : "review") : key;
