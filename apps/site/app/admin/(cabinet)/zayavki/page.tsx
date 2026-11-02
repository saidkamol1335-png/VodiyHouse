import { getTranslations } from "next-intl/server";
import { AdminDenied } from "@/components/AdminDenied";
import { AdminPage } from "@/components/AdminPage";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminTopbar } from "@/components/AdminTopbar";
import { LeadsScreen } from "@/components/LeadsScreen";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { leadNumberFrom, leadsFilterFrom } from "@/lib/admin/leads/screen";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { cabinetPerson } from "@/lib/admin/person";
import { readLeadCard, readLeadsScreen } from "@/lib/admin/server/leads";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** «Заявки» (шаг 3.7, мокап CabLeads): руководитель и менеджер; фильтры и карточка — в адресе. */
export default async function LeadsPage({ searchParams }: PageProps<"/admin/zayavki">) {
  const { viewer, allowed } = await requireSection("leads");
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin");
  const topbar = <AdminTopbar title={t("leads.title")} subtitle={t("leads.subtitle")} person={person} />;
  if (!allowed) {
    return (
      <AdminPage topbar={topbar}>
        <AdminDenied section={t("nav.leads")} />
      </AdminPage>
    );
  }
  if (isCabinetOpenWithoutLogin || !hasSupabaseEnv()) {
    return (
      <AdminPage topbar={topbar}>
        <AdminPanel title={t("leads.title")}>{t("developers.errors.notConfigured")}</AdminPanel>
      </AdminPage>
    );
  }
  const search = await searchParams;
  const filter = leadsFilterFrom(search);
  const number = leadNumberFrom(search.n);
  const supabase = await createSupabaseServerClient();
  const [screen, card] = await Promise.all([
    readLeadsScreen(supabase, filter),
    number ? readLeadCard(supabase, number) : Promise.resolve(null),
  ]);
  return (
    <AdminPage topbar={topbar}>
      <LeadsScreen
        screen={screen}
        filter={filter}
        card={card}
        notFound={number !== null && card === null}
        viewerId={viewer.id}
        base={ADMIN_ROUTES.leads}
      />
    </AdminPage>
  );
}
