import { getTranslations } from "next-intl/server";
import { AdminPanel } from "@/components/AdminPanel";
import { DictionaryEditor } from "@/components/DictionaryEditor";
import { HintsEditor } from "@/components/HintsEditor";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import {
  addDictionaryItemAction,
  removeDictionaryItemAction,
  reorderDictionaryAction,
  setDictionaryItemActiveAction,
  updateDictionaryItemAction,
} from "@/lib/admin/actions/dictionaries";
import { saveHintAction } from "@/lib/admin/actions/hints";
import { DICTIONARY_KEYS } from "@/lib/admin/dictionaries/definitions";
import type { DictionaryActionSet } from "@/lib/admin/dictionaries/types";
import { readDictionary } from "@/lib/admin/server/developers";
import { readHintItems } from "@/lib/admin/server/hints";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

const ACTIONS: DictionaryActionSet = {
  add: addDictionaryItemAction,
  update: updateDictionaryItemAction,
  setActive: setDictionaryItemActiveAction,
  remove: removeDictionaryItemAction,
  reorder: reorderDictionaryAction,
};

/** «Настройки → Справочники» (Д6): справочники и подсказки «?» калькулятора на одной странице. */
export default async function SettingsDictionariesPage() {
  const { allowed } = await requireSection("settings");
  if (!allowed) return null;
  const t = await getTranslations("admin");
  if (isCabinetOpenWithoutLogin || !hasSupabaseEnv()) {
    return (
      <AdminPanel title={t("settings.tabs.dictionaries")}>
        {t("developers.errors.notConfigured")}
      </AdminPanel>
    );
  }
  const supabase = await createSupabaseServerClient();
  const [dictionaries, hints] = await Promise.all([
    Promise.all(
      DICTIONARY_KEYS.map(async (key) => ({ key, items: await readDictionary(supabase, key) })),
    ),
    readHintItems(supabase),
  ]);
  return (
    <>
      <p className="admin-page__lead">{t("dictionaries.lead")}</p>
      {dictionaries.map(({ key, items }) => (
        <DictionaryEditor key={key} dictionary={key} items={items} actions={ACTIONS} />
      ))}
      <HintsEditor items={hints} action={saveHintAction} />
    </>
  );
}
