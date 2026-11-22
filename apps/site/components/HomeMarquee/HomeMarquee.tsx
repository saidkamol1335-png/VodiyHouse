import { getTranslations } from "next-intl/server";
import { SitePhoto } from "@/components/SitePhoto";
import { Link } from "@/lib/i18n/navigation";
import { developerRoute } from "@/lib/routes";
import type { DeveloperSummary } from "@/lib/site/developers/records";
import { marqueeLogos, marqueeMode } from "./marqueeMode";

/**
 * Строка под первым экраном (правки 15.11, п. 27, 20.11): логотипы застройщиков вместо городов, клик —
 * страница застройщика (ни одного контакта — правило 1.2). От 5 логотипов строка бежит, и только в full
 * (пауза при наведении и фокусе; prefers-reduced-motion — стоит); меньше 5, lite и none — статичный ряд.
 * Логотипов нет — строки нет.
 */
export async function HomeMarquee({ developers }: { developers: readonly DeveloperSummary[] | null }) {
  const logos = marqueeLogos(developers);
  const mode = marqueeMode(logos.length);
  if (mode === "none") return null;
  const t = await getTranslations("home");
  // Бегущая лента — дважды подряд: сдвиг на половину ширины замыкается без шва; копия — не для диктора.
  const copies = mode === "running" ? [false, true] : [false];
  return (
    <nav className={`home-marquee home-marquee--${mode}`} aria-label={t("developersStrip")}>
      <div className="home-marquee__track">
        {copies.map((copy) => (
          <ul key={String(copy)} className="home-marquee__list" aria-hidden={copy || undefined}>
            {logos.map((developer) => (
              <li key={developer.id} className="home-marquee__item">
                <Link
                  href={developerRoute(developer.slug)}
                  className="home-marquee__link"
                  aria-label={developer.name}
                  tabIndex={copy ? -1 : undefined}
                >
                  {developer.logo ? (
                    <SitePhoto photo={developer.logo} alt="" frame="card" sizes="140px" fit="contain" className="home-marquee__logo" />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </nav>
  );
}
