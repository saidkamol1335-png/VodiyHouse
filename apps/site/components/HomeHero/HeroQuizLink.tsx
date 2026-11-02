import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { RollText } from "@/components/RollText";
import { QUIZ_ANCHOR } from "@/lib/routes";

/** «✦ Подбор за 1 минуту» — вторая кнопка первого экрана (мокап hero, 3.17): якорь на квиз ниже на главной. */
export async function HeroQuizLink() {
  const t = await getTranslations("quiz");
  return (
    <a href={`#${QUIZ_ANCHOR}`} className="button home-hero__quiz roll-trigger">
      <Sparkles size={16} aria-hidden="true" />
      <RollText text={t("eyebrow")} />
    </a>
  );
}
