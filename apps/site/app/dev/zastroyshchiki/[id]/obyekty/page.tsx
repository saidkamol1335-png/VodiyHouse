import { notFound } from "next/navigation";
import { DeveloperProjectsForm } from "@/components/DeveloperProjectsForm";
import { DEMO_DEVELOPER_ID, DEMO_PROJECTS, demoDeveloper } from "@/lib/admin/developers/demo";
import { demoSaveProjectsAction } from "../../actions";

// Адрес с [id] известен только на запросе: страница ждёт его на сервере, как разделы кабинета
// (docs: instant-navigation) — иначе меню и вкладки (usePathname) вне <Suspense> падают.
export const instant = false;

/** Вкладка «Сданные объекты» на DEMO: у Farg‘ona Sifat Qurilish — объекты из сида. */
export default async function DevDeveloperProjectsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const developer = demoDeveloper((await params).id);
  if (!developer) notFound();
  const projects = developer.id === DEMO_DEVELOPER_ID ? DEMO_PROJECTS : [];
  return (
    <DeveloperProjectsForm
      developerId={developer.id}
      projects={projects}
      action={demoSaveProjectsAction}
    />
  );
}
