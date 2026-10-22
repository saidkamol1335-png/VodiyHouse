"use client";

import { useTranslations } from "next-intl";
import { UpdatedAgo } from "@/components/UpdatedAgo";

type LiveStatusProps = {
  live: boolean;
  /** Когда прочитаны цифры на экране (мс, часы браузера); null — неизвестно. */
  readAt: number | null;
};

/**
 * «● LIVE» мокапа (Г4 A): цифры перечитываются сами. Чтение не удалось — точка гаснет, рядом
 * «обновлено 3 мин назад»; диктору — один раз, без повторов на каждый тик часов.
 */
export function LiveStatus({ live, readAt }: LiveStatusProps) {
  const t = useTranslations("admin.home.stock");
  return (
    <span className={live ? "live-status" : "live-status live-status--stale"}>
      <span className="live-status__dot" aria-hidden="true" />
      {live ? (
        <>
          <span className="live-status__label" aria-hidden="true">
            {t("live")}
          </span>
          <span className="sr-only">{t("liveHint")}</span>
        </>
      ) : (
        <span className="live-status__label">
          {readAt === null ? (
            t("staleUnknown")
          ) : (
            <>
              {t("stale")} <UpdatedAgo at={new Date(readAt).toISOString()} by={null} />
            </>
          )}
        </span>
      )}
      <span className="sr-only" role="status">
        {live ? "" : t("staleAnnounce")}
      </span>
    </span>
  );
}
