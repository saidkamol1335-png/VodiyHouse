import { ArrowRight, Inbox, Users } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/Avatar";
import { LeadStatusBadge } from "@/components/LeadStatusBadge";
import { LeadWhen } from "@/components/LeadWhen";
import { searchFromLeadsFilter, NO_LEADS_FILTER, type LeadRow } from "@/lib/admin/leads/screen";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { HomeCard } from "./HomeCard";
import type { LeadsHome } from "@/lib/admin/server/leads";

type HomeLeadCardsProps = { leads: LeadsHome };

/**
 * Главная кабинета (Г1 B, мокап CabHome): карточки «Новые заявки» и «В работе» (третья — живая
 * «Свободно на сайте», HomeStockLive) и «Последние заявки» над «Остатками по ЖК». Видеоотчёты — с фазой 5.
 */
export async function HomeLeadCards({ leads }: HomeLeadCardsProps) {
  const t = await getTranslations("admin.leads.home");
  const link = (status: "new" | "work") => `${ADMIN_ROUTES.leads}${searchFromLeadsFilter({ ...NO_LEADS_FILTER, status })}`;
  return (
    <>
      <HomeCard icon={<Inbox size={16} />} title={t("new")} value={leads.new} sub={t("newSub", { count: leads.today })} href={link("new")} />
      <HomeCard icon={<Users size={16} />} title={t("work")} value={leads.work} sub={t("workSub", { count: leads.meetings })} href={link("work")} />
    </>
  );
}

export async function LatestLeads({ rows }: { rows: readonly LeadRow[] }) {
  const [t, tLeads] = await Promise.all([getTranslations("admin.leads.home"), getTranslations("admin.leads")]);
  return (
    <section className="home-leads__latest" aria-labelledby="home-leads-title">
      <div className="home-leads__head">
        <h2 id="home-leads-title" className="home-leads__title">
          {t("latest")}
        </h2>
        <Link href={ADMIN_ROUTES.leads} className="home-leads__all">
          {t("all")}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      {rows.length === 0 ? <p className="home-leads__empty">{t("latestEmpty")}</p> : null}
      <ul className="home-leads__list">
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={`${ADMIN_ROUTES.leads}?n=${row.number}`} className="home-leads__row">
              <Avatar name={row.name} size="sm" />
              <span className="home-leads__text">
                <b>{`#${row.number} · ${tLeads(`types.${row.type}`)}`}</b>
                <span>
                  {[row.subject.complex ? tLeads("subject.complex", { name: row.subject.complex.ru }) : null, row.name].filter(Boolean).join(" · ")}
                  {" · "}
                  <LeadWhen at={row.createdAt} />
                </span>
              </span>
              <LeadStatusBadge status={row.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
