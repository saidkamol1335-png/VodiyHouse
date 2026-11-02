import { getTranslations } from "next-intl/server";
import { PreloaderScreen } from "./PreloaderScreen";

/** Экран загрузки при входе на главную: тексты — серверу, проценты и уход — клиенту. */
export async function SitePreloader() {
  const t = await getTranslations("home.hero");
  return <PreloaderScreen note={t("eyebrow")} caption={t("loading")} />;
}
