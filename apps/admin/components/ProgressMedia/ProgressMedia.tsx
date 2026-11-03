import { ArrowLeft, Download, MapPin, Navigation, PlayCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { AdminPanel } from "@/components/AdminPanel";
import { Badge } from "@/components/Badge";
import { yandexRouteUrl } from "@/lib/geo";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import type { MediaComplex, MediaComplexItem, MediaReport } from "@/lib/admin/progress/types";
import { formatDate, formatMonthYear } from "@vh/shared/format";

// «Медиа ЖК» (фаза E, п. 35): по ЖК — адрес и «Маршрут», опубликованные фото и видео отчётов по месяцам —
// снимать с тех же точек. Без контактов застройщика и внутренних данных: функция базы их не отдаёт.

const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00`));

/** «Маршрут» — Яндекс Карты в новой вкладке; без точки на карте — подпись. */
async function RouteLink({ lat, lng }: { lat: number | null; lng: number | null }) {
  const t = await getTranslations("admin.video.media");
  if (lat === null || lng === null) return <span className="progress-media__muted">{t("noPoint")}</span>;
  return (
    <a className="progress-media__route" href={yandexRouteUrl({ lat, lng })} target="_blank" rel="noreferrer">
      <Navigation size={16} aria-hidden="true" />
      {t("route")}
    </a>
  );
}

/** Список ЖК: название, сдан или строится, адрес, сколько опубликованных отчётов, «Маршрут». */
export async function MediaComplexes({ items }: { items: readonly MediaComplexItem[] }) {
  const t = await getTranslations("admin.video.media");
  if (items.length === 0) return <AdminPanel title={t("title")}>{t("empty")}</AdminPanel>;
  return (
    <AdminPanel title={t("title")} wide>
      <p className="progress-media__hint">{t("hint")}</p>
      <ul className="progress-media__complexes">
        {items.map((item) => (
          <li key={item.id} className="progress-media__complex">
            <Link href={`${ADMIN_ROUTES.videoMedia}?complex=${item.id}`} className="progress-media__open">
              <span className="progress-media__name">{item.name}</span>
              <span className="progress-media__meta">
                {t("reports", { n: item.reports })}
                {item.lastMonth ? ` · ${t("last", { month: formatMonthYear(item.lastMonth) })}` : ""}
              </span>
            </Link>
            <Badge tone={item.building ? "amber" : "line"} size="sm">
              {t(item.building ? "building" : "built")}
            </Badge>
            {item.address ? (
              <p className="progress-media__address">
                <MapPin size={14} aria-hidden="true" />
                {item.address}
              </p>
            ) : null}
            <RouteLink lat={item.lat} lng={item.lng} />
          </li>
        ))}
      </ul>
    </AdminPanel>
  );
}

/** Один ЖК: адрес, ориентир, «Маршрут»; месяцы → отчёты → фото (открыть, скачать) и видео. */
export async function MediaComplexView({ complex }: { complex: MediaComplex }) {
  const t = await getTranslations("admin.video.media");
  return (
    <AdminPanel title={complex.name} wide>
      <div className="progress-media__head">
        <Link href={ADMIN_ROUTES.videoMedia} className="progress-media__back">
          <ArrowLeft size={16} aria-hidden="true" />
          {t("back")}
        </Link>
        {complex.address ? (
          <p className="progress-media__address">
            <MapPin size={14} aria-hidden="true" />
            {complex.address}
          </p>
        ) : null}
        {complex.landmark ? <p className="progress-media__muted">{t("landmark", { text: complex.landmark })}</p> : null}
        <RouteLink lat={complex.lat} lng={complex.lng} />
      </div>
      {complex.months.length === 0 ? (
        <p className="progress-media__muted">{t("noReports")}</p>
      ) : (
        complex.months.map((month) => (
          <section key={month.month} className="progress-media__month" aria-labelledby={`media-${month.month}`}>
            <h3 id={`media-${month.month}`} className="progress-media__month-title">
              {formatMonthYear(month.month)}
            </h3>
            {month.reports.map((report) => (
              <MediaReportView key={report.id} report={report} />
            ))}
          </section>
        ))
      )}
    </AdminPanel>
  );
}

async function MediaReportView({ report }: { report: MediaReport }) {
  const t = await getTranslations("admin.video.media");
  const title = t(report.isUnit ? "unitReport" : "report", { block: report.block, date: day(report.shotOn) });
  return (
    <div className="progress-media__report">
      <p className="progress-media__report-title">{title}</p>
      {report.videoUrl ? (
        <video className="progress-media__video" src={report.videoUrl} controls preload="none" />
      ) : null}
      {report.youtubeId ? (
        <a className="progress-media__route" href={`https://youtu.be/${report.youtubeId}`} target="_blank" rel="noreferrer">
          <PlayCircle size={16} aria-hidden="true" />
          {t("youtube")}
        </a>
      ) : null}
      <ul className="progress-media__photos">
        {report.photos.map((photo, index) => (
          <li key={photo.url} className="progress-media__photo">
            <a href={photo.url} target="_blank" rel="noreferrer" aria-label={t("photo", { n: index + 1 })}>
              {/* eslint-disable-next-line @next/next/no-img-element -- опубликованное фото отчёта, публичный бакет */}
              <img src={photo.url} alt="" loading="lazy" decoding="async" width={photo.width} height={photo.height} />
            </a>
            <a className="progress-media__download" href={`${photo.url}?download=`} download>
              <Download size={14} aria-hidden="true" />
              <span className="sr-only">{t("download")}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
