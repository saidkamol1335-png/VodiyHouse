import { redirect } from "next/navigation";
import { leadNumberFrom } from "@/lib/admin/leads/screen";
import { ADMIN_ROUTES } from "@/lib/admin/nav";

/** «Взять в работу: …/admin/zayavki/1045» из сообщения бота — та же страница с открытой карточкой. */
export default async function LeadLinkPage({ params }: PageProps<"/admin/zayavki/[number]">) {
  const number = leadNumberFrom((await params).number);
  redirect(number ? `${ADMIN_ROUTES.leads}?n=${number}` : ADMIN_ROUTES.leads);
}
