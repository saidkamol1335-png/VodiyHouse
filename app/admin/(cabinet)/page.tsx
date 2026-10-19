import { io } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminPage } from "@/components/AdminPage";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminTopbar } from "@/components/AdminTopbar";
import { getCabinetViewer, isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { greetingOf } from "@/lib/admin/greeting";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { cabinetPerson, type CabinetPerson } from "@/lib/admin/person";
import { formatWeekdayDate } from "@/lib/format";

// Приветствие зависит от текущего часа по Ташкенту (К4.3): считается на каждый запрос,
// а в статичной оболочке стоит заглушка той же высоты.
async function HomeTopbar({ person }: { person: CabinetPerson }) {
  await io();
  const now = new Date();
  const t = await getTranslations("admin.home");
  const greeting = t(`greeting.${greetingOf(now)}`);
  const title = person.firstName ? t("greetingWithName", { greeting, name: person.firstName }) : greeting;
  return <AdminTopbar title={title} subtitle={t("subtitle", { date: formatWeekdayDate(now) })} person={person} />;
}

export default async function AdminHomePage() {
  const viewer = getCabinetViewer();
  if (!viewer) redirect(ADMIN_ROUTES.login);
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin");

  const topbar = (
    <Suspense fallback={<AdminTopbar title="" person={person} pending />}>
      <HomeTopbar person={person} />
    </Suspense>
  );

  return (
    <AdminPage topbar={topbar}>
      <AdminPanel title={t("home.emptyTitle")}>{t("home.empty")}</AdminPanel>
      {isCabinetOpenWithoutLogin ? <p className="admin-page__note">{t("devOnly")}</p> : null}
    </AdminPage>
  );
}
