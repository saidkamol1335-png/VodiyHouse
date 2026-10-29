import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { QUIZ_ANCHOR } from "@/lib/routes";

/** «✦ Подбор за 1 минуту» — вторая кнопка первого экрана (мокап hero, 3.17): якорь на квиз ниже на главной. */
export async function HeroQuizLink() {
  const t = await getTranslations("quiz");
  return (
    <a href={`#${QUIZ_ANCHOR}`} className="button home-hero__quiz">
      <Sparkles size={16} aria-hidden="true" />
      {t("eyebrow")}
    </a>
  );
}
