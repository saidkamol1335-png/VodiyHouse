"use client";

import { Share } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import type { ShareData } from "./ShareDialog";

// Окно — по первому нажатию: у каждой карточки каталога своя кнопка, а код окна один и ленивый.
const ShareDialog = dynamic(() => import("./ShareDialog").then((module) => module.ShareDialog), { ssr: false });

type ShareButtonProps = {
  /** Что показать в превью ссылки; адрес страницы — путь сайта, домен добавит браузер. */
  share: ShareData;
  className?: string;
  /** Своя подпись (кнопка с текстом «Поделиться подборкой»); без неё — кружок со значком. */
  children?: ReactNode;
};

/** «Поделиться» (мокап: .ibtn share, окно .mdl share): превью ссылки, «Скопировать», Telegram. */
export function ShareButton({ share, className, children }: ShareButtonProps) {
  const t = useTranslations("share");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={[children ? null : "share-button", className].filter(Boolean).join(" ")}
        aria-label={children ? undefined : t("button", { name: share.title })}
        onClick={() => setOpen(true)}
      >
        {children ?? <Share size={16} strokeWidth={2} aria-hidden />}
      </button>
      {open ? <ShareDialog share={share} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
