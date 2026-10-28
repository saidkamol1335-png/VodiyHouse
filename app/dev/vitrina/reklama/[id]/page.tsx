import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AdForm } from "@/components/ShowcaseForm";
import { NEW_SHOWCASE_ID } from "@/lib/admin/nav";
import { DEMO_SHOWCASE_OPTIONS, demoAd } from "@/lib/admin/showcase/demo";
import { demoDeleteShowcaseAction, demoSaveAdAction } from "../../actions";
import { DEV_SHOWCASE_BASE } from "../../base";

export const instant = false;

/** Стенд рекламы: DEMO-запись или новая («novoe»). */
export default async function DevAdPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const record = id === NEW_SHOWCASE_ID ? null : demoAd(id);
  if (id !== NEW_SHOWCASE_ID && !record) notFound();
  return (
    <AdForm
      key={id}
      record={record}
      options={DEMO_SHOWCASE_OPTIONS}
      action={demoSaveAdAction}
      cover={null}
      mediaActions={null}
      deleteAction={record ? demoDeleteShowcaseAction : null}
      base={DEV_SHOWCASE_BASE}
    />
  );
}
