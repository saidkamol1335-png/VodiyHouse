import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SpecialForm } from "@/components/ShowcaseForm";
import { NEW_SHOWCASE_ID } from "@/lib/admin/nav";
import { DEMO_SHOWCASE_OPTIONS, demoSpecial } from "@/lib/admin/showcase/demo";
import { demoDeleteShowcaseAction, demoSaveSpecialAction } from "../../actions";
import { DEV_SHOWCASE_BASE } from "../../base";

export const instant = false;

/** Стенд спецпредложения: DEMO-запись или новая («novoe»); фото остаётся в браузере. */
export default async function DevSpecialPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const record = id === NEW_SHOWCASE_ID ? null : demoSpecial(id);
  if (id !== NEW_SHOWCASE_ID && !record) notFound();
  return (
    <SpecialForm
      key={id}
      record={record}
      options={DEMO_SHOWCASE_OPTIONS}
      action={demoSaveSpecialAction}
      cover={null}
      mediaActions={null}
      deleteAction={record ? demoDeleteShowcaseAction : null}
      base={DEV_SHOWCASE_BASE}
    />
  );
}
