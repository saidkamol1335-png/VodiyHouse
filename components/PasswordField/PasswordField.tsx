"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Field, type FieldProps } from "@/components/Field";

const ICON = { size: 18, strokeWidth: 1.8 } as const;

/** Поле пароля с «глазом»: показать или скрыть введённое (вход и смена пароля). */
export function PasswordField(props: Omit<FieldProps, "type" | "trailing">) {
  const t = useTranslations("admin.login");
  const [visible, setVisible] = useState(false);
  const label = visible ? t("hidePassword") : t("showPassword");
  const reveal = (
    <button
      type="button"
      className="icon-button icon-button--sm icon-button--bare"
      aria-label={label}
      aria-pressed={visible}
      onClick={() => setVisible((current) => !current)}
    >
      {visible ? <EyeOff {...ICON} aria-hidden /> : <Eye {...ICON} aria-hidden />}
    </button>
  );
  return <Field {...props} type={visible ? "text" : "password"} trailing={reveal} />;
}
