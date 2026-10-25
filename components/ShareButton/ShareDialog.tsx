"use client";

import { Copy, Send, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { SitePhoto } from "@/components/SitePhoto";
import type { SitePhotoData } from "@/lib/site/photo";
import { track } from "@/lib/events/client";

export type ShareData = { path: string; title: string; text: string; photo: SitePhotoData | null };

type ShareDialogProps = { share: ShareData; onClose: () => void };

const COPIED_MS = 2_000;

/**
 * Окно «Поделиться ссылкой» (мокап .mdl isShare): как ссылка выглядит в мессенджере (фото, домен,
 * заголовок, описание), адрес с «Скопировать» и «Отправить в Telegram» (t.me/share — ссылка
 * Telegram для любого получателя, не контакт застройщика).
 */
export function ShareDialog({ share, onClose }: ShareDialogProps) {
  const t = useTranslations("share");
  const dialog = useRef<HTMLDialogElement>(null);
  const url = `${window.location.origin}${share.path}`;
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const telegram = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(share.title)}`;
  return (
    <dialog
      ref={dialog}
      className="share-dialog"
      aria-labelledby="share-dialog-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current.close();
      }}
    >
      <div className="share-dialog__head">
        <h2 id="share-dialog-title" className="share-dialog__title">
          {t("title")}
        </h2>
        <button type="button" className="share-dialog__close" aria-label={t("close")} onClick={() => dialog.current?.close()}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <SharePreview share={share} />
      <ShareUrl url={url} />
      <a className="share-dialog__telegram" href={telegram} target="_blank" rel="noopener" data-track="share" data-track-detail="telegram">
        <Send size={16} aria-hidden="true" />
        {t("telegram")}
      </a>
    </dialog>
  );
}

/** Как ссылка выглядит в мессенджере (Open Graph страницы — те же фото и заголовок). */
function SharePreview({ share }: { share: ShareData }) {
  const t = useTranslations("share");
  return (
    <>
      <p className="share-dialog__label">{t("preview")}</p>
      <div className="share-dialog__preview">
        {share.photo ? <SitePhoto photo={share.photo} alt="" frame="cover" sizes="480px" className="share-dialog__photo" /> : null}
        <span className="share-dialog__domain">{window.location.host}</span>
        <b className="share-dialog__preview-title">{share.title}</b>
        {share.text ? <span className="share-dialog__preview-text">{share.text}</span> : null}
      </div>
    </>
  );
}

/** Адрес и «Скопировать»: «Ссылка скопирована» на 2 с; буфер закрыт — скопировать из поля вручную. */
function ShareUrl({ url }: { url: string }) {
  const t = useTranslations("share");
  const [copy, setCopy] = useState<"idle" | "done" | "failed">("idle");
  useEffect(() => {
    if (copy !== "done") return;
    const timer = setTimeout(() => setCopy("idle"), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copy]);
  const onCopy = () => {
    const copied = navigator.clipboard?.writeText(url);
    if (!copied) return setCopy("failed");
    copied.then(
      () => {
        setCopy("done");
        track("share", { detail: "copy" });
      },
      () => setCopy("failed"),
    );
  };
  return (
    <>
      <div className="share-dialog__url">
        <input className="share-dialog__input" value={url} readOnly aria-label={t("link")} onFocus={(event) => event.currentTarget.select()} />
        <Button size="sm" onClick={onCopy}>
          <Copy size={14} aria-hidden="true" />
          {copy === "done" ? t("copied") : t("copy")}
        </Button>
      </div>
      {copy === "failed" ? <p className="share-dialog__hint">{t("copyFailed")}</p> : null}
    </>
  );
}
