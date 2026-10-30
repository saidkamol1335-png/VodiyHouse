import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/Reveal";
import { programNote, programTitle } from "@/lib/calc/text";
import type { ProgramOption } from "@/lib/calc/options";
import type { CalcProgram } from "@/lib/calc/programs";
import { initialsOf } from "@/lib/format";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";

type DeveloperProgramsProps = {
  options: readonly ProgramOption<CalcProgram>[];
  developerSlug: string;
  developerName: string;
  locale: Locale;
};

const APOSTROPHES = /[‘’']/g;

/**
 * «Условия покупки» (мокап SiteDev, ТЗ 8.2): программы застройщика и банков — те же названия и
 * строка условий, что в калькуляторе; знак — инициалы банка или застройщика (мокап «FS», «IB»);
 * «Рассчитать платёж» открывает /kalkulyator с этой программой.
 */
export async function DeveloperPrograms({ options, developerSlug, developerName, locale }: DeveloperProgramsProps) {
  const [t, tCalc] = await Promise.all([getTranslations("developers.page"), getTranslations("calc")]);
  if (options.length === 0) return null;
  const mark = (option: ProgramOption<CalcProgram>) =>
    initialsOf((option.bankName ? option.bankName[locale] : developerName).replace(APOSTROPHES, ""));
  return (
    <Reveal as="section" className="developer-programs" aria-labelledby="developer-programs-title">
      <h2 id="developer-programs-title" className="heading heading--h2">
        {t("terms")}
      </h2>
      <p className="developer-programs__lead">{t("termsLead")}</p>
      <ul className="developer-programs__grid">
        {options.map((option) => {
          return (
            <li key={option.id} className="developer-programs__card">
              <span className="developer-programs__mark" aria-hidden="true">
                {mark(option)}
              </span>
              <b className="developer-programs__title">{programTitle(option, tCalc, locale)}</b>
              <span className="developer-programs__note">{programNote(option, tCalc)}</span>
              <Link
                className="developer-programs__calc"
                href={`${ROUTES.calculator}?developer=${developerSlug}&program=${option.id}`}
              >
                {t("calculate")}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Reveal>
  );
}
