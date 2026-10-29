import { Play } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { SitePhoto } from "@/components/SitePhoto";
import type { Locale } from "@/lib/i18n/routing";
import { complexRoute } from "@/lib/routes";
import { COMPLEX_ANCHORS } from "@/lib/site/complex/sections";
import type { ProgressSample } from "@/lib/site/home/stats";

/** Кадров в видоискателе — 4, как в мокапе (.bnv); у отчёта с 3 фото первое показывается дважды. */
const SLOTS = 4;

/**
 * «Видео стройки» (мокап .bn--wide с .bnv, фаза 5): видоискатель с кадрами последнего отчёта и
 * «REC · ЖК · блок», «Смотреть пример» — раздел «Ход строительства» этого ЖК (страницы видео квартир
 * — для клиентов по ссылке, с главной их не открываем). В full кадры сменяются, в lite и none — первый.
 */
export async function VideoTile({ video }: { video: ProgressSample }) {
  const t = await getTranslations("home.why");
  const locale = (await getLocale()) as Locale;
  const { complex, frame } = video;
  const slots = Array.from(
    { length: SLOTS },
    (_, index) => frame.photos[index % frame.photos.length]!,
  );
  return (
    <>
      <div className="home-why__video" aria-hidden="true">
        {slots.map((photo, index) => (
          <span key={index} className="home-why__frame" style={{ ["--frame" as string]: index }}>
            <SitePhoto
              photo={photo}
              alt=""
              frame="cover"
              sizes="(max-width: 760px) 100vw, 400px"
              className="home-why__photo"
            />
          </span>
        ))}
        <span className="home-why__corners" />
        <span className="home-why__rec">
          <i />
          {t("videoRec", { complex: complex.name[locale], block: frame.block })}
        </span>
      </div>
      <p className="home-why__kicker">{t("videoKicker")}</p>
      <div className="home-why__body">
        <p className="home-why__tile-title">{t("videoTitle")}</p>
        <p className="home-why__text">{t("videoText")}</p>
        <Button
          variant="outline"
          size="sm"
          href={`/${locale}${complexRoute(complex.slug)}#${COMPLEX_ANCHORS.progress}`}
          className="home-why__cta"
        >
          <Play size={16} aria-hidden="true" />
          {t("videoCta")}
        </Button>
      </div>
    </>
  );
}
