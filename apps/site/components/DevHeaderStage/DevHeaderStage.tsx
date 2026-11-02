import { useTranslations } from "next-intl";
import { SiteHeader } from "@/components/SiteHeader";

/** /dev/header: шапка поверх «фото», название страницы после прокрутки, «назад». Только разработка. */
export function DevHeaderStage() {
  const t = useTranslations("admin");
  const pageTitle = t("complexes.namePrefixed", { name: "Shodlik" });
  return (
    <>
      <SiteHeader transparentAtTop overPhoto pageTitle={pageTitle} backHref="/" />
      <div className="dev-header-stage__photo" data-testid="photo" />
      <div className="dev-header-stage__content">
        {Array.from({ length: 12 }, (_, index) => (
          <p key={index}>{t("dev.header.row", { n: index + 1 })}</p>
        ))}
      </div>
    </>
  );
}
