"use client";

import { Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { phoneHref } from "@/lib/contacts";

type PhoneButtonProps = {
  phone: string;
  className?: string;
};

/** «Показать телефон»: первый клик открывает общий номер Vodiy House, второй — звонит. */
export function PhoneButton({ phone, className }: PhoneButtonProps) {
  const t = useTranslations("header");
  const [shown, setShown] = useState(false);
  const classes = className ? `phone-button ${className}` : "phone-button";
  const icon = <Phone size={16} strokeWidth={1.9} aria-hidden />;
  if (shown) {
    return (
      <a className={classes} href={phoneHref(phone)}>
        {icon}
        {phone}
      </a>
    );
  }
  return (
    <button type="button" className={classes} onClick={() => setShown(true)}>
      {icon}
      {t("showPhone")}
    </button>
  );
}
