import { notFound } from "next/navigation";
import { AdForm } from "@/components/ShowcaseForm";
import { deleteShowcaseAction, saveAdAction } from "@/lib/admin/actions/showcase";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { readAd, readShowcaseCover, readShowcaseOptions } from "@/lib/admin/server/showcase";
import { showcaseEntityId, showcaseOpen } from "@/lib/admin/server/showcasePage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SHOWCASE_MEDIA_ACTIONS } from "../../mediaActions";

export const instant = false;

/** Реклама: новая («novoe») или правка. */
export default async function AdPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await showcaseOpen())) return null;
  const id = await showcaseEntityId(params);
  const supabase = await createSupabaseServerClient();
  const [record, options, cover] = await Promise.all([
    id ? readAd(supabase, id) : null,
    readShowcaseOptions(supabase),
    id ? readShowcaseCover(supabase, "ad", id) : null,
  ]);
  if (id && !record) notFound();
  return (
    <AdForm
      key={id ?? "new"}
      record={record}
      options={options}
      action={saveAdAction}
      cover={cover}
      mediaActions={SHOWCASE_MEDIA_ACTIONS}
      deleteAction={deleteShowcaseAction}
      base={ADMIN_ROUTES.showcase}
    />
  );
}
