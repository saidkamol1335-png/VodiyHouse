import Link from "next/link";
import type { ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  /** primary — янтарная пилюля с бликом, ghost — прозрачная (мокап: .btn--primary, .btn--ghost). */
  variant?: "primary" | "ghost";
  size?: "md" | "sm";
  block?: boolean;
  /** Ссылка без префикса языка: кабинет и переходы на сайт из кабинета. */
  href?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  /** Форма отправляется: кнопка недоступна и помечена aria-busy. */
  pending?: boolean;
  className?: string;
};

type ButtonLook = Pick<ButtonProps, "variant" | "size" | "block" | "pending" | "className">;

function buttonClasses({ variant = "primary", size = "md", block = false, pending = false, className }: ButtonLook): string {
  const classes = ["button", `button--${variant}`];
  if (size === "sm") classes.push("button--sm");
  if (block) classes.push("button--block");
  if (pending) classes.push("button--pending");
  if (className) classes.push(className);
  return classes.join(" ");
}

export function Button({ children, href, type = "button", onClick, disabled = false, ...look }: ButtonProps) {
  const classes = buttonClasses(look);
  if (href) {
    return (
      <Link className={classes} href={href}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled || look.pending}
      aria-busy={look.pending || undefined}
    >
      {children}
    </button>
  );
}
