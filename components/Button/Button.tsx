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
  className?: string;
};

function buttonClasses({ variant = "primary", size = "md", block = false, className }: Omit<ButtonProps, "children">): string {
  const classes = ["button", `button--${variant}`];
  if (size === "sm") classes.push("button--sm");
  if (block) classes.push("button--block");
  if (className) classes.push(className);
  return classes.join(" ");
}

export function Button({ children, href, type = "button", onClick, ...look }: ButtonProps) {
  const classes = buttonClasses(look);
  if (href) {
    return (
      <Link className={classes} href={href}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} onClick={onClick}>
      {children}
    </button>
  );
}
