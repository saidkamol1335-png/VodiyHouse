import { useTranslations } from "next-intl";
import NextLink from "next/link";
import { Container } from "@/components/Container";
import { Link } from "@/lib/i18n/navigation";
import { ADMIN_ROUTE, ROUTES } from "@/lib/routes";
import { FooterCatalog, FooterContacts, FooterCopyUrl } from "./FooterParts";
import { PixelLogo } from "./PixelLogo";

// Год запуска сайта: new Date() в оболочке ломает статичную сборку (cacheComponents), а дата
// сборки в подвале устаревала бы до следующей. Диапазон «2026–…» — когда понадобится.
const COPYRIGHT_YEAR = 2026;

/** Подвал мокапа (.ftr): знак и обещание, «Каталог», «Контакты», «Застройщикам», © и политика. */
export function SiteFooter() {
  const t = useTranslations();
  return (
    <footer className="site-footer">
      <Container>
        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <PixelLogo />
            <p className="site-footer__promise">
              {t.rich("footer.promise", {
                accent: (chunks) => <span className="site-footer__accent">{chunks}</span>,
              })}
            </p>
            <p className="site-footer__tagline">{t("footer.tagline")}</p>
            <FooterCopyUrl />
          </div>
          <FooterColumn title={t("footer.catalog")}>
            <FooterCatalog />
          </FooterColumn>
          <FooterColumn title={t("footer.contacts")}>
            <FooterContacts />
          </FooterColumn>
          <FooterColumn title={t("nav.forDevelopers")}>
            <Link href={ROUTES.forDevelopers} className="site-footer__link">
              {t("footer.becomePartner")}
            </Link>
            {/* Кабинет — без префикса языка, поэтому обычный Link Next.js. */}
            {/* Без предзагрузки: /admin посетителю отвечает переходом на вход. */}
            <NextLink href={ADMIN_ROUTE} prefetch={false} className="site-footer__link">
              {t("contacts.staffLogin")}
            </NextLink>
          </FooterColumn>
        </div>
        <div className="site-footer__bottom">
          <span>© {COPYRIGHT_YEAR} Vodiy House</span>
          <Link href={ROUTES.privacy} className="site-footer__link">
            {t("contacts.privacy")}
          </Link>
        </div>
      </Container>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="site-footer__column">
      <p className="site-footer__title">{title}</p>
      <div className="site-footer__links">{children}</div>
    </div>
  );
}
