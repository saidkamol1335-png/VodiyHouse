import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/Reveal";
import { programNote, programTitle } from "@vh/shared/calc/text";
import type { ProgramOption } from "@vh/shared/calc/options";
import type { CalcProgram } from "@vh/shared/calc/programs";
import { initialsOf } from "@vh/shared/format";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { type ProgramComplex, programHref } from "./programLink";

type DeveloperProgramsProps = {
  options: readonly ProgramOption<CalcProgram>[];
  /** ЖК застройщика на сайте и их блоки — куда ведёт «Рассчитать платёж». */
  complexes: readonly ProgramComplex[];
  developerName: string;
  locale: Locale;
};

const APOSTROPHES = /[‘’']/g;

/**
 * «Условия покупки» (мокап SiteDev, ТЗ 8.2): программы застройщика и банков — те же названия и
 * строка условий, что в калькуляторе; знак — инициалы банка или застройщика (мокап «FS», «IB»);
 * «Рассчитать платёж» ведёт на ЖК, где программу считает калькулятор квартиры (PLAN §10, п. 48).
 */
export async function DeveloperPrograms({ options, complexes, developerName, locale }: DeveloperProgramsProps) {
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
          const href = programHref(option, complexes);
          return (
            <li key={option.id} className="developer-programs__card">
              <span className="developer-programs__mark" aria-hidden="true">
                {mark(option)}
              </span>
              <b className="developer-programs__title">{programTitle(option, tCalc, locale)}</b>
              <span className="developer-programs__note">{programNote(option, tCalc)}</span>
              {href ? (
                <Link className="developer-programs__calc" href={href}>
                  {t("calculate")}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Reveal>
  );
}
