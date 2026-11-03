import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminDenied } from "@/components/AdminDenied";
import { AdminPage } from "@/components/AdminPage";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminTopbar } from "@/components/AdminTopbar";
import { VideoDock } from "@/components/VideoDock";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { cabinetPerson } from "@/lib/admin/person";
import { canOpenVideoTab, videoTabLabelKey, videoTabsFor, VIDEO_TABS, type VideoTabKey } from "@/lib/admin/progress/tabs";
import type { CabinetViewer } from "@/lib/admin/access";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";

type VideoLayoutProps = {
  tab: VideoTabKey;
  /** Содержимое вкладки — после проверки доступа и облака. */
  children: (viewer: CabinetViewer) => Promise<ReactNode> | ReactNode;
};

/**
 * Оболочка раздела «Видео и ход стройки» (фаза E, пп. 37–38): заголовок по роли, вкладки раздела, у
 * мобилографа на телефоне — нижняя панель вместо вкладок. Вкладка не для роли — «нет доступа».
 */
export async function VideoLayout({ tab, children }: VideoLayoutProps) {
  const { viewer, allowed } = await requireSection("video");
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin");
  const mobile = viewer.role === "mobilographer";
  const title = mobile ? t("video.titleMobilographer") : t("video.title");
  const topbar = <AdminTopbar title={title} subtitle={t("video.subtitle")} person={person} />;
  const open = allowed && canOpenVideoTab(viewer.role, tab);
  const current = VIDEO_TABS.find((item) => item.key === tab)!.segment;
  const body = !open ? (
    <AdminDenied section={t("nav.video")} />
  ) : isCabinetOpenWithoutLogin || !hasSupabaseEnv() ? (
    <AdminPanel title={title}>{t("developers.errors.notConfigured")}</AdminPanel>
  ) : (
    await children(viewer)
  );
  return (
    <AdminPage topbar={topbar}>
      <div className={mobile ? "video-layout video-layout--dock" : "video-layout"}>
        {allowed ? (
          <AdminTabs
            label={t("video.tabs.label")}
            className="video-layout__tabs"
            current={current}
            tabs={videoTabsFor(viewer.role).map((item) => ({
              segment: item.segment,
              href: item.href,
              label: t(`video.tabs.${videoTabLabelKey(viewer.role, item.key)}`),
            }))}
          />
        ) : null}
        {body}
      </div>
      {mobile ? <VideoDock /> : null}
    </AdminPage>
  );
}
