import { useTranslations } from "next-intl";
import { Spotlight } from "@/components/Spotlight";

const CARDS = ["complex", "kpi", "banner"] as const;

/** Базовые эффекты на /dev/preview: стекло, подсветка за курсором; линии колонок — на страницах сайта. */
export function EffectsPreview() {
  const t = useTranslations("admin.dev.preview.effects");
  const site = useTranslations("nav");
  const complex = useTranslations("admin.complexes")("namePrefixed", { name: "Shodlik" });
  const nav = [site("new"), site("specials"), site("developers"), site("calculator")].join(" · ");
  return (
    <section className="effects-preview">
      <h2 className="heading heading--h3">{t("title")}</h2>

      <div className="effects-preview__photo" data-testid="glass-demo">
        <div className="effects-preview__photo-text">{t("photoText")}</div>
        <div className="effects-preview__bar glass">
          <b>Vodiy House</b>
          <span>{nav}</span>
        </div>
      </div>

      <div className="effects-preview__cards">
        {CARDS.map((card) => (
          <Spotlight key={card} as="article" className="effects-preview__card">
            <span className="effects-preview__label">{t(`cards.${card}`)}</span>
            <span className="heading heading--h3">{complex}</span>
            <span className="effects-preview__muted">{t("address")}</span>
            <span className="effects-preview__muted">{t("spotlightNote")}</span>
          </Spotlight>
        ))}
      </div>
    </section>
  );
}
