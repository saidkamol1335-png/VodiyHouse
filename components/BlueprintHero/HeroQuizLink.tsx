import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { QUIZ_ANCHOR } from "@/lib/routes";

/** «Подбор за 1 минуту» в первом экране (мокап hero, 3.17): якорь на раздел квиза ниже на главной. */
export async function HeroQuizLink() {
  const t = await getTranslations("quiz");
  return (
    <a href={`#${QUIZ_ANCHOR}`} className="blueprint-hero__pick blueprint-hero__pick--quiz">
      <Sparkles size={14} aria-hidden="true" />
      <span className="blueprint-hero__pick-value">{t("eyebrow")}</span>
      <span className="blueprint-hero__pick-label">{t("time")}</span>
    </a>
  );
}
