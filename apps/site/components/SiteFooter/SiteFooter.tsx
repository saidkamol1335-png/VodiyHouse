import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Container } from "@/components/Container";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { FooterCatalog, FooterContacts, FooterCopyUrl, FooterSocials } from "./FooterParts";
import { PixelLogo } from "./PixelLogo";

// Год запуска сайта: new Date() в оболочке ломает статичную сборку (cacheComponents), а дата
// сборки в подвале устаревала бы до следующей. Диапазон «2026–…» — когда понадобится.
const COPYRIGHT_YEAR = 2026;

/**
 * Подвал сайта в стиле Hover Footer (@mdafsarx, 21st.dev; слово исполнителя 04.11, без анимированной
 * надписи): тёмная скруглённая плашка с янтарным свечением снизу, четыре колонки — знак с обещанием,
 * «Каталог», «Застройщикам», «Контакты» с иконками; под чертой — соцсети и ©. Тёмный блок — не тема:
 * цвета заданы токенами на самом подвале. Контакты — только Vodiy House (правило ТЗ 1.2); ссылок в
 * кабинет нет — сайт и админка раздельно (Проект-2).
 */
export function SiteFooter() {
  const t = useTranslations();
  return (
    <footer className="site-footer">
      <div className="site-footer__panel">
        <span className="site-footer__glow" aria-hidden="true" />
        <Container>
          <div className="site-footer__grid">
            <FooterBrand />
            <FooterColumn title={t("footer.catalog")}>
              <FooterCatalog />
            </FooterColumn>
            <FooterColumn title={t("nav.forDevelopers")}>
              <Link href={ROUTES.forDevelopers} className="site-footer__link">
                {t("footer.becomePartner")}
                <span className="site-footer__pulse" aria-hidden="true" />
              </Link>
            </FooterColumn>
            <FooterColumn title={t("footer.contacts")}>
              <FooterContacts />
            </FooterColumn>
          </div>
          <div className="site-footer__bottom">
            <FooterSocials />
            <p className="site-footer__legal">
              <span>© {COPYRIGHT_YEAR} Vodiy House</span>
              <Link href={ROUTES.privacy} className="site-footer__link">
                {t("contacts.privacy")}
              </Link>
            </p>
          </div>
        </Container>
      </div>
    </footer>
  );
}

/** Знак и «Vodiy House» в строку, обещание с акцентом, подпись и адрес сайта — первая колонка. */
function FooterBrand() {
  const t = useTranslations("footer");
  return (
    <div className="site-footer__brand">
      <p className="site-footer__name">
        <PixelLogo />
        Vodiy House
      </p>
      <p className="site-footer__promise">
        {t.rich("promise", {
          accent: (chunks) => <span className="site-footer__accent">{chunks}</span>,
        })}
      </p>
      <p className="site-footer__tagline">{t("tagline")}</p>
      <FooterCopyUrl />
    </div>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="site-footer__column">
      <p className="site-footer__title">{title}</p>
      <div className="site-footer__links">{children}</div>
    </div>
  );
}
