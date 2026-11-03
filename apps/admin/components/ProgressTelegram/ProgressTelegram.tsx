"use client";

import { BellRing, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import {
  progressTelegramLinkAction,
  progressTelegramUnlinkAction,
} from "@/lib/admin/actions/progressTelegram";

/**
 * «Уведомления в Telegram» мобилографа (фаза E, п. 36): по желанию — «Возвращён: причина» и «Опубликован»
 * в личный чат. «Привязать» выдаёт ссылку t.me на 15 минут (бот, «Старт»); «Отвязать» — сразу.
 */
export function ProgressTelegram({ linked }: { linked: boolean }) {
  const t = useTranslations("admin.video.telegram");
  const { url, error, pending, link, unlink } = useTelegramLink();
  return (
    <AdminPanel title={t("title")}>
      <div className="progress-telegram">
        <BellRing size={20} aria-hidden="true" className="progress-telegram__icon" />
        <p className="progress-telegram__lead">{t("lead")}</p>
        <TelegramRow linked={linked} url={url} pending={pending} onLink={link} onUnlink={unlink} />
        {error ? (
          <p className="progress-telegram__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </AdminPanel>
  );
}

type RowProps = { linked: boolean; url: string | null; pending: boolean; onLink: () => void; onUnlink: () => void };

/** «Привязан · Отвязать», «Открыть Telegram» со ссылкой или «Привязать Telegram». */
function TelegramRow({ linked, url, pending, onLink, onUnlink }: RowProps) {
  const t = useTranslations("admin.video.telegram");
  if (linked) {
    return (
      <div className="progress-telegram__row">
        <Badge tone="ok" size="sm" dot>
          {t("linked")}
        </Badge>
        <Button variant="ghost" size="sm" onClick={onUnlink} pending={pending}>
          {t("unlink")}
        </Button>
      </div>
    );
  }
  return (
    <div className="progress-telegram__row">
      {url ? (
        <>
          <Button href={url} size="sm">
            <Send size={16} aria-hidden="true" />
            {t("open")}
          </Button>
          <span className="progress-telegram__hint">{t("linkHint")}</span>
        </>
      ) : (
        <Button variant="outline" size="sm" onClick={onLink} pending={pending}>
          <Send size={16} aria-hidden="true" />
          {t("link")}
        </Button>
      )}
    </div>
  );
}

function useTelegramLink() {
  const t = useTranslations("admin.video.telegram");
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const link = () =>
    start(async () => {
      setError(null);
      const result = await progressTelegramLinkAction();
      if (result.status === "link") return setUrl(result.url);
      setError(t(result.status === "error" && result.error === "telegramNoBot" ? "noBot" : "failed"));
    });
  const unlink = () =>
    start(async () => {
      const result = await progressTelegramUnlinkAction();
      if (result.status === "error") return setError(t("failed"));
      setUrl(null);
      router.refresh();
    });
  return { url, error, pending, link, unlink };
}
