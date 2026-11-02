"use client";

import { useTranslations } from "next-intl";
import { UpdatedAgo } from "@/components/UpdatedAgo";
import type { HaltReason } from "@/lib/admin/home/liveStock";
import { ADMIN_ROUTES } from "@/lib/admin/nav";

type LiveStatusProps = {
  live: boolean;
  /** Когда прочитаны цифры на экране (мс, часы браузера); null — неизвестно. */
  readAt: number | null;
  /** Перечитывание остановлено — вместо «обновлено …» сказать почему и что сделать. */
  halted: HaltReason | null;
};

/**
 * «● LIVE» мокапа (Г4 A): цифры перечитываются сами. Чтение не удалось — точка гаснет, рядом
 * «обновлено 3 мин назад»; сессия кончилась или кабинет обновили — что сделать. Диктору — один
 * раз, без повторов на каждый тик часов.
 */
export function LiveStatus({ live, readAt, halted }: LiveStatusProps) {
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
          {halted ? <HaltLabel halted={halted} /> : <StaleLabel readAt={readAt} />}
        </span>
      )}
      <span className="sr-only" role="status">
        {live ? "" : t(halted ? `haltAnnounce.${halted}` : "staleAnnounce")}
      </span>
    </span>
  );
}

function StaleLabel({ readAt }: { readAt: number | null }) {
  const t = useTranslations("admin.home.stock");
  if (readAt === null) return t("staleUnknown");
  return (
    <>
      {t("stale")} <UpdatedAgo at={new Date(readAt).toISOString()} by={null} />
    </>
  );
}

function HaltLabel({ halted }: { halted: HaltReason }) {
  const t = useTranslations("admin.home.stock");
  return (
    <>
      {t(`halt.${halted}`)}
      {halted === "session" ? (
        <a className="live-status__action" href={ADMIN_ROUTES.login}>
          {t("signIn")}
        </a>
      ) : null}
      {halted === "outdated" ? (
        <button
          type="button"
          className="live-status__action"
          onClick={() => window.location.reload()}
        >
          {t("reload")}
        </button>
      ) : null}
    </>
  );
}
