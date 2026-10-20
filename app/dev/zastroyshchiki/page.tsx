import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/AdminPage";
import { AdminShell } from "@/components/AdminShell";
import { AdminTopbar } from "@/components/AdminTopbar";
import { DeveloperCreateForm } from "@/components/DeveloperCreateForm";
import { DeveloperList } from "@/components/DeveloperList";
import { DEV_VIEWER } from "@/lib/admin/access";
import { DEMO_DEVELOPER_ROWS } from "@/lib/admin/developers/demo";
import { cabinetPerson } from "@/lib/admin/person";
import { demoCreateDeveloperAction } from "./actions";

// Стенд «Застройщики» (шаг 10.2) на DEMO мокапа: те же компоненты, что у /admin/zastroyshchiki,
// без базы. Логотипов у DEMO нет — знаки-инициалы. В продакшене страницы нет.
export default async function DevDevelopersPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const person = await cabinetPerson(DEV_VIEWER);
  const t = await getTranslations("admin.developers");
  const rows = DEMO_DEVELOPER_ROWS.map((row) => ({ ...row, logoSrc: null }));
  return (
    <AdminShell viewer={DEV_VIEWER}>
      <AdminPage
        topbar={
          <AdminTopbar title={t("title")} subtitle="DEMO · служебная страница" person={person} />
        }
      >
        <DeveloperCreateForm action={demoCreateDeveloperAction} />
        <DeveloperList rows={rows} baseHref="/dev/zastroyshchiki" />
      </AdminPage>
    </AdminShell>
  );
}
