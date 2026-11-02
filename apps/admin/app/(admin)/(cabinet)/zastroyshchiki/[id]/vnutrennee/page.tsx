import { DeveloperPrivateForm } from "@/components/DeveloperPrivateForm";
import { saveDeveloperPrivateAction } from "@/lib/admin/actions/developers";
import { developerForTab } from "@/lib/admin/server/developerTab";
import { readPrivateNotes } from "@/lib/admin/server/developers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** Вкладка «Внутреннее»: контакты застройщика и заметки — только кабинет. */
export default async function DeveloperPrivatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const developer = await developerForTab(params);
  if (!developer) return null;
  const notes = await readPrivateNotes(await createSupabaseServerClient(), developer.id);
  return (
    <DeveloperPrivateForm
      key={developer.id}
      developerId={developer.id}
      notes={notes}
      action={saveDeveloperPrivateAction}
    />
  );
}
