import { notFound } from "next/navigation";
import { CollectionForm } from "@/components/ShowcaseForm";
import { deleteShowcaseAction, saveCollectionAction } from "@/lib/admin/actions/showcase";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { readCollection, readShowcaseCover, readShowcaseOptions } from "@/lib/admin/server/showcase";
import { showcaseEntityId, showcaseOpen } from "@/lib/admin/server/showcasePage";
import { ROUTES } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SHOWCASE_MEDIA_ACTIONS } from "../../mediaActions";

export const instant = false;

/** Подборка: новая («novoe») или правка. */
export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await showcaseOpen())) return null;
  const id = await showcaseEntityId(params);
  const supabase = await createSupabaseServerClient();
  const [record, options, cover] = await Promise.all([
    id ? readCollection(supabase, id) : null,
    readShowcaseOptions(supabase),
    id ? readShowcaseCover(supabase, "collection", id) : null,
  ]);
  if (id && !record) notFound();
  return (
    <CollectionForm
      key={id ?? "new"}
      record={record}
      options={options}
      action={saveCollectionAction}
      cover={cover}
      mediaActions={SHOWCASE_MEDIA_ACTIONS}
      deleteAction={deleteShowcaseAction}
      base={ADMIN_ROUTES.showcase}
      catalogHref={ROUTES.catalog}
    />
  );
}
