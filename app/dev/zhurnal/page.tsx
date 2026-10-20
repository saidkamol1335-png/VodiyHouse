import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/AdminPage";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminShell } from "@/components/AdminShell";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminTopbar } from "@/components/AdminTopbar";
import { JournalList } from "@/components/JournalList";
import { DEV_VIEWER } from "@/lib/admin/access";
import { DEMO_JOURNAL } from "@/lib/admin/developers/demo";
import { journalPage } from "@/lib/admin/journal/format";
import { cabinetPerson } from "@/lib/admin/person";

// Стенд «Настройки → Журнал» на DEMO-записях (правки DEMO-руководителя мокапа).
export default async function DevJournalPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const person = await cabinetPerson(DEV_VIEWER);
  const t = await getTranslations("admin");
  const tabs = [{ segment: null, href: "/dev/zhurnal", label: t("settings.tabs.journal") }];
  return (
    <AdminShell viewer={DEV_VIEWER}>
      <AdminPage
        topbar={
          <AdminTopbar
            title={t("settings.title")}
            subtitle="Журнал · DEMO · служебная страница"
            person={person}
          />
        }
      >
        <AdminTabs label={t("settings.tabsLabel")} tabs={tabs} />
        <AdminPanel title={t("journal.title")} wide>
          <p className="admin-panel__lead">{t("journal.lead")}</p>
          <JournalList page={journalPage(DEMO_JOURNAL)} developerId={null} load={null} />
        </AdminPanel>
      </AdminPage>
    </AdminShell>
  );
}
