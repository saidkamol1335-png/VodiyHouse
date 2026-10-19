import { SiteHeader } from "@/components/SiteHeader";

/** /dev/header: шапка поверх «фото», название страницы после прокрутки, «назад». Только разработка. */
export function DevHeaderStage() {
  return (
    <>
      <SiteHeader transparentAtTop overPhoto pageTitle="ЖК Shodlik" backHref="/" />
      <div className="dev-header-stage__photo" data-testid="photo" />
      <div className="dev-header-stage__content">
        {Array.from({ length: 12 }, (_, index) => (
          <p key={index}>Строка {index + 1} — прокрутите, чтобы шапка стала стеклом.</p>
        ))}
      </div>
    </>
  );
}
