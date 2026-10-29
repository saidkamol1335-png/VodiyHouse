import { Eye } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AdminPanel } from "@/components/AdminPanel";
import { Button } from "@/components/Button";
import type { ClientVideo } from "@/lib/admin/progress/types";
import { formatDate, formatMonthYear } from "@/lib/format";
import { mediaPublicUrl } from "@/lib/media";
import { siteOrigin } from "@/lib/site/metadata";
import { CopyLinkButton } from "./CopyLinkButton";

/**
 * «Видео для клиентов · последние» (фаза 5, мокап CabReview): опубликованные отчёты — «Ссылка» копирует
 * адрес для клиента (страница без входа), «Открыть» — та же страница сайта.
 */
export async function ClientVideos({ videos }: { videos: readonly ClientVideo[] }) {
  const t = await getTranslations("admin.video.clientVideos");
  return (
    <AdminPanel title={t("title")} wide>
      <p className="admin-panel__lead">{t("hint")}</p>
      {videos.length === 0 ? (
        <p className="progress-overview__empty">{t("empty")}</p>
      ) : (
        <ul className="progress-overview__videos">
          {videos.map((video) => (
            <VideoItem key={video.id} video={video} />
          ))}
        </ul>
      )}
    </AdminPanel>
  );
}

async function VideoItem({ video }: { video: ClientVideo }) {
  const t = await getTranslations("admin.video");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const unit = video.unitNumber ? t("mine.unit", { number: video.unitNumber }) : "";
  const meta = [
    video.isUnit ? t("clientVideos.unitKind") : t("clientVideos.blockKind"),
    t("clientVideos.shot", { date: formatDate(new Date(video.shotAt)) }),
    video.author,
  ];
  return (
    <li className="progress-overview__video">
      {video.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- миниатюра 76 × 50 из бакета в кабинете
        <img
          className="progress-review__thumb"
          src={mediaPublicUrl(supabaseUrl, video.thumb)}
          alt=""
          loading="lazy"
        />
      ) : (
        <span className="progress-review__thumb" />
      )}
      <div>
        <p className="progress-review__title">
          {t("mine.item", {
            complex: video.complexName,
            block: video.blockName,
            unit,
            month: formatMonthYear(video.month),
          })}
        </p>
        <p className="progress-review__meta">{meta.filter(Boolean).join(" · ")}</p>
      </div>
      <div className="progress-overview__actions">
        <CopyLinkButton url={`${siteOrigin()}${video.path}`} />
        <Button href={video.path} variant="ghost" size="sm">
          <Eye size={16} aria-hidden="true" />
          {t("clientVideos.open")}
        </Button>
      </div>
    </li>
  );
}
