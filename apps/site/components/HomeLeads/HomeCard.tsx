import Link from "next/link";
import type { ReactNode } from "react";

type HomeCardProps = { icon: ReactNode; title: string; value: number; sub: string; href: string; ok?: boolean };

/** Карточка с цифрой главной кабинета (мокап CabHome): серверные «Новые», «В работе» и живая «Свободно». */
export function HomeCard({ icon, title, value, sub, href, ok = false }: HomeCardProps) {
  return (
    <Link href={href} className="home-leads__card">
      <span className="home-leads__card-title">
        {icon}
        {title}
      </span>
      <b className="home-leads__card-value">{value}</b>
      <span className={ok ? "home-leads__card-sub home-leads__card-sub--ok" : "home-leads__card-sub"}>{sub}</span>
    </Link>
  );
}
