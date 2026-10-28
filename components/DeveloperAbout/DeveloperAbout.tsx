import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/routing";
import type { DeveloperChecks } from "@/lib/site/developers/model";
import type { DeveloperPage } from "@/lib/site/developers/records";
import { AboutText } from "./AboutText";

type DeveloperAboutProps = { page: DeveloperPage; checks: DeveloperChecks; locale: Locale };

const dotted = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");

/**
 * «О компании» и «Проверено Vodiy House» (мокап SiteDev, ТЗ 8.4): слева текст и основатели, справа
 * проверки с датами. Плашка целиком — когда хоть один ЖК прошёл всё; иначе только пройденные пункты
 * без заголовка. Без текста и проверок раздела нет.
 */
export async function DeveloperAbout({ page, checks, locale }: DeveloperAboutProps) {
  const t = await getTranslations("developers.page");
  const about = page.about?.[locale];
  const founders = page.founders?.[locale];
  if (!about && !founders && checks.checks.length === 0) return null;
  return (
    <section className="developer-about" aria-label={t("about")}>
      {about || founders ? (
        <div className="developer-about__text">
          {about ? (
            <>
              <p className="developer-about__label">{t("about")}</p>
              <AboutText text={about} />
            </>
          ) : null}
          {founders ? (
            <>
              <p className="developer-about__label">{t("founders")}</p>
              <p className="developer-about__body">{founders}</p>
            </>
          ) : null}
        </div>
      ) : null}
      {checks.checks.length > 0 ? (
        <div className="developer-about__checks">
          {checks.verified ? <p className="developer-about__label">{t("checks")}</p> : null}
          <ul>
            {checks.checks.map((check) => (
              <li key={check.key}>
                <span className="developer-about__check" aria-hidden="true">
                  <Check size={13} strokeWidth={2.6} />
                </span>
                <span>
                  {t(check.key)}
                  <small>{t("checkedOn", { date: dotted(check.date) })}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
