import Link from "next/link";
import type { ReactNode, Ref } from "react";

type ButtonProps = {
  children: ReactNode;
  /**
   * primary — янтарная пилюля с бликом, ghost — прозрачная, danger — прозрачная с красной рамкой
   * для того, что не отменить (мокап: .btn--primary, .btn--ghost, .btn--danger).
   */
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "md" | "sm";
  block?: boolean;
  /** Ссылка без префикса языка: кабинет и переходы на сайт из кабинета. */
  href?: string;
  /** Ссылка на файл (CSV): обычная <a download> — без предзагрузки и мягкого перехода Next. */
  download?: boolean;
  type?: "button" | "submit";
  /** Кнопка отправки с name и value: одна форма — несколько действий («Опубликовать», «Скрыть»). */
  name?: string;
  value?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Форма отправляется: кнопка недоступна и помечена aria-busy. */
  pending?: boolean;
  className?: string;
  /** Кнопка-иконка (← →) — подпись для экранного диктора. */
  "aria-label"?: string;
  /** Кнопка раскрывает часть страницы («Изменить» у карточки блока). */
  "aria-expanded"?: boolean;
  /** Пояснение: одинаковые кнопки у каждой позиции стояков — к какой относится эта. */
  "aria-describedby"?: string;
  /** Вернуть на кнопку фокус, когда закрылось то, что она открыла. */
  ref?: Ref<HTMLButtonElement>;
};

type ButtonLook = Pick<ButtonProps, "variant" | "size" | "block" | "pending" | "className">;

function buttonClasses({
  variant = "primary",
  size = "md",
  block = false,
  pending = false,
  className,
}: ButtonLook): string {
  const classes = ["button", `button--${variant}`];
  if (size === "sm") classes.push("button--sm");
  if (block) classes.push("button--block");
  if (pending) classes.push("button--pending");
  if (className) classes.push(className);
  return classes.join(" ");
}

export function Button({
  children,
  href,
  download = false,
  type = "button",
  name,
  value,
  onClick,
  disabled = false,
  "aria-label": ariaLabel,
  "aria-expanded": ariaExpanded,
  "aria-describedby": ariaDescribedBy,
  ref,
  ...look
}: ButtonProps) {
  const classes = buttonClasses(look);
  if (href) {
    return (
      <ButtonLink className={classes} href={href} download={download} aria-label={ariaLabel} aria-describedby={ariaDescribedBy}>
        {children}
      </ButtonLink>
    );
  }
  return (
    <button
      ref={ref}
      type={type}
      name={name}
      value={value}
      className={classes}
      onClick={onClick}
      disabled={disabled || look.pending}
      aria-busy={look.pending || undefined}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-describedby={ariaDescribedBy}
    >
      {children}
    </button>
  );
}

type ButtonLinkProps = Pick<ButtonProps, "children" | "download" | "aria-label" | "aria-describedby"> & {
  className: string;
  href: string;
};

/** Ссылка-кнопка: переход Next (Link) или файл — обычная <a download> без предзагрузки. */
function ButtonLink({ download, ...props }: ButtonLinkProps) {
  return download ? <a {...props} download /> : <Link {...props} />;
}
