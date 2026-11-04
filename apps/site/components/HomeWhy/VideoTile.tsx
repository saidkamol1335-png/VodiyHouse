import { Play } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { SitePhoto } from "@/components/SitePhoto";
import type { Locale } from "@/lib/i18n/routing";
import { complexRoute } from "@/lib/routes";
import { COMPLEX_ANCHORS } from "@/lib/site/complex/sections";
import type { ProgressSample } from "@/lib/site/home/stats";
import type { SitePhotoData } from "@/lib/site/photo";
import { WhyMedia } from "./WhyMedia";
import { Copy, Kicker } from "./WhyParts";

/**
 * «Видео стройки» (вариант А): слева текст и «Смотреть пример» — раздел «Ход строительства» этого ЖК,
 * справа видоискатель с первым кадром последнего отчёта. full — автофокус (размытая копия гаснет),
 * рамка защёлкивается, рамка фокуса мигает, медленный наезд камеры, REC мигает, идёт таймкод и полоса;
 * lite и none — кадр стоит.
 */
export async function VideoTile({ video }: { video: ProgressSample }) {
  const t = await getTranslations("home.why");
  const locale = (await getLocale()) as Locale;
  const { complex, frame } = video;
  const href = `/${locale}${complexRoute(complex.slug)}#${COMPLEX_ANCHORS.progress}`;
  const photo = frame.photos[0]!;
  return (
    <div className="home-why__split home-why__split--video">
      <div className="home-why__copy">
        <Kicker index="01" text={t("videoKicker")} />
        <div className="home-why__body">
          <Copy title={t("videoTitle")} text={t("videoText")} />
          <Button
            variant="outline"
            size="sm"
            href={href}
            className="home-why__cta home-why__rv home-why__rv--3"
          >
            <span className="home-why__cta-ico" aria-hidden="true">
              <Play size={14} fill="currentColor" strokeWidth={0} />
            </span>
            {t("videoCta")}
          </Button>
        </div>
      </div>
      <WhyMedia href={href}>
        <ViewfinderShot photo={photo} />
        <ViewfinderShot photo={photo} soft />
        <span className="home-why__rec">
          <i aria-hidden="true" />
          <span className="home-why__rec-text">
            {t("videoRec", { complex: complex.name[locale], block: frame.block })}
          </span>
        </span>
      </WhyMedia>
    </div>
  );
}

/** Кадр видоискателя; soft — размытая копия поверх, в full гаснет («автофокус»). */
function ViewfinderShot({ photo, soft = false }: { photo: SitePhotoData; soft?: boolean }) {
  return (
    <span
      className={soft ? "home-why__frame home-why__frame--soft" : "home-why__frame"}
      aria-hidden="true"
    >
      <SitePhoto
        photo={photo}
        alt=""
        frame="cover"
        sizes="(max-width: 760px) 100vw, 640px"
        className="home-why__photo"
      />
    </span>
  );
}
