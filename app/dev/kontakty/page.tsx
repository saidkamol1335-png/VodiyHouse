import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/AdminPage";
import { AdminShell } from "@/components/AdminShell";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminTopbar } from "@/components/AdminTopbar";
import { ContactsForm } from "@/components/ContactsForm";
import { DEV_VIEWER } from "@/lib/admin/access";
import { contactsFields } from "@/lib/admin/contacts/contactsForm";
import { cabinetPerson } from "@/lib/admin/person";
import { NO_CONTACTS } from "@/lib/contacts";
import { demoSaveContactsAction } from "./actions";

// Стенд «Настройки → Контакты» (Ф9): форма пустая, как до ответа заказчика (TODO-заказчик);
// «Сохранить» — настоящие проверки без базы. В продакшене страницы нет.
export default async function DevContactsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const person = await cabinetPerson(DEV_VIEWER);
  const t = await getTranslations("admin");
  const tabs = [{ segment: null, href: "/dev/kontakty", label: t("settings.tabs.contacts") }];
  return (
    <AdminShell viewer={DEV_VIEWER}>
      <AdminPage
        topbar={
          <AdminTopbar
            title={t("settings.title")}
            subtitle={t("dev.subtitleSeed", { section: t("settings.tabs.contacts") })}
            person={person}
          />
        }
      >
        <AdminTabs label={t("settings.tabsLabel")} tabs={tabs} />
        <ContactsForm fields={contactsFields(NO_CONTACTS)} action={demoSaveContactsAction} />
      </AdminPage>
    </AdminShell>
  );
}
