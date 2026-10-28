import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CollectionForm } from "@/components/ShowcaseForm";
import { NEW_SHOWCASE_ID } from "@/lib/admin/nav";
import { DEMO_SHOWCASE_OPTIONS, demoCollection } from "@/lib/admin/showcase/demo";
import { ROUTES } from "@/lib/routes";
import { demoDeleteShowcaseAction, demoSaveCollectionAction } from "../../actions";
import { DEV_SHOWCASE_BASE } from "../../base";

export const instant = false;

/** Стенд подборки: DEMO-запись или новая («novoe»). */
export default async function DevCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const record = id === NEW_SHOWCASE_ID ? null : demoCollection(id);
  if (id !== NEW_SHOWCASE_ID && !record) notFound();
  return (
    <CollectionForm
      key={id}
      record={record}
      options={DEMO_SHOWCASE_OPTIONS}
      action={demoSaveCollectionAction}
      cover={null}
      mediaActions={null}
      deleteAction={record ? demoDeleteShowcaseAction : null}
      base={DEV_SHOWCASE_BASE}
      catalogHref={ROUTES.catalog}
    />
  );
}
