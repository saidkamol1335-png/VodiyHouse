import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/AdminPage";
import { AdminShell } from "@/components/AdminShell";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminTopbar } from "@/components/AdminTopbar";
import { DictionaryEditor } from "@/components/DictionaryEditor";
import { DEV_VIEWER } from "@/lib/admin/access";
import { DICTIONARY_KEYS } from "@/lib/admin/dictionaries/definitions";
import { SEED_DICTIONARIES } from "@/lib/admin/dictionaries/seed";
import type { DictionaryActionSet } from "@/lib/admin/dictionaries/types";
import { cabinetPerson } from "@/lib/admin/person";
import {
  demoAddDictionaryItemAction,
  demoRemoveDictionaryItemAction,
  demoReorderDictionaryAction,
  demoSetDictionaryItemActiveAction,
  demoUpdateDictionaryItemAction,
} from "./actions";

const DEMO_ACTIONS: DictionaryActionSet = {
  add: demoAddDictionaryItemAction,
  update: demoUpdateDictionaryItemAction,
  setActive: demoSetDictionaryItemActiveAction,
  remove: demoRemoveDictionaryItemAction,
  reorder: demoReorderDictionaryAction,
};

// Стенд «Настройки → Справочники» (Д6): значения — начальные данные миграции, действия —
// подделка без базы (как /dev/staff). В продакшене страницы нет.
export default async function DevDictionariesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const person = await cabinetPerson(DEV_VIEWER);
  const t = await getTranslations("admin");
  const tabs = [
    { segment: null, href: "/dev/spravochniki", label: t("settings.tabs.dictionaries") },
  ];
  return (
    <AdminShell viewer={DEV_VIEWER}>
      <AdminPage
        topbar={
          <AdminTopbar
            title={t("settings.title")}
            subtitle="Справочники · служебная страница"
            person={person}
          />
        }
      >
        <AdminTabs label={t("settings.tabsLabel")} tabs={tabs} />
        <p className="admin-page__lead">{t("dictionaries.lead")}</p>
        {DICTIONARY_KEYS.map((key) => (
          <DictionaryEditor
            key={key}
            dictionary={key}
            items={SEED_DICTIONARIES[key]}
            actions={DEMO_ACTIONS}
          />
        ))}
      </AdminPage>
    </AdminShell>
  );
}
