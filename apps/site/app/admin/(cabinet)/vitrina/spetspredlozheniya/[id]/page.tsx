import { notFound } from "next/navigation";
import { SpecialForm } from "@/components/ShowcaseForm";
import { deleteShowcaseAction, saveSpecialAction } from "@/lib/admin/actions/showcase";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { readShowcaseCover, readShowcaseOptions, readSpecial } from "@/lib/admin/server/showcase";
import { showcaseEntityId, showcaseOpen } from "@/lib/admin/server/showcasePage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SHOWCASE_MEDIA_ACTIONS } from "../../mediaActions";

export const instant = false;

/** Спецпредложение: новое («novoe») или правка. */
export default async function SpecialPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await showcaseOpen())) return null;
  const id = await showcaseEntityId(params);
  const supabase = await createSupabaseServerClient();
  const [record, options, cover] = await Promise.all([
    id ? readSpecial(supabase, id) : null,
    readShowcaseOptions(supabase),
    id ? readShowcaseCover(supabase, "special", id) : null,
  ]);
  if (id && !record) notFound();
  return (
    <SpecialForm
      key={id ?? "new"}
      record={record}
      options={options}
      action={saveSpecialAction}
      cover={cover}
      mediaActions={SHOWCASE_MEDIA_ACTIONS}
      deleteAction={deleteShowcaseAction}
      base={ADMIN_ROUTES.showcase}
    />
  );
}
