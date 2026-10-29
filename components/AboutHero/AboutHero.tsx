import { getTranslations } from "next-intl/server";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { TimelapseClip } from "@/components/TimelapseClip";

type AboutHeroProps = {
  /** ЖК на сайте — из каталога (null — база не ответила: цифры нет). */
  complexes: number | null;
};

/**
 * «О Vodiy House» (мокап SiteAbout .ab): тёмная карточка — справа фоном ролик стройки (тот же, что на
 * первом экране главной; на телефоне его нет), надзаголовок, заголовок, кто мы и три
 * цифры: ЖК в работе (из базы), «0 сум» за подбор и показ, «каждый месяц» — видео о стройке
 * (утверждение мокапа, TODO-заказчик). История и команда — после данных заказчика.
 */
export async function AboutHero({ complexes }: AboutHeroProps) {
  const [t, video] = await Promise.all([getTranslations("about.hero"), getTranslations("timelapse")]);
  const stats = [
    ...(complexes ? [{ key: "complexes", value: String(complexes), caption: t("complexes", { count: complexes }) }] : []),
    { key: "free", value: t("freeValue"), caption: t("free") },
    { key: "video", value: t("videoValue"), caption: t("video") },
  ];
  return (
    <section className="about-hero" aria-labelledby="about-hero-title">
      <Container>
        <div className="about-hero__card">
          <TimelapseClip
            className="about-hero__media"
            sizes="(max-width: 760px) 1px, 820px"
            toggleLabels={{ pause: video("pause"), play: video("play") }}
          />
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <h1 id="about-hero-title" className="heading heading--h1 about-hero__title">
            {t("title")}
          </h1>
          <p className="about-hero__lead">{t("lead")}</p>
          <dl className="about-hero__stats">
            {stats.map((item) => (
              <div key={item.key} className="about-hero__stat">
                <dt>{item.caption}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Container>
    </section>
  );
}
