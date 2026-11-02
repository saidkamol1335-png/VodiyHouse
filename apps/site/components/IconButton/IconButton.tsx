import type { ReactNode, Ref } from "react";
import { Link } from "@/lib/i18n/navigation";

type IconButtonProps = {
  /** Подпись для скринридера: у кнопки нет текста, только иконка. */
  label: string;
  children: ReactNode;
  href?: string;
  /** Внешняя ссылка (tel:, t.me) — без префикса языка. */
  external?: boolean;
  onClick?: () => void;
  className?: string;
  badge?: number;
  expanded?: boolean;
  controls?: string;
  /** React 19: ref — обычный проп; нужен, чтобы вернуть фокус на кнопку меню после Escape. */
  ref?: Ref<HTMLButtonElement>;
};

/** Круглая кнопка-иконка шапки: 42 px на десктопе, 44 px на телефоне (цель нажатия). */
export function IconButton({ label, children, href, external, onClick, className, badge, expanded, controls, ref }: IconButtonProps) {
  const classes = className ? `icon-button ${className}` : "icon-button";
  const content = (
    <>
      {children}
      {badge ? <span className="icon-button__badge">{badge}</span> : null}
    </>
  );
  if (href && external) {
    return <a className={classes} href={href} aria-label={label}>{content}</a>;
  }
  if (href) {
    return <Link className={classes} href={href} aria-label={label}>{content}</Link>;
  }
  return (
    <button ref={ref} type="button" className={classes} aria-label={label} onClick={onClick} aria-expanded={expanded} aria-controls={controls}>
      {content}
    </button>
  );
}
