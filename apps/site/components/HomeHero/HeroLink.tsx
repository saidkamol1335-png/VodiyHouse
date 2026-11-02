import type { ReactNode } from "react";
import { Link } from "@/lib/i18n/navigation";

type HeroLinkProps = { href: string; className: string; children: ReactNode };

/** Ссылка-кнопка экрана: якорь той же страницы — обычная <a>, остальное — Link с языком. */
export function HeroLink({ href, className, children }: HeroLinkProps) {
  if (href.startsWith("#")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
