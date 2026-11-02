import type { ReactNode } from "react";

type FormStatusProps = {
  /** error — отказ сервера (role=alert), notice — уведомление, success — готово (role=status). */
  tone: "error" | "notice" | "success";
  children: ReactNode;
  className?: string;
};

/** Плашка над кнопкой формы: ошибка сервера или уведомление (решение С6). */
export function FormStatus({ tone, children, className }: FormStatusProps) {
  const classes = `form-status form-status--${tone}${className ? ` ${className}` : ""}`;
  return (
    <p className={classes} role={tone === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}
