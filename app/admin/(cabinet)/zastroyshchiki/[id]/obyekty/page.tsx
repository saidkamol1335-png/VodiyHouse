import { DeveloperProjectsForm } from "@/components/DeveloperProjectsForm";
import { saveDeveloperProjectsAction } from "@/lib/admin/actions/developers";
import { developerForTab } from "@/lib/admin/server/developerTab";
import { readPastProjects } from "@/lib/admin/server/developers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** Вкладка «Сданные объекты» (Д5). */
export default async function DeveloperProjectsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const developer = await developerForTab(params);
  if (!developer) return null;
  const projects = await readPastProjects(await createSupabaseServerClient(), developer.id);
  return (
    <DeveloperProjectsForm
      developerId={developer.id}
      projects={projects}
      action={saveDeveloperProjectsAction}
    />
  );
}
